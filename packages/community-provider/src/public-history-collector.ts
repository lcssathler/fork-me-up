import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { TextDecoder } from "node:util";

import {
  isIssuedAuthorizedRepositoryConfig,
  localRepositoryConfigHardLimits,
  type ResolvedAuthorizedRepositoryConfig,
} from "./authorized-repository-config.ts";
import type { BoundedGitCommandPort } from "./bounded-git-command.ts";
import { digestGitIdentity } from "./git-identity.ts";
import {
  collectGitMetadata,
  gitMetadataHardLimits,
  gitMetadataSnapshotVersion,
  type CollectGitMetadataResult,
  type GitCommitMetadata,
  type GitMetadataErrorCategory,
  type GitMetadataSnapshot,
} from "./git-metadata-collector.ts";
import {
  isIssuedPublicHistoryConfig,
  isIssuedPublicHistoryConfigForRepository,
  publicHistoryConfigHardLimits,
  type ResolvedPublicHistoryConfig,
  type ResolvedPublicHistoryRepository,
} from "./public-history-config.ts";

export interface GitHubPublicHistoryRequest {
  readonly endpoint: string;
  readonly maximumOutputBytes: number;
  readonly timeoutMs: number;
}

export type GitHubPublicHistoryFailureReason =
  "invalid-request" | "unavailable" | "failed" | "limit-exceeded" | "deadline-exceeded";

export type GitHubPublicHistoryPortResult =
  | { readonly ok: true; readonly output: Uint8Array }
  | {
      readonly ok: false;
      readonly reason: GitHubPublicHistoryFailureReason;
    };

export interface GitHubPublicHistoryPort {
  get(request: GitHubPublicHistoryRequest): Promise<GitHubPublicHistoryPortResult>;
}

export type GitHubHistoryStatus =
  "disabled" | "not-needed" | "expired" | "used" | "unavailable" | "rejected";

export type CollectPublicHistoryResult =
  | {
      readonly ok: true;
      readonly value: GitMetadataSnapshot;
      readonly historySource: "local-git" | "github";
      readonly githubStatus: GitHubHistoryStatus;
      readonly networkRequests: number;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly category: GitMetadataErrorCategory;
        readonly retryable: boolean;
      };
      readonly githubStatus: GitHubHistoryStatus;
      readonly networkRequests: number;
    };

type RemoteFailureCategory =
  | "invalid-input"
  | "not-authorized"
  | "unavailable"
  | "invalid-response"
  | "limit-exceeded"
  | "deadline-exceeded";

type RemoteResult =
  | { readonly ok: true; readonly value: GitMetadataSnapshot; readonly requests: number }
  | {
      readonly ok: false;
      readonly category: RemoteFailureCategory;
      readonly requests: number;
    };

interface ParsedCommit {
  readonly identity: Omit<GitCommitMetadata, "changedPaths">;
  readonly changedPaths: readonly string[];
  readonly accountedBytes: number;
}

const decoder = new TextDecoder("utf-8", { fatal: true });
const sha1Pattern = /^[0-9a-f]{40}$/u;
const safeEndpointPattern =
  /^\/repos\/(?![A-Za-z0-9-]*--)[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9_-])?(?:\/commits\/[0-9a-f]{40}\?per_page=100&page=[1-4])?$/u;

export const nodeGitHubPublicHistoryPort: GitHubPublicHistoryPort = Object.freeze({
  async get(request: GitHubPublicHistoryRequest): Promise<GitHubPublicHistoryPortResult> {
    if (!validPortRequest(request)) return Object.freeze({ ok: false, reason: "invalid-request" });
    return new Promise((resolve) => {
      let settled = false;
      let timedOut = false;
      let exceeded = false;
      let outputBytes = 0;
      let standardOutputBytes = 0;
      const chunks: Buffer[] = [];
      const child = spawn(
        "gh",
        [
          "api",
          "--method",
          "GET",
          "--hostname",
          "github.com",
          "--header",
          "Accept: application/vnd.github+json",
          "--header",
          "X-GitHub-Api-Version: 2022-11-28",
          request.endpoint,
        ],
        {
          env: {
            ...process.env,
            GH_PROMPT_DISABLED: "1",
            GH_PAGER: "cat",
            PAGER: "cat",
            NO_COLOR: "1",
          },
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        },
      );
      const finish = (result: GitHubPublicHistoryPortResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(Object.freeze(result));
      };
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
        finish({ ok: false, reason: "deadline-exceeded" });
      }, request.timeoutMs);
      const account = (chunk: Buffer, retain: boolean): void => {
        outputBytes += chunk.byteLength;
        if (outputBytes > request.maximumOutputBytes) {
          exceeded = true;
          child.kill();
          return;
        }
        if (retain) {
          standardOutputBytes += chunk.byteLength;
          chunks.push(chunk);
        }
      };
      child.stdout.on("data", (chunk: Buffer) => account(chunk, true));
      child.stderr.on("data", (chunk: Buffer) => account(chunk, false));
      child.on("error", (error: NodeJS.ErrnoException) => {
        finish({ ok: false, reason: error.code === "ENOENT" ? "unavailable" : "failed" });
      });
      child.on("close", (code) => {
        if (timedOut) finish({ ok: false, reason: "deadline-exceeded" });
        else if (exceeded) finish({ ok: false, reason: "limit-exceeded" });
        else if (code !== 0) finish({ ok: false, reason: "unavailable" });
        else finish({ ok: true, output: Buffer.concat(chunks, standardOutputBytes) });
      });
    });
  },
});

export async function collectPublicHistory(
  authorization: ResolvedAuthorizedRepositoryConfig,
  policy: ResolvedPublicHistoryConfig | null,
  observedAt: string,
  options: {
    readonly commandPort?: BoundedGitCommandPort;
    readonly githubPort?: GitHubPublicHistoryPort;
    readonly now?: () => number;
    readonly wallClock?: () => number;
  } = {},
): Promise<CollectPublicHistoryResult> {
  if (
    !isIssuedAuthorizedRepositoryConfig(authorization) ||
    authorization.repositories.length !== 1 ||
    !timestamp(observedAt) ||
    !(policy === null || isIssuedPublicHistoryConfig(policy))
  ) {
    return resultFailure("invalid-input", false, "rejected", 0);
  }
  const now = options.now ?? (() => performance.now());
  let startedAt: number;
  try {
    startedAt = clock(now);
  } catch {
    return resultFailure("invalid-input", false, "rejected", 0);
  }
  const local = await collectGitMetadata(authorization, {
    ...(options.commandPort === undefined ? {} : { commandPort: options.commandPort }),
    now,
  });
  const repository = authorization.repositories[0];
  if (repository === undefined) return resultFailure("invalid-input", false, "rejected", 0);
  const mapping = policy?.github.repositories.find(
    (candidate) => candidate.repositoryId === repository.repositoryId,
  );
  if (policy === null || mapping === undefined) return localResult(local, "disabled");
  if (
    mapping.rootId !== repository.rootId ||
    !isIssuedPublicHistoryConfigForRepository(policy, repository)
  ) {
    return resultFailure("not-authorized", false, "rejected", 0);
  }
  const localRepository = local.ok ? local.value.repositories[0] : undefined;
  if (local.ok && localRepository !== undefined && !localRepository.shallow) {
    return localResult(local, "not-needed");
  }
  let consentTime: number;
  try {
    consentTime = readWallClock(options.wallClock ?? (() => Date.now()));
  } catch {
    return local.ok
      ? localResult(local, "rejected")
      : resultFailure("invalid-input", false, "rejected", 0);
  }
  if (
    consentTime < Date.parse(policy.github.consent.issuedAt) ||
    consentTime >= Date.parse(policy.github.consent.expiresAt)
  ) {
    return local.ok
      ? localResult(local, "expired")
      : resultFailure(local.error.category, local.error.retryable, "expired", 0);
  }
  if (!local.ok && !fallbackEligible(local.error.category)) {
    return resultFailure(local.error.category, local.error.retryable, "not-needed", 0);
  }
  const expectedHead = localRepository?.headObjectId ?? mapping.expectedHeadObjectId;
  if (
    expectedHead === null ||
    expectedHead === undefined ||
    (mapping.expectedHeadObjectId !== null && mapping.expectedHeadObjectId !== expectedHead)
  ) {
    return local.ok
      ? localResult(local, "rejected")
      : resultFailure("not-authorized", false, "rejected", 0);
  }
  let maximumDurationMs: number;
  try {
    const current = clock(now);
    if (current < startedAt) return resultFailure("invalid-input", false, "rejected", 0);
    maximumDurationMs = Math.min(
      policy.github.limits.maxDurationMs,
      Math.floor(authorization.limits.maxDurationMs - (current - startedAt)),
    );
  } catch {
    return resultFailure("invalid-input", false, "rejected", 0);
  }
  if (maximumDurationMs < 1) {
    return local.ok
      ? localResult(local, "unavailable")
      : resultFailure("deadline-exceeded", true, "unavailable", 0);
  }
  const remote = await collectGitHubHistory(
    authorization,
    mapping,
    policy,
    expectedHead,
    options.githubPort ?? nodeGitHubPublicHistoryPort,
    now,
    maximumDurationMs,
  );
  if (remote.ok) {
    return deepFreeze({
      ok: true,
      value: remote.value,
      historySource: "github" as const,
      githubStatus: "used" as const,
      networkRequests: remote.requests,
    });
  }
  const status =
    remote.category === "unavailable" || remote.category === "deadline-exceeded"
      ? "unavailable"
      : "rejected";
  if (local.ok) {
    return deepFreeze({
      ok: true,
      value: local.value,
      historySource: "local-git" as const,
      githubStatus: status,
      networkRequests: remote.requests,
    });
  }
  const mapped = mapRemoteFailure(remote.category);
  return resultFailure(mapped.category, mapped.retryable, status, remote.requests);
}

async function collectGitHubHistory(
  authorization: ResolvedAuthorizedRepositoryConfig,
  mapping: ResolvedPublicHistoryRepository,
  policy: ResolvedPublicHistoryConfig,
  head: string,
  port: GitHubPublicHistoryPort,
  now: () => number,
  maximumDurationMs: number,
): Promise<RemoteResult> {
  let requests = 0;
  let totalResponseBytes = 0;
  try {
    const started = clock(now);
    let last = started;
    const remaining = (): number => {
      const current = clock(now);
      if (current < last) throw new RemoteFault("invalid-input");
      last = current;
      const value = Math.floor(maximumDurationMs - (current - started));
      if (value < 1) throw new RemoteFault("deadline-exceeded");
      return value;
    };
    const read = async (endpoint: string): Promise<unknown> => {
      if (requests >= policy.github.limits.maxRequests) throw new RemoteFault("limit-exceeded");
      requests += 1;
      const response = await port.get({
        endpoint,
        maximumOutputBytes: policy.github.limits.maxResponseBytes,
        timeoutMs: remaining(),
      });
      if (!response.ok) throw new RemoteFault(mapPortFailure(response.reason));
      if (
        !(response.output instanceof Uint8Array) ||
        response.output.byteLength > policy.github.limits.maxResponseBytes
      ) {
        throw new RemoteFault("limit-exceeded");
      }
      totalResponseBytes += response.output.byteLength;
      if (totalResponseBytes > policy.github.limits.maxTotalResponseBytes) {
        throw new RemoteFault("limit-exceeded");
      }
      try {
        return JSON.parse(decoder.decode(response.output));
      } catch {
        throw new RemoteFault("invalid-response");
      }
    };
    const repositoryResponse = await read(`/repos/${mapping.owner}/${mapping.name}`);
    if (
      !record(repositoryResponse) ||
      repositoryResponse["private"] !== false ||
      repositoryResponse["visibility"] !== "public" ||
      typeof repositoryResponse["full_name"] !== "string" ||
      repositoryResponse["full_name"].toLowerCase() !==
        `${mapping.owner}/${mapping.name}`.toLowerCase()
    ) {
      throw new RemoteFault("not-authorized");
    }
    const pending = [head];
    const scheduled = new Set(pending);
    const commits: GitCommitMetadata[] = [];
    let accountedBytes = 0;
    let changedPaths = 0;
    while (pending.length > 0 && commits.length < policy.github.limits.maxCommits) {
      const objectId = pending.shift();
      if (objectId === undefined) break;
      const parsed = await readCommit(mapping, objectId, policy, read);
      commits.push({ ...parsed.identity, changedPaths: parsed.changedPaths });
      accountedBytes += parsed.accountedBytes;
      changedPaths += parsed.changedPaths.length;
      if (
        accountedBytes > authorization.limits.maxTotalBytesPerRepository ||
        changedPaths >
          Math.min(policy.github.limits.maxChangedPaths, authorization.limits.maxFilesPerRepository)
      ) {
        throw new RemoteFault("limit-exceeded");
      }
      for (const parent of parsed.identity.parentObjectIds) {
        if (scheduled.has(parent)) continue;
        scheduled.add(parent);
        pending.push(parent);
      }
    }
    if (commits.length === 0 || commits[0]?.objectId !== head) {
      throw new RemoteFault("invalid-response");
    }
    const value: GitMetadataSnapshot = {
      kind: "git-metadata-snapshot",
      snapshotVersion: gitMetadataSnapshotVersion,
      repositories: [
        {
          repositoryId: mapping.repositoryId,
          rootId: mapping.rootId,
          objectFormat: "sha1",
          headObjectId: head,
          shallow: false,
          historyTruncated: pending.length > 0,
          totalCommitBytes: Math.max(1, accountedBytes),
          commits,
        },
      ],
    };
    return deepFreeze({ ok: true, value, requests });
  } catch (error) {
    return Object.freeze({
      ok: false,
      category: error instanceof RemoteFault ? error.category : "unavailable",
      requests,
    });
  }
}

async function readCommit(
  mapping: ResolvedPublicHistoryRepository,
  objectId: string,
  policy: ResolvedPublicHistoryConfig,
  read: (endpoint: string) => Promise<unknown>,
): Promise<ParsedCommit> {
  let identity: Omit<GitCommitMetadata, "changedPaths"> | null = null;
  let identityKey: string | null = null;
  let accountedBytes = 0;
  const paths = new Set<string>();
  for (let page = 1; page <= policy.github.limits.maxPagesPerCommit; page += 1) {
    const response = await read(
      `/repos/${mapping.owner}/${mapping.name}/commits/${objectId}?per_page=100&page=${String(page)}`,
    );
    const parsed = parseCommitResponse(response, objectId);
    const key = JSON.stringify(parsed.identity);
    if (identityKey !== null && key !== identityKey) throw new RemoteFault("invalid-response");
    identity = parsed.identity;
    identityKey = key;
    if (page === 1) accountedBytes += parsed.accountedBytes;
    for (const filename of parsed.changedPaths) {
      paths.add(filename);
      if (paths.size > policy.github.limits.maxChangedPaths) {
        throw new RemoteFault("limit-exceeded");
      }
    }
    if (parsed.changedPaths.length < 100) break;
    if (page === policy.github.limits.maxPagesPerCommit) {
      throw new RemoteFault("limit-exceeded");
    }
  }
  if (identity === null) throw new RemoteFault("invalid-response");
  const changedPaths = [...paths].sort(compare);
  accountedBytes += changedPaths.reduce((sum, item) => sum + Buffer.byteLength(item, "utf8"), 0);
  return Object.freeze({ identity, changedPaths, accountedBytes });
}

function parseCommitResponse(value: unknown, expectedObjectId: string): ParsedCommit {
  if (
    !record(value) ||
    value["sha"] !== expectedObjectId ||
    !Array.isArray(value["parents"]) ||
    value["parents"].length > gitMetadataHardLimits.maxParentsPerCommit ||
    !record(value["commit"]) ||
    !Array.isArray(value["files"])
  ) {
    throw new RemoteFault("invalid-response");
  }
  const parents = value["parents"].map((parent) => {
    if (!record(parent) || typeof parent["sha"] !== "string" || !sha1Pattern.test(parent["sha"])) {
      throw new RemoteFault("invalid-response");
    }
    return parent["sha"];
  });
  if (new Set(parents).size !== parents.length) throw new RemoteFault("invalid-response");
  const commit = value["commit"];
  const author = parseIdentity(commit["author"]);
  const committer = parseIdentity(commit["committer"]);
  const message = commit["message"];
  if (typeof message !== "string" || !message.isWellFormed()) {
    throw new RemoteFault("invalid-response");
  }
  const coauthors = new Set<string>();
  for (const line of message.split(/\r?\n/u)) {
    const match = line.match(/^Co-authored-by:\s*(.+)\s+<([^<>\r\n]+)>\s*$/iu);
    if (match === null) continue;
    const digest = digestGitIdentity(match[1] ?? "", match[2] ?? "");
    if (digest === undefined) throw new RemoteFault("invalid-response");
    coauthors.add(digest);
    if (coauthors.size > gitMetadataHardLimits.maxCoauthorsPerCommit) {
      throw new RemoteFault("limit-exceeded");
    }
  }
  const paths = value["files"].map((file) => {
    if (!record(file) || typeof file["filename"] !== "string" || !safePath(file["filename"])) {
      throw new RemoteFault("invalid-response");
    }
    return file["filename"];
  });
  if (new Set(paths).size !== paths.length) throw new RemoteFault("invalid-response");
  const identity = Object.freeze({
    objectId: expectedObjectId,
    parentObjectIds: parents,
    authoredAt: author.timestamp,
    committedAt: committer.timestamp,
    authorIdentityDigest: author.digest,
    committerIdentityDigest: committer.digest,
    coauthorIdentityDigests: [...coauthors].sort(compare),
  });
  const accountedBytes = [message, author.raw, committer.raw, ...parents].reduce(
    (sum, item) => sum + Buffer.byteLength(item, "utf8"),
    0,
  );
  return Object.freeze({ identity, changedPaths: paths, accountedBytes });
}

function parseIdentity(value: unknown): {
  readonly digest: string;
  readonly timestamp: string;
  readonly raw: string;
} {
  if (
    !record(value) ||
    typeof value["name"] !== "string" ||
    typeof value["email"] !== "string" ||
    typeof value["date"] !== "string"
  ) {
    throw new RemoteFault("invalid-response");
  }
  const digest = digestGitIdentity(value["name"], value["email"]);
  if (digest === undefined || !timestamp(value["date"])) {
    throw new RemoteFault("invalid-response");
  }
  const timestampValue = new Date(Date.parse(value["date"])).toISOString();
  return Object.freeze({
    digest,
    timestamp: timestampValue,
    raw: `${value["name"]}\0${value["email"]}\0${value["date"]}`,
  });
}

function localResult(
  result: CollectGitMetadataResult,
  githubStatus: GitHubHistoryStatus,
): CollectPublicHistoryResult {
  return result.ok
    ? deepFreeze({
        ok: true,
        value: result.value,
        historySource: "local-git" as const,
        githubStatus,
        networkRequests: 0,
      })
    : resultFailure(result.error.category, result.error.retryable, githubStatus, 0);
}

function resultFailure(
  category: GitMetadataErrorCategory,
  retryable: boolean,
  githubStatus: GitHubHistoryStatus,
  networkRequests: number,
): CollectPublicHistoryResult {
  return deepFreeze({
    ok: false,
    error: { category, retryable },
    githubStatus,
    networkRequests,
  });
}

function mapRemoteFailure(category: RemoteFailureCategory): {
  readonly category: GitMetadataErrorCategory;
  readonly retryable: boolean;
} {
  if (category === "not-authorized") return { category: "not-authorized", retryable: false };
  if (category === "limit-exceeded") return { category: "limit-exceeded", retryable: false };
  if (category === "deadline-exceeded") return { category: "deadline-exceeded", retryable: true };
  if (category === "unavailable") return { category: "git-unavailable", retryable: true };
  if (category === "invalid-input") return { category: "invalid-input", retryable: false };
  return { category: "invalid-metadata", retryable: false };
}

function mapPortFailure(reason: GitHubPublicHistoryFailureReason): RemoteFailureCategory {
  if (reason === "limit-exceeded") return "limit-exceeded";
  if (reason === "deadline-exceeded") return "deadline-exceeded";
  if (reason === "invalid-request") return "invalid-input";
  return reason === "unavailable" ? "unavailable" : "invalid-response";
}

function fallbackEligible(category: GitMetadataErrorCategory): boolean {
  return (
    category === "unsupported-repository" ||
    category === "git-unavailable" ||
    category === "path-unavailable"
  );
}

function validPortRequest(value: unknown): value is GitHubPublicHistoryRequest {
  if (!record(value)) return false;
  return (
    typeof value["endpoint"] === "string" &&
    safeEndpointPattern.test(value["endpoint"]) &&
    typeof value["maximumOutputBytes"] === "number" &&
    Number.isSafeInteger(value["maximumOutputBytes"]) &&
    value["maximumOutputBytes"] >= 1 &&
    value["maximumOutputBytes"] <= publicHistoryConfigHardLimits.maximumResponseBytes &&
    typeof value["timeoutMs"] === "number" &&
    Number.isSafeInteger(value["timeoutMs"]) &&
    value["timeoutMs"] >= 1 &&
    value["timeoutMs"] <= publicHistoryConfigHardLimits.maximumDurationMs
  );
}

function safePath(value: string): boolean {
  return (
    value.length > 0 &&
    value.isWellFormed() &&
    !value.startsWith("/") &&
    Buffer.byteLength(value, "utf8") <= localRepositoryConfigHardLimits.maxRelativePathBytes &&
    !/[\\:]/u.test(value) &&
    !control(value) &&
    value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}

function timestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value)) return false;
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value.replace("Z", ".000Z")
  );
}

function control(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clock(now: () => number): number {
  const value = now();
  if (!Number.isFinite(value) || value < 0) throw new RemoteFault("invalid-input");
  return value;
}

function readWallClock(wallClock: () => number): number {
  const value = wallClock();
  if (!Number.isFinite(value) || value < 0) throw new RemoteFault("invalid-input");
  return value;
}

class RemoteFault extends Error {
  readonly category: RemoteFailureCategory;

  constructor(category: RemoteFailureCategory) {
    super(category);
    this.category = category;
  }
}

function deepFreeze<Value>(value: Value): Value {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
