import { createHash } from "node:crypto";
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

export const filesystemMetadataSnapshotVersion = "0.1.0" as const;

export type FilesystemMetadataErrorCategory =
  | "invalid-input"
  | "path-unavailable"
  | "not-authorized"
  | "limit-exceeded"
  | "deadline-exceeded"
  | "binary-content"
  | "invalid-content";

export type InspectedPathKind = "file" | "directory" | "symbolic-link" | "other";

export interface InspectedFilesystemPath {
  readonly canonicalPath: string;
  readonly pathIdentity: string;
  readonly kind: InspectedPathKind;
  readonly sizeBytes: number;
}

export interface BoundedFileRead {
  readonly canonicalPath: string;
  readonly pathIdentity: string;
  readonly bytes: Uint8Array;
}

export interface FilesystemMetadataPort {
  inspect(candidatePath: string, platform: LocalPathPlatform): Promise<InspectedFilesystemPath>;
  hasEntry(canonicalDirectory: string, entryName: string): Promise<boolean>;
  listDirectory(canonicalDirectory: string, maximumEntries: number): Promise<readonly string[]>;
  readFileBounded(
    canonicalFile: string,
    maximumBytes: number,
    platform: LocalPathPlatform,
  ): Promise<BoundedFileRead>;
}

interface MetadataFileBase {
  readonly relativePath: string;
  readonly bytes: number;
  readonly digest: { readonly algorithm: "sha256"; readonly value: string };
  readonly lineCount: number;
}

export interface DocumentMetadataFile extends MetadataFileBase {
  readonly category: "document";
  readonly format: "markdown" | "mdx" | "restructured-text" | "asciidoc";
  readonly headingCount: number;
  readonly codeFenceCount: number;
}

export interface PackageJsonMetadata {
  readonly moduleType: "module" | "commonjs" | "unspecified";
  readonly private: boolean | null;
  readonly workspacePatternCount: number;
  readonly dependencyNames: readonly string[];
  readonly scriptNames: readonly string[];
}

export interface ManifestMetadataFile extends MetadataFileBase {
  readonly category: "manifest";
  readonly format:
    | "node-package"
    | "python-project"
    | "python-requirements"
    | "rust-cargo"
    | "maven-pom"
    | "gradle"
    | "go-module"
    | "ruby-bundler"
    | "php-composer"
    | "elixir-mix";
  readonly packageJson: PackageJsonMetadata | null;
}

export interface SourceMetadataFile extends MetadataFileBase {
  readonly category: "source";
  readonly language: string;
  readonly testFile: boolean;
}

export type FilesystemMetadataFile =
  DocumentMetadataFile | ManifestMetadataFile | SourceMetadataFile;

export interface RepositoryFilesystemMetadata {
  readonly repositoryId: string;
  readonly rootId: string;
  readonly visitedEntryCount: number;
  readonly ignoredDirectoryCount: number;
  readonly unsupportedFileCount: number;
  readonly bytesRead: number;
  readonly files: readonly FilesystemMetadataFile[];
}

export interface FilesystemMetadataSnapshot {
  readonly kind: "filesystem-metadata-snapshot";
  readonly snapshotVersion: typeof filesystemMetadataSnapshotVersion;
  readonly repositories: readonly RepositoryFilesystemMetadata[];
}

export type CollectFilesystemMetadataResult =
  | { readonly ok: true; readonly value: FilesystemMetadataSnapshot }
  | {
      readonly ok: false;
      readonly error: {
        readonly category: FilesystemMetadataErrorCategory;
        readonly retryable: boolean;
      };
    };

interface ClassifiedFile {
  readonly category: "document" | "manifest" | "source";
  readonly value: string;
}

const ignoredDirectories = new Set([".git", ".hg", ".svn", "node_modules", ".fork-me-up"]);
const packageJsonNamePattern = /^(?:@[-a-z0-9._~]+\/)?[-a-z0-9._~]+$/u;
const scriptNamePattern = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/u;
const maximumPackageNames = 256;
const maximumPackageNameBytes = 214;
const maximumScriptNames = 128;
const decoder = new TextDecoder("utf-8", { fatal: true });

const sourceLanguages = new Map<string, string>([
  [".c", "c"],
  [".cc", "cpp"],
  [".clj", "clojure"],
  [".cpp", "cpp"],
  [".cs", "csharp"],
  [".css", "css"],
  [".cxx", "cpp"],
  [".ex", "elixir"],
  [".exs", "elixir"],
  [".fs", "fsharp"],
  [".fsx", "fsharp"],
  [".go", "go"],
  [".h", "c"],
  [".hpp", "cpp"],
  [".html", "html"],
  [".java", "java"],
  [".js", "javascript"],
  [".jsx", "javascript"],
  [".kt", "kotlin"],
  [".kts", "kotlin"],
  [".lua", "lua"],
  [".m", "objective-c"],
  [".php", "php"],
  [".ps1", "powershell"],
  [".py", "python"],
  [".r", "r"],
  [".rb", "ruby"],
  [".rs", "rust"],
  [".scala", "scala"],
  [".scss", "scss"],
  [".sh", "shell"],
  [".sql", "sql"],
  [".svelte", "svelte"],
  [".swift", "swift"],
  [".ts", "typescript"],
  [".tsx", "typescript"],
  [".vue", "vue"],
]);

class CollectorFault extends Error {
  readonly category: FilesystemMetadataErrorCategory;
  readonly retryable: boolean;

  constructor(category: FilesystemMetadataErrorCategory, retryable: boolean) {
    super(category);
    this.category = category;
    this.retryable = retryable;
  }
}

export const nodeFilesystemMetadataPort: FilesystemMetadataPort = Object.freeze({
  async inspect(candidatePath: string, platform: LocalPathPlatform) {
    const initial = await lstat(candidatePath);
    if (initial.isSymbolicLink()) {
      return Object.freeze({
        canonicalPath: normalizeAbsolute(candidatePath, platform),
        pathIdentity: identityFor(candidatePath, platform),
        kind: "symbolic-link" as const,
        sizeBytes: safeSize(initial.size),
      });
    }
    const canonicalPath = normalizeAbsolute(await realpath(candidatePath), platform);
    const metadata = await stat(canonicalPath);
    return Object.freeze({
      canonicalPath,
      pathIdentity: identityFor(canonicalPath, platform),
      kind: metadata.isFile() ? "file" : metadata.isDirectory() ? "directory" : "other",
      sizeBytes: safeSize(metadata.size),
    });
  },

  async hasEntry(canonicalDirectory: string, entryName: string) {
    if (!isSafeEntryName(entryName)) throw new CollectorFault("invalid-input", false);
    try {
      await lstat(path.join(canonicalDirectory, entryName));
      return true;
    } catch (error) {
      if (isMissingPathError(error)) return false;
      throw error;
    }
  },

  async listDirectory(canonicalDirectory: string, maximumEntries: number) {
    if (!Number.isSafeInteger(maximumEntries) || maximumEntries < 0) {
      throw new CollectorFault("invalid-input", false);
    }
    const directory = await opendir(canonicalDirectory);
    const names: string[] = [];
    try {
      for await (const entry of directory) {
        names.push(entry.name);
        if (names.length > maximumEntries) throw new CollectorFault("limit-exceeded", false);
      }
    } finally {
      await directory.close().catch(() => undefined);
    }
    return Object.freeze(names.sort(compareText));
  },

  async readFileBounded(canonicalFile: string, maximumBytes: number, platform: LocalPathPlatform) {
    if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0) {
      throw new CollectorFault("invalid-input", false);
    }
    const before = await lstat(canonicalFile, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink()) {
      throw new CollectorFault("not-authorized", false);
    }
    const beforeCanonical = normalizeAbsolute(await realpath(canonicalFile), platform);
    const handle = await open(beforeCanonical, "r");
    try {
      const opened = await handle.stat({ bigint: true });
      if (
        !opened.isFile() ||
        opened.dev !== before.dev ||
        opened.ino !== before.ino ||
        opened.size !== before.size ||
        opened.mtimeNs !== before.mtimeNs ||
        opened.ctimeNs !== before.ctimeNs
      ) {
        throw new CollectorFault("not-authorized", false);
      }
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (total <= maximumBytes) {
        const chunk = new Uint8Array(Math.min(64 * 1024, maximumBytes + 1 - total));
        if (chunk.byteLength === 0) break;
        const read = await handle.read(chunk, 0, chunk.byteLength, null);
        if (read.bytesRead === 0) break;
        chunks.push(chunk.subarray(0, read.bytesRead));
        total += read.bytesRead;
      }
      if (total > maximumBytes) throw new CollectorFault("limit-exceeded", false);
      const afterOpened = await handle.stat({ bigint: true });
      const afterPath = await lstat(beforeCanonical, { bigint: true });
      const afterCanonical = normalizeAbsolute(await realpath(beforeCanonical), platform);
      if (
        afterPath.isSymbolicLink() ||
        !afterPath.isFile() ||
        afterOpened.dev !== opened.dev ||
        afterOpened.ino !== opened.ino ||
        afterOpened.mtimeNs !== opened.mtimeNs ||
        afterOpened.ctimeNs !== opened.ctimeNs ||
        afterPath.dev !== opened.dev ||
        afterPath.ino !== opened.ino ||
        afterPath.size !== opened.size ||
        afterPath.mtimeNs !== opened.mtimeNs ||
        afterPath.ctimeNs !== opened.ctimeNs ||
        afterOpened.size !== BigInt(total) ||
        afterCanonical !== beforeCanonical
      ) {
        throw new CollectorFault("not-authorized", false);
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return Object.freeze({
        canonicalPath: beforeCanonical,
        pathIdentity: identityFor(beforeCanonical, platform),
        bytes,
      });
    } finally {
      await handle.close().catch(() => undefined);
    }
  },
});

export async function collectFilesystemMetadata(
  authorization: ResolvedAuthorizedRepositoryConfig,
  options: {
    readonly fileSystemPort?: FilesystemMetadataPort;
    readonly now?: () => number;
  } = {},
): Promise<CollectFilesystemMetadataResult> {
  if (!isIssuedAuthorizedRepositoryConfig(authorization)) return failure("invalid-input", false);
  const port = options.fileSystemPort ?? nodeFilesystemMetadataPort;
  const now = options.now ?? (() => performance.now());
  if (!isPort(port) || typeof now !== "function") return failure("invalid-input", false);

  try {
    const startedAt = readClock(now);
    const clock = createDeadlineClock(now, startedAt, authorization.limits.maxDurationMs);
    const roots = new Map(authorization.authorizedRoots.map((root) => [root.rootId, root]));

    for (const root of authorization.authorizedRoots) {
      const inspected = await checkedOperation(clock, () =>
        port.inspect(root.canonicalPath, authorization.platform),
      );
      requireAuthorizedDirectory(
        inspected,
        root.canonicalPath,
        root.pathIdentity,
        authorization.platform,
      );
    }

    const repositories: RepositoryFilesystemMetadata[] = [];
    for (const repository of authorization.repositories) {
      const root = roots.get(repository.rootId);
      if (root === undefined) throw new CollectorFault("invalid-input", false);
      const inspected = await checkedOperation(clock, () =>
        port.inspect(repository.canonicalPath, authorization.platform),
      );
      requireAuthorizedDirectory(
        inspected,
        repository.canonicalPath,
        repository.pathIdentity,
        authorization.platform,
      );
      requireContained(root.canonicalPath, inspected.canonicalPath, authorization.platform);

      repositories.push(
        await collectRepository({
          authorization,
          rootPath: root.canonicalPath,
          repository,
          port,
          clock,
        }),
      );
    }

    repositories.sort((left, right) => compareText(left.repositoryId, right.repositoryId));
    return deepFreeze({
      ok: true,
      value: {
        kind: "filesystem-metadata-snapshot",
        snapshotVersion: filesystemMetadataSnapshotVersion,
        repositories,
      },
    });
  } catch (error) {
    if (error instanceof CollectorFault) return failure(error.category, error.retryable);
    return failure("path-unavailable", true);
  }
}

async function collectRepository(input: {
  readonly authorization: ResolvedAuthorizedRepositoryConfig;
  readonly rootPath: string;
  readonly repository: ResolvedAuthorizedRepositoryConfig["repositories"][number];
  readonly port: FilesystemMetadataPort;
  readonly clock: DeadlineClock;
}): Promise<RepositoryFilesystemMetadata> {
  const { authorization, rootPath, repository, port, clock } = input;
  const limits = authorization.limits;
  const files: FilesystemMetadataFile[] = [];
  let visitedEntryCount = 0;
  let ignoredDirectoryCount = 0;
  let unsupportedFileCount = 0;
  let bytesRead = 0;

  const visit = async (
    directoryPath: string,
    relativeDirectory: string,
    depth: number,
  ): Promise<void> => {
    if (depth > limits.maxDepth) throw new CollectorFault("limit-exceeded", false);
    const inspectedDirectory = await checkedOperation(clock, () =>
      port.inspect(directoryPath, authorization.platform),
    );
    if (inspectedDirectory.kind !== "directory") throw new CollectorFault("not-authorized", false);
    requireContained(rootPath, inspectedDirectory.canonicalPath, authorization.platform);
    requireContained(
      repository.canonicalPath,
      inspectedDirectory.canonicalPath,
      authorization.platform,
    );

    if (
      depth > 0 &&
      (await checkedOperation(clock, () => port.hasEntry(inspectedDirectory.canonicalPath, ".git")))
    ) {
      ignoredDirectoryCount += 1;
      return;
    }

    const remaining = limits.maxFilesPerRepository - visitedEntryCount;
    const names = await checkedOperation(clock, () =>
      port.listDirectory(inspectedDirectory.canonicalPath, remaining + ignoredDirectories.size),
    );
    validateDirectoryNames(names);
    for (const name of names) {
      clock.check();
      if (ignoredDirectories.has(name)) {
        ignoredDirectoryCount += 1;
        continue;
      }
      visitedEntryCount += 1;
      if (visitedEntryCount > limits.maxFilesPerRepository) {
        throw new CollectorFault("limit-exceeded", false);
      }
      const relativePath = relativeDirectory === "" ? name : `${relativeDirectory}/${name}`;
      validateRelativePath(relativePath);
      const candidatePath = joinPath(
        inspectedDirectory.canonicalPath,
        name,
        authorization.platform,
      );
      const inspected = await checkedOperation(clock, () =>
        port.inspect(candidatePath, authorization.platform),
      );
      requireContained(rootPath, inspected.canonicalPath, authorization.platform);
      requireContained(repository.canonicalPath, inspected.canonicalPath, authorization.platform);

      if (inspected.kind === "directory") {
        await visit(inspected.canonicalPath, relativePath, depth + 1);
        continue;
      }
      if (inspected.kind !== "file") throw new CollectorFault("not-authorized", false);

      const classification = classifyFile(name);
      if (classification === undefined) {
        unsupportedFileCount += 1;
        continue;
      }
      if (inspected.sizeBytes > limits.maxBytesPerFile) {
        throw new CollectorFault("limit-exceeded", false);
      }
      const remainingBytes = limits.maxTotalBytesPerRepository - bytesRead;
      if (remainingBytes < 0 || inspected.sizeBytes > remainingBytes) {
        throw new CollectorFault("limit-exceeded", false);
      }
      const maximumRead = Math.min(limits.maxBytesPerFile, remainingBytes);
      const read = await checkedOperation(clock, () =>
        port.readFileBounded(inspected.canonicalPath, maximumRead, authorization.platform),
      );
      requireSameFile(inspected, read, authorization.platform);
      requireContained(rootPath, read.canonicalPath, authorization.platform);
      requireContained(repository.canonicalPath, read.canonicalPath, authorization.platform);
      if (read.bytes.byteLength > maximumRead) {
        throw new CollectorFault("limit-exceeded", false);
      }
      bytesRead += read.bytes.byteLength;
      if (bytesRead > limits.maxTotalBytesPerRepository) {
        throw new CollectorFault("limit-exceeded", false);
      }
      files.push(createFileMetadata(relativePath, classification, read.bytes));
    }
  };

  await visit(repository.canonicalPath, "", 0);
  files.sort((left, right) => compareText(left.relativePath, right.relativePath));
  return deepFreeze({
    repositoryId: repository.repositoryId,
    rootId: repository.rootId,
    visitedEntryCount,
    ignoredDirectoryCount,
    unsupportedFileCount,
    bytesRead,
    files,
  });
}

interface DeadlineClock {
  check(): void;
}

function createDeadlineClock(
  now: () => number,
  startedAt: number,
  maximumDuration: number,
): DeadlineClock {
  let previous = startedAt;
  return Object.freeze({
    check() {
      const current = readClock(now);
      if (current < previous) throw new CollectorFault("invalid-input", false);
      previous = current;
      if (current - startedAt >= maximumDuration) {
        throw new CollectorFault("deadline-exceeded", true);
      }
    },
  });
}

async function checkedOperation<Value>(
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
    throw new CollectorFault("invalid-input", false);
  }
  if (!Number.isFinite(value) || value < 0) throw new CollectorFault("invalid-input", false);
  return value;
}

function requireAuthorizedDirectory(
  inspected: InspectedFilesystemPath,
  expectedPath: string,
  expectedIdentity: string,
  platform: LocalPathPlatform,
): void {
  if (
    !isInspectedPath(inspected) ||
    inspected.kind !== "directory" ||
    normalizeAbsolute(inspected.canonicalPath, platform) !==
      normalizeAbsolute(expectedPath, platform) ||
    inspected.pathIdentity !== expectedIdentity
  ) {
    throw new CollectorFault("not-authorized", false);
  }
}

function requireSameFile(
  inspected: InspectedFilesystemPath,
  read: BoundedFileRead,
  platform: LocalPathPlatform,
): void {
  if (
    !isBoundedRead(read) ||
    normalizeAbsolute(read.canonicalPath, platform) !==
      normalizeAbsolute(inspected.canonicalPath, platform) ||
    read.pathIdentity !== inspected.pathIdentity
  ) {
    throw new CollectorFault("not-authorized", false);
  }
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
    throw new CollectorFault("not-authorized", false);
  }
}

function validateDirectoryNames(names: readonly string[]): void {
  if (!Array.isArray(names)) throw new CollectorFault("path-unavailable", true);
  let previous: string | undefined;
  for (const name of names) {
    if (!isSafeEntryName(name) || (previous !== undefined && compareText(previous, name) >= 0)) {
      throw new CollectorFault("not-authorized", false);
    }
    previous = name;
  }
}

function validateRelativePath(relativePath: string): void {
  if (
    relativePath.length === 0 ||
    Buffer.byteLength(relativePath, "utf8") >
      localRepositoryConfigHardLimits.maxRelativePathBytes ||
    relativePath.split("/").some((part) => !isSafeEntryName(part))
  ) {
    throw new CollectorFault("limit-exceeded", false);
  }
}

function isSafeEntryName(name: string): boolean {
  if (name.length === 0 || name === "." || name === ".." || /[\\/:]/u.test(name)) return false;
  for (let index = 0; index < name.length; index += 1) {
    const codeUnit = name.charCodeAt(index);
    if (codeUnit <= 0x1f || codeUnit === 0x7f) return false;
  }
  return true;
}

function classifyFile(name: string): ClassifiedFile | undefined {
  const lower = name.toLowerCase();
  if (lower.endsWith(".mdx")) return { category: "document", value: "mdx" };
  if (lower.endsWith(".md")) return { category: "document", value: "markdown" };
  if (lower.endsWith(".rst")) return { category: "document", value: "restructured-text" };
  if (lower.endsWith(".adoc") || lower.endsWith(".asciidoc")) {
    return { category: "document", value: "asciidoc" };
  }

  const manifest = manifestFormat(lower);
  if (manifest !== undefined) return { category: "manifest", value: manifest };
  const language = sourceLanguages.get(path.posix.extname(lower));
  return language === undefined ? undefined : { category: "source", value: language };
}

function manifestFormat(name: string): ManifestMetadataFile["format"] | undefined {
  if (name === "package.json") return "node-package";
  if (name === "pyproject.toml") return "python-project";
  if (name === "requirements.txt") return "python-requirements";
  if (name === "cargo.toml") return "rust-cargo";
  if (name === "pom.xml") return "maven-pom";
  if (name === "build.gradle" || name === "build.gradle.kts") return "gradle";
  if (name === "go.mod") return "go-module";
  if (name === "gemfile") return "ruby-bundler";
  if (name === "composer.json") return "php-composer";
  if (name === "mix.exs") return "elixir-mix";
  return undefined;
}

function createFileMetadata(
  relativePath: string,
  classification: ClassifiedFile,
  bytes: Uint8Array,
): FilesystemMetadataFile {
  if (bytes.includes(0)) throw new CollectorFault("binary-content", false);
  let text: string;
  try {
    text = decoder.decode(bytes);
  } catch {
    throw new CollectorFault("invalid-content", false);
  }
  const base = {
    relativePath,
    bytes: bytes.byteLength,
    digest: {
      algorithm: "sha256" as const,
      value: createHash("sha256").update(bytes).digest("hex"),
    },
    lineCount: countLines(text),
  };

  if (classification.category === "document") {
    const lines = splitLines(text);
    return deepFreeze({
      ...base,
      category: "document",
      format: classification.value as DocumentMetadataFile["format"],
      headingCount: countHeadings(lines, classification.value),
      codeFenceCount: lines.filter((line) => /^\s*(?:```|~~~)/u.test(line)).length,
    });
  }
  if (classification.category === "manifest") {
    const format = classification.value as ManifestMetadataFile["format"];
    if (format === "php-composer") validateJsonObject(text);
    return deepFreeze({
      ...base,
      category: "manifest",
      format,
      packageJson: format === "node-package" ? parsePackageJsonMetadata(text) : null,
    });
  }
  return deepFreeze({
    ...base,
    category: "source",
    language: classification.value,
    testFile: isTestFile(relativePath),
  });
}

function parsePackageJsonMetadata(text: string): PackageJsonMetadata {
  const value = parseJsonObject(text);
  const moduleType =
    value["type"] === "module"
      ? "module"
      : value["type"] === "commonjs"
        ? "commonjs"
        : "unspecified";
  const privateValue = typeof value["private"] === "boolean" ? value["private"] : null;
  const dependencyNames = new Set<string>();
  for (const key of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    const container = value[key];
    if (container === undefined) continue;
    if (!isRecord(container)) throw new CollectorFault("invalid-content", false);
    for (const name of Object.keys(container)) {
      if (Buffer.byteLength(name, "utf8") > maximumPackageNameBytes) {
        throw new CollectorFault("limit-exceeded", false);
      }
      if (!packageJsonNamePattern.test(name)) throw new CollectorFault("invalid-content", false);
      dependencyNames.add(name);
      if (dependencyNames.size > maximumPackageNames) {
        throw new CollectorFault("limit-exceeded", false);
      }
    }
  }
  const scripts = value["scripts"];
  const scriptNames: string[] = [];
  if (scripts !== undefined) {
    if (!isRecord(scripts)) throw new CollectorFault("invalid-content", false);
    for (const name of Object.keys(scripts)) {
      if (!scriptNamePattern.test(name)) throw new CollectorFault("invalid-content", false);
      scriptNames.push(name);
      if (scriptNames.length > maximumScriptNames)
        throw new CollectorFault("limit-exceeded", false);
    }
  }
  const workspaces = value["workspaces"];
  let workspacePatternCount = 0;
  if (Array.isArray(workspaces)) workspacePatternCount = workspaces.length;
  else if (isRecord(workspaces) && Array.isArray(workspaces["packages"])) {
    workspacePatternCount = workspaces["packages"].length;
  } else if (workspaces !== undefined) {
    throw new CollectorFault("invalid-content", false);
  }
  if (workspacePatternCount > maximumPackageNames)
    throw new CollectorFault("limit-exceeded", false);

  return deepFreeze({
    moduleType,
    private: privateValue,
    workspacePatternCount,
    dependencyNames: [...dependencyNames].sort(compareText),
    scriptNames: scriptNames.sort(compareText),
  });
}

function validateJsonObject(text: string): void {
  parseJsonObject(text);
}

function parseJsonObject(text: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new CollectorFault("invalid-content", false);
  }
  if (!isRecord(value)) throw new CollectorFault("invalid-content", false);
  return value;
}

function countLines(text: string): number {
  if (text.length === 0) return 0;
  return splitLines(text).length;
}

function splitLines(text: string): readonly string[] {
  const lines = text.split(/\r\n|\n|\r/u);
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function countHeadings(lines: readonly string[], format: string): number {
  if (format === "markdown" || format === "mdx") {
    return lines.filter((line) => /^\s{0,3}#{1,6}(?:\s|$)/u.test(line)).length;
  }
  if (format === "asciidoc") {
    return lines.filter((line) => /^={1,6}\s/u.test(line)).length;
  }
  let count = 0;
  for (let index = 1; index < lines.length; index += 1) {
    const previous = lines[index - 1];
    const current = lines[index];
    if (
      previous !== undefined &&
      previous.trim() !== "" &&
      current !== undefined &&
      /^\s*[=~-]{3,}\s*$/u.test(current)
    ) {
      count += 1;
    }
  }
  return count;
}

function isTestFile(relativePath: string): boolean {
  const lower = relativePath.toLowerCase();
  return (
    lower.split("/").includes("__tests__") ||
    /(?:^|\/)(?:test_[^/]+|[^/]+_(?:test|spec)|[^/]+\.(?:test|spec))\.[^/]+$/u.test(lower)
  );
}

function isPort(value: unknown): value is FilesystemMetadataPort {
  if (!isRecord(value)) return false;
  return (
    typeof value["inspect"] === "function" &&
    typeof value["hasEntry"] === "function" &&
    typeof value["listDirectory"] === "function" &&
    typeof value["readFileBounded"] === "function"
  );
}

function isMissingPathError(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    (value.code === "ENOENT" || value.code === "ENOTDIR")
  );
}

function isInspectedPath(value: unknown): value is InspectedFilesystemPath {
  return (
    isRecord(value) &&
    typeof value["canonicalPath"] === "string" &&
    typeof value["pathIdentity"] === "string" &&
    (value["kind"] === "file" ||
      value["kind"] === "directory" ||
      value["kind"] === "symbolic-link" ||
      value["kind"] === "other") &&
    Number.isSafeInteger(value["sizeBytes"]) &&
    Number(value["sizeBytes"]) >= 0
  );
}

function isBoundedRead(value: unknown): value is BoundedFileRead {
  return (
    isRecord(value) &&
    typeof value["canonicalPath"] === "string" &&
    typeof value["pathIdentity"] === "string" &&
    value["bytes"] instanceof Uint8Array
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAbsolute(value: string, platform: LocalPathPlatform): string {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  if (typeof value !== "string" || !pathApi.isAbsolute(value)) {
    throw new CollectorFault("path-unavailable", true);
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

function safeSize(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new CollectorFault("path-unavailable", true);
  return value;
}

function failure(
  category: FilesystemMetadataErrorCategory,
  retryable: boolean,
): CollectFilesystemMetadataResult {
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
