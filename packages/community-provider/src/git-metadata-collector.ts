import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import type { BigIntStats } from "node:fs";
import { lstat, open, opendir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { TextDecoder } from "node:util";

import {
  isIssuedAuthorizedRepositoryConfig,
  localRepositoryConfigHardLimits,
  type LocalPathPlatform,
  type ResolvedAuthorizedRepositoryConfig,
} from "./authorized-repository-config.ts";
import {
  nodeBoundedGitCommandPort,
  type BoundedGitCommandFailureReason,
  type BoundedGitCommandPort,
  type GitObjectFormat,
} from "./bounded-git-command.ts";
import { digestGitIdentity, maximumGitIdentityBytes } from "./git-identity.ts";

export const gitMetadataSnapshotVersion = "0.1.0" as const;

export const gitMetadataHardLimits = Object.freeze({
  maxCommits: 256,
  maxParentsPerCommit: 64,
  maxCoauthorsPerCommit: 32,
  maxIdentityBytes: maximumGitIdentityBytes,
  maxHeadBytes: 1_024,
});

export type GitMetadataErrorCategory =
  | "invalid-input"
  | "path-unavailable"
  | "not-authorized"
  | "unsupported-repository"
  | "git-unavailable"
  | "invalid-metadata"
  | "limit-exceeded"
  | "deadline-exceeded";

export interface GitCommitMetadata {
  readonly objectId: string;
  readonly parentObjectIds: readonly string[];
  readonly authoredAt: string;
  readonly committedAt: string;
  readonly authorIdentityDigest: string;
  readonly committerIdentityDigest: string;
  readonly coauthorIdentityDigests: readonly string[];
  readonly changedPaths: readonly string[];
}

export interface RepositoryGitMetadata {
  readonly repositoryId: string;
  readonly rootId: string;
  readonly objectFormat: GitObjectFormat;
  readonly headObjectId: string;
  readonly shallow: boolean;
  readonly historyTruncated: boolean;
  readonly totalCommitBytes: number;
  readonly commits: readonly GitCommitMetadata[];
}

export interface GitMetadataSnapshot {
  readonly kind: "git-metadata-snapshot";
  readonly snapshotVersion: typeof gitMetadataSnapshotVersion;
  readonly repositories: readonly RepositoryGitMetadata[];
}

export type CollectGitMetadataResult =
  | { readonly ok: true; readonly value: GitMetadataSnapshot }
  | {
      readonly ok: false;
      readonly error: {
        readonly category: GitMetadataErrorCategory;
        readonly retryable: boolean;
      };
    };

interface DeadlineClock {
  check(): void;
  remainingMs(): number;
}

interface CollectionContext {
  readonly authorization: ResolvedAuthorizedRepositoryConfig;
  readonly commandPort: BoundedGitCommandPort;
  readonly clock: DeadlineClock;
  commandOutputBytes: number;
}

interface ObjectStoreSnapshot {
  readonly fingerprint: string;
  readonly entryCount: number;
  readonly totalBytes: number;
}

interface RevisionRecord {
  readonly objectId: string;
  readonly parentObjectIds: readonly string[];
}

interface CommitObjectInfo {
  readonly objectId: string;
  readonly sizeBytes: number;
}

interface ParsedCommitIdentity {
  readonly digest: string;
  readonly timestamp: string;
}

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const objectIdPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;

class GitCollectorFault extends Error {
  readonly category: GitMetadataErrorCategory;
  readonly retryable: boolean;

  constructor(category: GitMetadataErrorCategory, retryable: boolean) {
    super(category);
    this.category = category;
    this.retryable = retryable;
  }
}

export async function collectGitMetadata(
  authorization: ResolvedAuthorizedRepositoryConfig,
  options: {
    readonly commandPort?: BoundedGitCommandPort;
    readonly now?: () => number;
  } = {},
): Promise<CollectGitMetadataResult> {
  if (!isIssuedAuthorizedRepositoryConfig(authorization)) return failure("invalid-input", false);
  const commandPort = options.commandPort ?? nodeBoundedGitCommandPort;
  const now = options.now ?? (() => performance.now());
  if (!isCommandPort(commandPort) || typeof now !== "function") {
    return failure("invalid-input", false);
  }

  try {
    const startedAt = readClock(now);
    const clock = createDeadlineClock(now, startedAt, authorization.limits.maxDurationMs);
    const context: CollectionContext = {
      authorization,
      commandPort,
      clock,
      commandOutputBytes: 0,
    };
    const roots = new Map(authorization.authorizedRoots.map((root) => [root.rootId, root]));

    for (const root of authorization.authorizedRoots) {
      await requireAuthorizedDirectory(
        root.canonicalPath,
        root.pathIdentity,
        authorization.platform,
        clock,
      );
    }

    const repositories: RepositoryGitMetadata[] = [];
    for (const repository of authorization.repositories) {
      const root = roots.get(repository.rootId);
      if (root === undefined) throw new GitCollectorFault("invalid-input", false);
      await requireAuthorizedDirectory(
        repository.canonicalPath,
        repository.pathIdentity,
        authorization.platform,
        clock,
      );
      requireContained(root.canonicalPath, repository.canonicalPath, authorization.platform);
      repositories.push(await collectRepository(context, root.canonicalPath, repository));
    }

    repositories.sort((left, right) => compareText(left.repositoryId, right.repositoryId));
    return deepFreeze({
      ok: true,
      value: {
        kind: "git-metadata-snapshot",
        snapshotVersion: gitMetadataSnapshotVersion,
        repositories,
      },
    });
  } catch (error) {
    if (error instanceof GitCollectorFault) return failure(error.category, error.retryable);
    return failure("path-unavailable", true);
  }
}

async function collectRepository(
  context: CollectionContext,
  rootPath: string,
  repository: ResolvedAuthorizedRepositoryConfig["repositories"][number],
): Promise<RepositoryGitMetadata> {
  context.commandOutputBytes = 0;
  const { authorization, clock } = context;
  const platform = authorization.platform;
  const gitDirectoryCandidate = joinPath(repository.canonicalPath, ".git", platform);
  const gitDirectory = await inspectPath(gitDirectoryCandidate, platform, clock);
  if (
    gitDirectory.kind !== "directory" ||
    identityFor(gitDirectory.canonicalPath, platform) !==
      identityFor(gitDirectoryCandidate, platform)
  ) {
    throw new GitCollectorFault("unsupported-repository", false);
  }
  requireContained(rootPath, gitDirectory.canonicalPath, platform);
  requireContained(repository.canonicalPath, gitDirectory.canonicalPath, platform);

  for (const unsupportedName of ["commondir", "config.worktree"]) {
    if (await pathEntryExists(gitDirectory.canonicalPath, unsupportedName, clock)) {
      throw new GitCollectorFault("unsupported-repository", false);
    }
  }

  const objectDirectoryCandidate = joinPath(gitDirectory.canonicalPath, "objects", platform);
  const objectDirectory = await inspectPath(objectDirectoryCandidate, platform, clock);
  if (
    objectDirectory.kind !== "directory" ||
    identityFor(objectDirectory.canonicalPath, platform) !==
      identityFor(objectDirectoryCandidate, platform)
  ) {
    throw new GitCollectorFault("not-authorized", false);
  }
  requireContained(rootPath, objectDirectory.canonicalPath, platform);
  requireContained(repository.canonicalPath, objectDirectory.canonicalPath, platform);

  const head = await resolveHead({
    gitDirectory: gitDirectory.canonicalPath,
    rootPath,
    repositoryPath: repository.canonicalPath,
    platform,
    limits: authorization.limits,
    clock,
  });
  const objectFormat = objectFormatFor(head);
  const shallowObjectIds = await readShallowBoundary({
    gitDirectory: gitDirectory.canonicalPath,
    rootPath,
    repositoryPath: repository.canonicalPath,
    platform,
    objectFormat,
    limits: authorization.limits,
    clock,
  });

  const before = await snapshotObjectStore(
    objectDirectory.canonicalPath,
    rootPath,
    repository.canonicalPath,
    platform,
    authorization.limits,
    clock,
  );
  const maximumCommits = Math.min(
    gitMetadataHardLimits.maxCommits,
    authorization.limits.maxFilesPerRepository,
  );
  const revisionOutput = await executeGit(
    context,
    objectDirectory.canonicalPath,
    objectFormat,
    shallowObjectIds,
    ["rev-list", `--max-count=${String(maximumCommits + 1)}`, "--topo-order", "--parents", head],
    new Uint8Array(),
  );
  const revisions = parseRevisionList(revisionOutput, objectFormat, maximumCommits + 1, head);
  const historyTruncated = revisions.length > maximumCommits;
  const selectedRevisions = revisions.slice(0, maximumCommits);
  if (selectedRevisions.length === 0) throw new GitCollectorFault("invalid-metadata", false);

  const objectInput = encodeObjectIds(selectedRevisions.map((revision) => revision.objectId));
  const checkOutput = await executeGit(
    context,
    objectDirectory.canonicalPath,
    objectFormat,
    shallowObjectIds,
    ["cat-file", "--batch-check"],
    objectInput,
  );
  const objectInformation = parseBatchCheck(
    checkOutput,
    selectedRevisions,
    objectFormat,
    authorization.limits.maxBytesPerFile,
    authorization.limits.maxTotalBytesPerRepository,
  );
  const totalCommitBytes = objectInformation.reduce((sum, item) => sum + item.sizeBytes, 0);
  const batchOutput = await executeGit(
    context,
    objectDirectory.canonicalPath,
    objectFormat,
    shallowObjectIds,
    ["cat-file", "--batch"],
    objectInput,
  );
  const commitBodies = parseBatchOutput(batchOutput, objectInformation);

  const commits: GitCommitMetadata[] = [];
  let changedPathAssociations = 0;
  let changedPathBytes = 0;
  for (let index = 0; index < selectedRevisions.length; index += 1) {
    const revision = selectedRevisions[index];
    const body = commitBodies[index];
    if (revision === undefined || body === undefined) {
      throw new GitCollectorFault("invalid-metadata", false);
    }
    const parsed = parseCommitObject(body, revision, objectFormat, shallowObjectIds);
    const pathOutput = await executeGit(
      context,
      objectDirectory.canonicalPath,
      objectFormat,
      shallowObjectIds,
      [
        "diff-tree",
        "--root",
        "--no-commit-id",
        "--name-only",
        "-r",
        "-z",
        "--no-renames",
        "--no-ext-diff",
        "--no-textconv",
        "-m",
        revision.objectId,
      ],
      new Uint8Array(),
    );
    const changedPaths = parseChangedPaths(pathOutput);
    changedPathAssociations += changedPaths.length;
    changedPathBytes += changedPaths.reduce(
      (sum, item) => sum + Buffer.byteLength(item, "utf8"),
      0,
    );
    if (
      changedPathAssociations > authorization.limits.maxFilesPerRepository ||
      changedPathBytes > authorization.limits.maxTotalBytesPerRepository
    ) {
      throw new GitCollectorFault("limit-exceeded", false);
    }
    commits.push(deepFreeze({ ...parsed, changedPaths }));
  }

  const after = await snapshotObjectStore(
    objectDirectory.canonicalPath,
    rootPath,
    repository.canonicalPath,
    platform,
    authorization.limits,
    clock,
  );
  if (
    before.fingerprint !== after.fingerprint ||
    before.entryCount !== after.entryCount ||
    before.totalBytes !== after.totalBytes
  ) {
    throw new GitCollectorFault("not-authorized", false);
  }

  return deepFreeze({
    repositoryId: repository.repositoryId,
    rootId: repository.rootId,
    objectFormat,
    headObjectId: head,
    shallow: shallowObjectIds.length > 0,
    historyTruncated,
    totalCommitBytes,
    commits,
  });
}

async function executeGit(
  context: CollectionContext,
  objectDirectory: string,
  objectFormat: GitObjectFormat,
  shallowObjectIds: readonly string[],
  arguments_: readonly string[],
  input: Uint8Array,
): Promise<Uint8Array> {
  const remainingOutput =
    context.authorization.limits.maxTotalBytesPerRepository - context.commandOutputBytes;
  if (remainingOutput < 1) throw new GitCollectorFault("limit-exceeded", false);
  context.clock.check();
  const result = await context.commandPort.run({
    arguments: arguments_,
    input,
    objectDirectory,
    objectFormat,
    shallowObjectIds,
    maximumOutputBytes: remainingOutput,
    timeoutMs: context.clock.remainingMs(),
    platform: context.authorization.platform,
  });
  context.clock.check();
  if (!isCommandResult(result)) throw new GitCollectorFault("invalid-input", false);
  if (!result.ok) throw commandFailure(result.reason);
  context.commandOutputBytes += result.output.byteLength;
  if (context.commandOutputBytes > context.authorization.limits.maxTotalBytesPerRepository) {
    throw new GitCollectorFault("limit-exceeded", false);
  }
  return result.output;
}

function commandFailure(reason: BoundedGitCommandFailureReason): GitCollectorFault {
  if (reason === "unavailable") return new GitCollectorFault("git-unavailable", true);
  if (reason === "limit-exceeded") return new GitCollectorFault("limit-exceeded", false);
  if (reason === "deadline-exceeded") return new GitCollectorFault("deadline-exceeded", true);
  if (reason === "invalid-request") return new GitCollectorFault("invalid-input", false);
  return new GitCollectorFault("invalid-metadata", false);
}

function parseRevisionList(
  bytes: Uint8Array,
  objectFormat: GitObjectFormat,
  maximumRecords: number,
  head: string,
): readonly RevisionRecord[] {
  const text = decodeUtf8(bytes);
  if (text.includes("\0") || containsUnsafeControl(text, true)) {
    throw new GitCollectorFault("invalid-metadata", false);
  }
  const lines = text === "" ? [] : text.replace(/\n$/u, "").split("\n");
  if (lines.length > maximumRecords) throw new GitCollectorFault("limit-exceeded", false);
  const seen = new Set<string>();
  const records = lines.map((line) => {
    const fields = line.split(" ");
    const objectId = fields[0];
    const parents = fields.slice(1);
    if (
      objectId === undefined ||
      !isObjectIdForFormat(objectId, objectFormat) ||
      parents.length > gitMetadataHardLimits.maxParentsPerCommit ||
      parents.some((parent) => !isObjectIdForFormat(parent, objectFormat)) ||
      seen.has(objectId)
    ) {
      throw new GitCollectorFault("invalid-metadata", false);
    }
    seen.add(objectId);
    return Object.freeze({ objectId, parentObjectIds: Object.freeze(parents) });
  });
  if (records[0]?.objectId !== head) throw new GitCollectorFault("invalid-metadata", false);
  return Object.freeze(records);
}

function parseBatchCheck(
  bytes: Uint8Array,
  revisions: readonly RevisionRecord[],
  objectFormat: GitObjectFormat,
  maximumObjectBytes: number,
  maximumTotalBytes: number,
): readonly CommitObjectInfo[] {
  const text = decodeUtf8(bytes);
  if (text.includes("\0") || containsUnsafeControl(text, true)) {
    throw new GitCollectorFault("invalid-metadata", false);
  }
  const lines = text === "" ? [] : text.replace(/\n$/u, "").split("\n");
  if (lines.length !== revisions.length) throw new GitCollectorFault("invalid-metadata", false);
  let total = 0;
  const result = lines.map((line, index) => {
    const match = line.match(/^([0-9a-f]+) commit ([1-9][0-9]*)$/u);
    const revision = revisions[index];
    if (
      match === null ||
      revision === undefined ||
      match[1] !== revision.objectId ||
      !isObjectIdForFormat(match[1], objectFormat)
    ) {
      throw new GitCollectorFault("invalid-metadata", false);
    }
    const sizeBytes = Number(match[2]);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes > maximumObjectBytes) {
      throw new GitCollectorFault("limit-exceeded", false);
    }
    total += sizeBytes;
    if (total > maximumTotalBytes) throw new GitCollectorFault("limit-exceeded", false);
    return Object.freeze({ objectId: revision.objectId, sizeBytes });
  });
  return Object.freeze(result);
}

function parseBatchOutput(
  bytes: Uint8Array,
  expected: readonly CommitObjectInfo[],
): readonly Uint8Array[] {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const bodies: Uint8Array[] = [];
  let offset = 0;
  for (const item of expected) {
    const newline = buffer.indexOf(0x0a, offset);
    if (newline < 0) throw new GitCollectorFault("invalid-metadata", false);
    const header = buffer.subarray(offset, newline).toString("ascii");
    if (header !== `${item.objectId} commit ${String(item.sizeBytes)}`) {
      throw new GitCollectorFault("invalid-metadata", false);
    }
    const bodyStart = newline + 1;
    const bodyEnd = bodyStart + item.sizeBytes;
    if (bodyEnd >= buffer.byteLength || buffer[bodyEnd] !== 0x0a) {
      throw new GitCollectorFault("invalid-metadata", false);
    }
    bodies.push(buffer.subarray(bodyStart, bodyEnd));
    offset = bodyEnd + 1;
  }
  if (offset !== buffer.byteLength) throw new GitCollectorFault("invalid-metadata", false);
  return Object.freeze(bodies);
}

function parseCommitObject(
  bytes: Uint8Array,
  revision: RevisionRecord,
  objectFormat: GitObjectFormat,
  shallowObjectIds: readonly string[],
): Omit<GitCommitMetadata, "changedPaths"> {
  const text = decodeUtf8(bytes);
  if (text.includes("\0")) throw new GitCollectorFault("invalid-metadata", false);
  const separator = text.indexOf("\n\n");
  if (separator < 0) throw new GitCollectorFault("invalid-metadata", false);
  const headerLines = text.slice(0, separator).split("\n");
  const messageLines = text.slice(separator + 2).split(/\r?\n/u);
  const trees = headerLines.filter((line) => line.startsWith("tree "));
  const parents = headerLines
    .filter((line) => line.startsWith("parent "))
    .map((line) => line.slice(7));
  const authors = headerLines.filter((line) => line.startsWith("author "));
  const committers = headerLines.filter((line) => line.startsWith("committer "));
  if (
    trees.length !== 1 ||
    !isObjectIdForFormat(trees[0]?.slice(5) ?? "", objectFormat) ||
    parents.length > gitMetadataHardLimits.maxParentsPerCommit ||
    parents.some((parent) => !isObjectIdForFormat(parent, objectFormat)) ||
    authors.length !== 1 ||
    committers.length !== 1
  ) {
    throw new GitCollectorFault("invalid-metadata", false);
  }
  const isShallowBoundary = shallowObjectIds.includes(revision.objectId);
  if (
    (!isShallowBoundary && !equalArrays(parents, revision.parentObjectIds)) ||
    (isShallowBoundary && revision.parentObjectIds.length !== 0)
  ) {
    throw new GitCollectorFault("invalid-metadata", false);
  }
  const author = parseIdentityHeader(authors[0] ?? "", "author ");
  const committer = parseIdentityHeader(committers[0] ?? "", "committer ");
  const coauthors = new Set<string>();
  for (const line of messageLines) {
    const match = line.match(/^Co-authored-by:\s*(.+)\s+<([^<>\r\n]+)>\s*$/iu);
    if (match === null) continue;
    const name = match[1];
    const email = match[2];
    if (name === undefined || email === undefined) continue;
    coauthors.add(requireIdentityDigest(name, email));
    if (coauthors.size > gitMetadataHardLimits.maxCoauthorsPerCommit) {
      throw new GitCollectorFault("limit-exceeded", false);
    }
  }
  return deepFreeze({
    objectId: revision.objectId,
    parentObjectIds: [...revision.parentObjectIds],
    authoredAt: author.timestamp,
    committedAt: committer.timestamp,
    authorIdentityDigest: author.digest,
    committerIdentityDigest: committer.digest,
    coauthorIdentityDigests: [...coauthors].sort(compareText),
  });
}

function parseIdentityHeader(line: string, prefix: "author " | "committer "): ParsedCommitIdentity {
  if (
    !line.startsWith(prefix) ||
    Buffer.byteLength(line, "utf8") > gitMetadataHardLimits.maxIdentityBytes + 64
  ) {
    throw new GitCollectorFault("invalid-metadata", false);
  }
  const match = line
    .slice(prefix.length)
    .match(/^(.+) <([^<>\r\n]+)> (-?[0-9]+) ([+-])([0-9]{2})([0-9]{2})$/u);
  if (match === null) throw new GitCollectorFault("invalid-metadata", false);
  const name = match[1];
  const email = match[2];
  const secondsText = match[3];
  const hoursText = match[5];
  const minutesText = match[6];
  if (
    name === undefined ||
    email === undefined ||
    secondsText === undefined ||
    hoursText === undefined ||
    minutesText === undefined ||
    Number(hoursText) > 23 ||
    Number(minutesText) > 59
  ) {
    throw new GitCollectorFault("invalid-metadata", false);
  }
  const seconds = Number(secondsText);
  const milliseconds = seconds * 1_000;
  if (!Number.isSafeInteger(seconds) || !Number.isFinite(milliseconds)) {
    throw new GitCollectorFault("invalid-metadata", false);
  }
  let timestamp: string;
  try {
    timestamp = new Date(milliseconds).toISOString();
  } catch {
    throw new GitCollectorFault("invalid-metadata", false);
  }
  return Object.freeze({ digest: requireIdentityDigest(name, email), timestamp });
}

function requireIdentityDigest(name: string, email: string): string {
  const digest = digestGitIdentity(name, email);
  if (digest === undefined) throw new GitCollectorFault("invalid-metadata", false);
  return digest;
}

function parseChangedPaths(bytes: Uint8Array): readonly string[] {
  if (bytes.byteLength === 0) return Object.freeze([]);
  if (bytes.at(-1) !== 0) throw new GitCollectorFault("invalid-metadata", false);
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const paths = new Set<string>();
  let offset = 0;
  while (offset < buffer.byteLength) {
    const delimiter = buffer.indexOf(0, offset);
    if (delimiter < 0) throw new GitCollectorFault("invalid-metadata", false);
    const value = decodeUtf8(buffer.subarray(offset, delimiter));
    if (!isSafeRepositoryRelativePath(value)) {
      throw new GitCollectorFault("invalid-metadata", false);
    }
    paths.add(value);
    offset = delimiter + 1;
  }
  return Object.freeze([...paths].sort(compareText));
}

async function resolveHead(input: ControlFileContext): Promise<string> {
  const headBytes = await readControlFile(
    input,
    "HEAD",
    Math.min(gitMetadataHardLimits.maxHeadBytes, input.limits.maxBytesPerFile),
    false,
  );
  if (headBytes === undefined) throw new GitCollectorFault("unsupported-repository", false);
  let value = decodeSingleControlLine(headBytes);
  const seen = new Set<string>();
  for (let depth = 0; depth < 8; depth += 1) {
    if (objectIdPattern.test(value)) return value;
    if (!value.startsWith("ref: ")) throw new GitCollectorFault("invalid-metadata", false);
    const reference = value.slice(5);
    if (
      !reference.startsWith("refs/heads/") ||
      !isSafeGitReference(reference) ||
      seen.has(reference)
    ) {
      throw new GitCollectorFault("invalid-metadata", false);
    }
    seen.add(reference);
    const loose = await readControlFile(
      input,
      reference,
      Math.min(gitMetadataHardLimits.maxHeadBytes, input.limits.maxBytesPerFile),
      true,
    );
    if (loose !== undefined) {
      value = decodeSingleControlLine(loose);
      continue;
    }
    const packed = await readControlFile(input, "packed-refs", input.limits.maxBytesPerFile, true);
    if (packed === undefined) throw new GitCollectorFault("invalid-metadata", false);
    const objectId = findPackedReference(packed, reference, input.limits.maxFilesPerRepository);
    if (objectId === undefined) throw new GitCollectorFault("invalid-metadata", false);
    return objectId;
  }
  throw new GitCollectorFault("limit-exceeded", false);
}

function findPackedReference(
  bytes: Uint8Array,
  expectedReference: string,
  maximumReferences: number,
): string | undefined {
  const text = decodeUtf8(bytes);
  if (text.includes("\0") || containsUnsafeControl(text, true)) {
    throw new GitCollectorFault("invalid-metadata", false);
  }
  const lines = text.split("\n");
  let count = 0;
  let found: string | undefined;
  for (const line of lines) {
    if (line === "" || line.startsWith("#")) continue;
    if (line.startsWith("^")) {
      if (!objectIdPattern.test(line.slice(1)))
        throw new GitCollectorFault("invalid-metadata", false);
      continue;
    }
    const separator = line.indexOf(" ");
    if (separator < 1) throw new GitCollectorFault("invalid-metadata", false);
    const objectId = line.slice(0, separator);
    const reference = line.slice(separator + 1);
    if (!objectIdPattern.test(objectId) || !isSafeGitReference(reference)) {
      throw new GitCollectorFault("invalid-metadata", false);
    }
    count += 1;
    if (count > maximumReferences) throw new GitCollectorFault("limit-exceeded", false);
    if (reference === expectedReference) found = objectId;
  }
  return found;
}

interface ControlFileContext {
  readonly gitDirectory: string;
  readonly rootPath: string;
  readonly repositoryPath: string;
  readonly platform: LocalPathPlatform;
  readonly limits: ResolvedAuthorizedRepositoryConfig["limits"];
  readonly clock: DeadlineClock;
}

async function readShallowBoundary(
  input: ControlFileContext & { readonly objectFormat: GitObjectFormat },
): Promise<readonly string[]> {
  const bytes = await readControlFile(input, "shallow", input.limits.maxBytesPerFile, true);
  if (bytes === undefined) return Object.freeze([]);
  const text = decodeUtf8(bytes);
  if (text.includes("\0") || containsUnsafeControl(text, true)) {
    throw new GitCollectorFault("invalid-metadata", false);
  }
  const lines = text.replace(/\n$/u, "").split("\n");
  if (
    lines.length > gitMetadataHardLimits.maxCommits ||
    lines.some((line) => !isObjectIdForFormat(line, input.objectFormat))
  ) {
    throw new GitCollectorFault("invalid-metadata", false);
  }
  return Object.freeze([...new Set(lines)].sort(compareText));
}

async function readControlFile(
  input: ControlFileContext,
  relativePath: string,
  maximumBytes: number,
  optional: boolean,
): Promise<Uint8Array | undefined> {
  if (!isSafeRepositoryRelativePath(relativePath) || maximumBytes < 1) {
    throw new GitCollectorFault("invalid-input", false);
  }
  const candidate = joinRelativePath(input.gitDirectory, relativePath, input.platform);
  let before: Awaited<ReturnType<typeof lstat>>;
  try {
    before = await checked(input.clock, () => lstat(candidate, { bigint: true }));
  } catch (error) {
    if (optional && isMissingPathError(error)) return undefined;
    throw error;
  }
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new GitCollectorFault("not-authorized", false);
  }
  if (before.size > BigInt(maximumBytes)) throw new GitCollectorFault("limit-exceeded", false);
  const canonicalPath = normalizeAbsolute(
    await checked(input.clock, () => realpath(candidate)),
    input.platform,
  );
  if (identityFor(canonicalPath, input.platform) !== identityFor(candidate, input.platform)) {
    throw new GitCollectorFault("not-authorized", false);
  }
  requireContained(input.rootPath, canonicalPath, input.platform);
  requireContained(input.repositoryPath, canonicalPath, input.platform);
  requireContained(input.gitDirectory, canonicalPath, input.platform);

  const handle = await checked(input.clock, () => open(canonicalPath, "r"));
  try {
    const opened = await checked(input.clock, () => handle.stat({ bigint: true }));
    if (!sameFileState(before, opened)) throw new GitCollectorFault("not-authorized", false);
    const chunks: Buffer[] = [];
    let total = 0;
    while (total <= maximumBytes) {
      const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, maximumBytes + 1 - total));
      if (buffer.byteLength === 0) break;
      const read = await checked(input.clock, () =>
        handle.read(buffer, 0, buffer.byteLength, null),
      );
      if (read.bytesRead === 0) break;
      chunks.push(buffer.subarray(0, read.bytesRead));
      total += read.bytesRead;
    }
    if (total > maximumBytes) throw new GitCollectorFault("limit-exceeded", false);
    const afterOpened = await checked(input.clock, () => handle.stat({ bigint: true }));
    const afterPath = await checked(input.clock, () => lstat(canonicalPath, { bigint: true }));
    const afterCanonical = normalizeAbsolute(
      await checked(input.clock, () => realpath(canonicalPath)),
      input.platform,
    );
    if (
      !sameFileState(opened, afterOpened) ||
      !sameFileState(opened, afterPath) ||
      afterOpened.size !== BigInt(total) ||
      identityFor(afterCanonical, input.platform) !== identityFor(canonicalPath, input.platform)
    ) {
      throw new GitCollectorFault("not-authorized", false);
    }
    return Buffer.concat(chunks, total);
  } finally {
    await handle.close().catch(() => undefined);
  }
}

async function snapshotObjectStore(
  objectDirectory: string,
  rootPath: string,
  repositoryPath: string,
  platform: LocalPathPlatform,
  limits: ResolvedAuthorizedRepositoryConfig["limits"],
  clock: DeadlineClock,
): Promise<ObjectStoreSnapshot> {
  const records: string[] = [];
  let entryCount = 0;
  let totalBytes = 0;

  const visit = async (
    directory: string,
    relativeDirectory: string,
    depth: number,
  ): Promise<void> => {
    if (depth > limits.maxDepth) throw new GitCollectorFault("limit-exceeded", false);
    const names = await readDirectoryNames(
      directory,
      limits.maxFilesPerRepository - entryCount,
      clock,
    );
    for (const name of names) {
      clock.check();
      if (!isSafeEntryName(name)) throw new GitCollectorFault("not-authorized", false);
      entryCount += 1;
      if (entryCount > limits.maxFilesPerRepository) {
        throw new GitCollectorFault("limit-exceeded", false);
      }
      const relativePath = relativeDirectory === "" ? name : `${relativeDirectory}/${name}`;
      if (
        (platform === "win32" ? relativePath.toLowerCase() : relativePath) === "info/alternates" ||
        (platform === "win32" ? relativePath.toLowerCase() : relativePath) ===
          "info/http-alternates"
      ) {
        throw new GitCollectorFault("unsupported-repository", false);
      }
      const candidate = joinPath(directory, name, platform);
      const before = await checked(clock, () => lstat(candidate, { bigint: true }));
      if (before.isSymbolicLink()) throw new GitCollectorFault("not-authorized", false);
      const canonicalPath = normalizeAbsolute(
        await checked(clock, () => realpath(candidate)),
        platform,
      );
      if (identityFor(canonicalPath, platform) !== identityFor(candidate, platform)) {
        throw new GitCollectorFault("not-authorized", false);
      }
      requireContained(rootPath, canonicalPath, platform);
      requireContained(repositoryPath, canonicalPath, platform);
      requireContained(objectDirectory, canonicalPath, platform);
      const metadata = await checked(clock, () => stat(canonicalPath, { bigint: true }));
      if (metadata.dev !== before.dev || metadata.ino !== before.ino) {
        throw new GitCollectorFault("not-authorized", false);
      }
      const kind = metadata.isDirectory() ? "directory" : metadata.isFile() ? "file" : "other";
      if (kind === "other") throw new GitCollectorFault("not-authorized", false);
      if (kind === "file") {
        if (metadata.size > BigInt(Number.MAX_SAFE_INTEGER)) {
          throw new GitCollectorFault("limit-exceeded", false);
        }
        totalBytes += Number(metadata.size);
        if (totalBytes > limits.maxTotalBytesPerRepository) {
          throw new GitCollectorFault("limit-exceeded", false);
        }
      }
      records.push(
        [
          relativePath,
          kind,
          metadata.dev.toString(),
          metadata.ino.toString(),
          metadata.size.toString(),
          metadata.mtimeNs.toString(),
          metadata.ctimeNs.toString(),
        ].join("\0"),
      );
      if (kind === "directory") await visit(canonicalPath, relativePath, depth + 1);
    }
  };

  await visit(objectDirectory, "", 0);
  return Object.freeze({
    fingerprint: createHash("sha256").update(records.join("\n"), "utf8").digest("hex"),
    entryCount,
    totalBytes,
  });
}

async function readDirectoryNames(
  directoryPath: string,
  maximumEntries: number,
  clock: DeadlineClock,
): Promise<readonly string[]> {
  if (maximumEntries < 0) throw new GitCollectorFault("limit-exceeded", false);
  const directory = await checked(clock, () => opendir(directoryPath));
  const names: string[] = [];
  try {
    for await (const entry of directory) {
      names.push(entry.name);
      if (names.length > maximumEntries) throw new GitCollectorFault("limit-exceeded", false);
      clock.check();
    }
  } finally {
    await directory.close().catch(() => undefined);
  }
  return Object.freeze(names.sort(compareText));
}

async function requireAuthorizedDirectory(
  candidatePath: string,
  expectedIdentity: string,
  platform: LocalPathPlatform,
  clock: DeadlineClock,
): Promise<void> {
  const inspected = await inspectPath(candidatePath, platform, clock);
  if (inspected.kind !== "directory" || inspected.pathIdentity !== expectedIdentity) {
    throw new GitCollectorFault("not-authorized", false);
  }
}

async function inspectPath(
  candidatePath: string,
  platform: LocalPathPlatform,
  clock: DeadlineClock,
): Promise<{
  readonly canonicalPath: string;
  readonly pathIdentity: string;
  readonly kind: "file" | "directory" | "symbolic-link" | "other";
}> {
  const initial = await checked(clock, () => lstat(candidatePath, { bigint: true }));
  if (initial.isSymbolicLink()) {
    return Object.freeze({
      canonicalPath: normalizeAbsolute(candidatePath, platform),
      pathIdentity: identityFor(candidatePath, platform),
      kind: "symbolic-link" as const,
    });
  }
  const canonicalPath = normalizeAbsolute(
    await checked(clock, () => realpath(candidatePath)),
    platform,
  );
  const metadata = await checked(clock, () => stat(canonicalPath, { bigint: true }));
  if (metadata.dev !== initial.dev || metadata.ino !== initial.ino) {
    throw new GitCollectorFault("not-authorized", false);
  }
  return Object.freeze({
    canonicalPath,
    pathIdentity: identityFor(canonicalPath, platform),
    kind: metadata.isFile() ? "file" : metadata.isDirectory() ? "directory" : "other",
  });
}

async function pathEntryExists(
  directory: string,
  entryName: string,
  clock: DeadlineClock,
): Promise<boolean> {
  if (!isSafeEntryName(entryName)) throw new GitCollectorFault("invalid-input", false);
  try {
    await checked(clock, () => lstat(path.join(directory, entryName)));
    return true;
  } catch (error) {
    if (isMissingPathError(error)) return false;
    throw error;
  }
}

function createDeadlineClock(
  now: () => number,
  startedAt: number,
  maximumDurationMs: number,
): DeadlineClock {
  let previous = startedAt;
  const current = (): number => {
    const value = readClock(now);
    if (value < previous) throw new GitCollectorFault("invalid-input", false);
    previous = value;
    if (value - startedAt >= maximumDurationMs) {
      throw new GitCollectorFault("deadline-exceeded", true);
    }
    return value;
  };
  return Object.freeze({
    check() {
      current();
    },
    remainingMs() {
      return Math.max(1, Math.floor(maximumDurationMs - (current() - startedAt)));
    },
  });
}

async function checked<Value>(
  clock: DeadlineClock,
  operation: () => Promise<Value>,
): Promise<Value> {
  clock.check();
  const value = await operation();
  clock.check();
  return value;
}

function readClock(now: () => number): number {
  let value: number;
  try {
    value = now();
  } catch {
    throw new GitCollectorFault("invalid-input", false);
  }
  if (!Number.isFinite(value) || value < 0) throw new GitCollectorFault("invalid-input", false);
  return value;
}

function decodeSingleControlLine(bytes: Uint8Array): string {
  const text = decodeUtf8(bytes);
  if (text.includes("\0") || containsUnsafeControl(text, true)) {
    throw new GitCollectorFault("invalid-metadata", false);
  }
  const value = text.replace(/\r?\n$/u, "");
  if (value.length === 0 || /[\r\n]/u.test(value)) {
    throw new GitCollectorFault("invalid-metadata", false);
  }
  return value;
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return utf8Decoder.decode(bytes);
  } catch {
    throw new GitCollectorFault("invalid-metadata", false);
  }
}

function encodeObjectIds(objectIds: readonly string[]): Uint8Array {
  return Buffer.from(`${objectIds.join("\n")}\n`, "ascii");
}

function objectFormatFor(objectId: string): GitObjectFormat {
  if (!objectIdPattern.test(objectId)) throw new GitCollectorFault("invalid-metadata", false);
  return objectId.length === 40 ? "sha1" : "sha256";
}

function isObjectIdForFormat(value: string, format: GitObjectFormat): boolean {
  return value.length === (format === "sha1" ? 40 : 64) && /^[0-9a-f]+$/u.test(value);
}

function isSafeGitReference(value: string): boolean {
  if (
    !value.startsWith("refs/") ||
    Buffer.byteLength(value, "utf8") > localRepositoryConfigHardLimits.maxRelativePathBytes ||
    containsUnsafeControl(value, false) ||
    /[\\~^:?*[]/u.test(value) ||
    value.includes("..") ||
    value.includes("@{") ||
    value.endsWith(".") ||
    value.endsWith(".lock")
  ) {
    return false;
  }
  return value.split("/").every((segment) => segment !== "" && segment !== ".");
}

function isSafeRepositoryRelativePath(value: string): boolean {
  if (
    value.length === 0 ||
    value.startsWith("/") ||
    Buffer.byteLength(value, "utf8") > localRepositoryConfigHardLimits.maxRelativePathBytes ||
    containsUnsafeControl(value, false) ||
    /[\\:]/u.test(value)
  ) {
    return false;
  }
  return value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function isSafeEntryName(value: string): boolean {
  return (
    value.length > 0 &&
    value !== "." &&
    value !== ".." &&
    !/[\\/:]/u.test(value) &&
    !containsUnsafeControl(value, false)
  );
}

function containsUnsafeControl(value: string, allowLineFeed: boolean): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if ((codeUnit <= 0x1f && !(allowLineFeed && codeUnit === 0x0a)) || codeUnit === 0x7f) {
      return true;
    }
  }
  return false;
}

function sameFileState(left: BigIntStats, right: BigIntStats): boolean {
  return (
    left.isFile() &&
    right.isFile() &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function requireContained(
  rootPath: string,
  candidatePath: string,
  platform: LocalPathPlatform,
): void {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const root = normalizeAbsolute(rootPath, platform);
  const candidate = normalizeAbsolute(candidatePath, platform);
  const relative = pathApi.relative(root, candidate);
  if (
    relative === ".." ||
    relative.startsWith(`..${pathApi.sep}`) ||
    pathApi.isAbsolute(relative)
  ) {
    throw new GitCollectorFault("not-authorized", false);
  }
}

function normalizeAbsolute(value: string, platform: LocalPathPlatform): string {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  if (
    typeof value !== "string" ||
    !pathApi.isAbsolute(value) ||
    containsUnsafeControl(value, false)
  ) {
    throw new GitCollectorFault("path-unavailable", true);
  }
  return pathApi.normalize(value);
}

function identityFor(value: string, platform: LocalPathPlatform): string {
  const normalized = normalizeAbsolute(value, platform);
  return platform === "win32" ? normalized.toLowerCase() : normalized;
}

function joinPath(directory: string, name: string, platform: LocalPathPlatform): string {
  return (platform === "win32" ? path.win32 : path.posix).join(directory, name);
}

function joinRelativePath(
  directory: string,
  relativePath: string,
  platform: LocalPathPlatform,
): string {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  return pathApi.join(directory, ...relativePath.split("/"));
}

function isMissingPathError(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    (value.code === "ENOENT" || value.code === "ENOTDIR")
  );
}

function isCommandPort(value: unknown): value is BoundedGitCommandPort {
  return (
    typeof value === "object" && value !== null && "run" in value && typeof value.run === "function"
  );
}

function isCommandResult(
  value: unknown,
): value is Awaited<ReturnType<BoundedGitCommandPort["run"]>> {
  if (typeof value !== "object" || value === null || !("ok" in value)) return false;
  if (value.ok === true) return "output" in value && value.output instanceof Uint8Array;
  return (
    value.ok === false &&
    "reason" in value &&
    (value.reason === "invalid-request" ||
      value.reason === "unavailable" ||
      value.reason === "failed" ||
      value.reason === "limit-exceeded" ||
      value.reason === "deadline-exceeded")
  );
}

function equalArrays(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function failure(category: GitMetadataErrorCategory, retryable: boolean): CollectGitMetadataResult {
  return Object.freeze({ ok: false, error: Object.freeze({ category, retryable }) });
}

function deepFreeze<Value>(value: Value): Value {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
