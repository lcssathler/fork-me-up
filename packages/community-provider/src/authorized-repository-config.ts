import { realpath, stat } from "node:fs/promises";
import path from "node:path";

export const localRepositoryConfigVersion = "0.1.0" as const;

export const localRepositoryConfigHardLimits = Object.freeze({
  maxConfigBytes: 32_768,
  maxRoots: 16,
  maxRepositories: 32,
  maxRootPathBytes: 4_096,
  maxRelativePathBytes: 2_048,
  maxFilesPerRepository: 50_000,
  maxBytesPerFile: 2_097_152,
  maxTotalBytesPerRepository: 134_217_728,
  maxDepth: 64,
  maxDurationMs: 120_000,
  maxConcurrency: 8,
});

export type LocalPathPlatform = "win32" | "posix";

export type AuthorizedRepositoryConfigErrorCategory =
  | "invalid-config"
  | "unsupported-version"
  | "limit-exceeded"
  | "path-unavailable"
  | "not-authorized";

export interface CanonicalDirectoryPort {
  canonicalizeDirectory(candidatePath: string): Promise<string>;
}

export interface ResolvedCollectionLimits {
  readonly maxRepositories: number;
  readonly maxFilesPerRepository: number;
  readonly maxBytesPerFile: number;
  readonly maxTotalBytesPerRepository: number;
  readonly maxDepth: number;
  readonly maxDurationMs: number;
  readonly maxConcurrency: number;
}

export interface ResolvedAuthorizedRoot {
  readonly rootId: string;
  readonly canonicalPath: string;
  readonly pathIdentity: string;
}

export interface ResolvedSelectedRepository {
  readonly repositoryId: string;
  readonly rootId: string;
  readonly relativePath: string;
  readonly canonicalPath: string;
  readonly pathIdentity: string;
}

export interface ResolvedAuthorizedRepositoryConfig {
  readonly configVersion: typeof localRepositoryConfigVersion;
  readonly platform: LocalPathPlatform;
  readonly authorizedRoots: readonly ResolvedAuthorizedRoot[];
  readonly repositories: readonly ResolvedSelectedRepository[];
  readonly limits: ResolvedCollectionLimits;
}

export type ResolveAuthorizedRepositoryConfigResult =
  | { readonly ok: true; readonly value: ResolvedAuthorizedRepositoryConfig }
  | {
      readonly ok: false;
      readonly error: {
        readonly category: AuthorizedRepositoryConfigErrorCategory;
        readonly retryable: boolean;
      };
    };

interface AuthorizedRootInput {
  readonly rootId: string;
  readonly path: string;
}

interface SelectedRepositoryInput {
  readonly repositoryId: string;
  readonly rootId: string;
  readonly relativePath: string;
}

interface LocalRepositoryConfigInput {
  readonly configVersion: typeof localRepositoryConfigVersion;
  readonly authorizedRoots: readonly AuthorizedRootInput[];
  readonly repositories: readonly SelectedRepositoryInput[];
  readonly limits: ResolvedCollectionLimits;
}

type ParsedConfigResult =
  | { readonly ok: true; readonly value: LocalRepositoryConfigInput }
  | {
      readonly ok: false;
      readonly category: "invalid-config" | "unsupported-version" | "limit-exceeded";
    };

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;
const relativePathPattern = /^(?:\.|[^\\/:]+(?:\/[^\\/:]+)*)$/u;
const issuedConfigurations = new WeakSet<object>();

export const nodeCanonicalDirectoryPort: CanonicalDirectoryPort = Object.freeze({
  async canonicalizeDirectory(candidatePath: string): Promise<string> {
    const canonicalPath = await realpath(candidatePath);
    const metadata = await stat(canonicalPath);
    if (!metadata.isDirectory()) throw new TypeError("Expected a directory.");
    return canonicalPath;
  },
});

export async function resolveAuthorizedRepositoryConfig(
  source: string,
  options: {
    readonly platform?: LocalPathPlatform;
    readonly directoryPort?: CanonicalDirectoryPort;
  } = {},
): Promise<ResolveAuthorizedRepositoryConfigResult> {
  const parsed = parseConfig(source);
  if (!parsed.ok) return failure(parsed.category, false);

  const platform = options.platform ?? (process.platform === "win32" ? "win32" : "posix");
  const directoryPort = options.directoryPort ?? nodeCanonicalDirectoryPort;
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const rootsById = new Map<string, ResolvedAuthorizedRoot>();
  const rootIdentities = new Set<string>();

  for (const root of parsed.value.authorizedRoots) {
    if (!isAcceptableAbsolutePath(root.path, platform)) return failure("invalid-config", false);
    const canonical = await resolveDirectory(directoryPort, root.path, platform);
    if (!canonical.ok) return canonical.result;
    if (rootIdentities.has(canonical.pathIdentity)) return failure("invalid-config", false);
    rootIdentities.add(canonical.pathIdentity);
    rootsById.set(
      root.rootId,
      Object.freeze({
        rootId: root.rootId,
        canonicalPath: canonical.canonicalPath,
        pathIdentity: canonical.pathIdentity,
      }),
    );
  }

  const repositoryIdentities = new Set<string>();
  const repositories: ResolvedSelectedRepository[] = [];
  for (const repository of parsed.value.repositories) {
    const root = rootsById.get(repository.rootId);
    if (root === undefined) return failure("invalid-config", false);
    const candidate =
      repository.relativePath === "."
        ? root.canonicalPath
        : pathApi.resolve(root.canonicalPath, ...repository.relativePath.split("/"));
    const canonical = await resolveDirectory(directoryPort, candidate, platform);
    if (!canonical.ok) return canonical.result;
    if (!isContainedPath(root.canonicalPath, canonical.canonicalPath, pathApi)) {
      return failure("not-authorized", false);
    }
    if (repositoryIdentities.has(canonical.pathIdentity)) {
      return failure("invalid-config", false);
    }
    repositoryIdentities.add(canonical.pathIdentity);
    repositories.push(
      Object.freeze({
        repositoryId: repository.repositoryId,
        rootId: repository.rootId,
        relativePath: repository.relativePath,
        canonicalPath: canonical.canonicalPath,
        pathIdentity: canonical.pathIdentity,
      }),
    );
  }

  const authorizedRoots = [...rootsById.values()].sort((left, right) =>
    compareText(left.rootId, right.rootId),
  );
  repositories.sort((left, right) => compareText(left.repositoryId, right.repositoryId));
  const value = deepFreeze({
    configVersion: localRepositoryConfigVersion,
    platform,
    authorizedRoots,
    repositories,
    limits: { ...parsed.value.limits },
  });
  issuedConfigurations.add(value);
  return Object.freeze({ ok: true, value });
}

export function isIssuedAuthorizedRepositoryConfig(
  value: unknown,
): value is ResolvedAuthorizedRepositoryConfig {
  return typeof value === "object" && value !== null && issuedConfigurations.has(value);
}

function parseConfig(source: string): ParsedConfigResult {
  if (
    typeof source !== "string" ||
    Buffer.byteLength(source, "utf8") === 0 ||
    Buffer.byteLength(source, "utf8") > localRepositoryConfigHardLimits.maxConfigBytes
  ) {
    return { ok: false, category: "limit-exceeded" };
  }

  let input: unknown;
  try {
    input = JSON.parse(source) as unknown;
  } catch {
    return { ok: false, category: "invalid-config" };
  }
  if (!isExactRecord(input, ["configVersion", "authorizedRoots", "repositories", "limits"])) {
    return { ok: false, category: "invalid-config" };
  }
  if (
    typeof input["configVersion"] === "string" &&
    input["configVersion"] !== localRepositoryConfigVersion
  ) {
    return { ok: false, category: "unsupported-version" };
  }
  if (input["configVersion"] !== localRepositoryConfigVersion) {
    return { ok: false, category: "invalid-config" };
  }

  const roots = parseRoots(input["authorizedRoots"]);
  if (!roots.ok) return roots;
  const repositories = parseRepositories(input["repositories"]);
  if (!repositories.ok) return repositories;
  const limits = parseLimits(input["limits"]);
  if (!limits.ok) return limits;
  if (repositories.value.length > limits.value.maxRepositories) {
    return { ok: false, category: "limit-exceeded" };
  }

  const rootIds = new Set<string>();
  for (const root of roots.value) {
    if (rootIds.has(root.rootId)) return { ok: false, category: "invalid-config" };
    rootIds.add(root.rootId);
  }
  const repositoryIds = new Set<string>();
  for (const repository of repositories.value) {
    if (repositoryIds.has(repository.repositoryId) || !rootIds.has(repository.rootId)) {
      return { ok: false, category: "invalid-config" };
    }
    repositoryIds.add(repository.repositoryId);
  }

  return {
    ok: true,
    value: {
      configVersion: localRepositoryConfigVersion,
      authorizedRoots: roots.value,
      repositories: repositories.value,
      limits: limits.value,
    },
  };
}

function parseRoots(
  value: unknown,
):
  | { readonly ok: true; readonly value: readonly AuthorizedRootInput[] }
  | { readonly ok: false; readonly category: "invalid-config" | "limit-exceeded" } {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, category: "invalid-config" };
  }
  if (value.length > localRepositoryConfigHardLimits.maxRoots) {
    return { ok: false, category: "limit-exceeded" };
  }
  const roots: AuthorizedRootInput[] = [];
  for (const item of value) {
    if (!isExactRecord(item, ["rootId", "path"])) {
      return { ok: false, category: "invalid-config" };
    }
    const rootId = item["rootId"];
    const configuredPath = item["path"];
    if (typeof rootId !== "string" || !identifierPattern.test(rootId)) {
      return { ok: false, category: "invalid-config" };
    }
    if (typeof configuredPath !== "string" || containsControlCharacter(configuredPath)) {
      return { ok: false, category: "invalid-config" };
    }
    if (
      Buffer.byteLength(configuredPath, "utf8") > localRepositoryConfigHardLimits.maxRootPathBytes
    ) {
      return { ok: false, category: "limit-exceeded" };
    }
    roots.push({ rootId, path: configuredPath });
  }
  return { ok: true, value: roots };
}

function parseRepositories(
  value: unknown,
):
  | { readonly ok: true; readonly value: readonly SelectedRepositoryInput[] }
  | { readonly ok: false; readonly category: "invalid-config" | "limit-exceeded" } {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, category: "invalid-config" };
  }
  if (value.length > localRepositoryConfigHardLimits.maxRepositories) {
    return { ok: false, category: "limit-exceeded" };
  }
  const repositories: SelectedRepositoryInput[] = [];
  for (const item of value) {
    if (!isExactRecord(item, ["repositoryId", "rootId", "relativePath"])) {
      return { ok: false, category: "invalid-config" };
    }
    const repositoryId = item["repositoryId"];
    const rootId = item["rootId"];
    const relativePath = item["relativePath"];
    if (
      typeof repositoryId !== "string" ||
      !identifierPattern.test(repositoryId) ||
      typeof rootId !== "string" ||
      !identifierPattern.test(rootId) ||
      typeof relativePath !== "string" ||
      !isSafeRelativePath(relativePath)
    ) {
      return { ok: false, category: "invalid-config" };
    }
    if (
      Buffer.byteLength(relativePath, "utf8") > localRepositoryConfigHardLimits.maxRelativePathBytes
    ) {
      return { ok: false, category: "limit-exceeded" };
    }
    repositories.push({ repositoryId, rootId, relativePath });
  }
  return { ok: true, value: repositories };
}

function parseLimits(
  value: unknown,
):
  | { readonly ok: true; readonly value: ResolvedCollectionLimits }
  | { readonly ok: false; readonly category: "invalid-config" | "limit-exceeded" } {
  const keys = [
    "maxRepositories",
    "maxFilesPerRepository",
    "maxBytesPerFile",
    "maxTotalBytesPerRepository",
    "maxDepth",
    "maxDurationMs",
    "maxConcurrency",
  ];
  if (!isExactRecord(value, keys)) return { ok: false, category: "invalid-config" };

  const limits = Object.fromEntries(keys.map((key) => [key, value[key]]));
  if (Object.values(limits).some((item) => !Number.isSafeInteger(item) || Number(item) < 1)) {
    return { ok: false, category: "invalid-config" };
  }
  const typedLimits = limits as unknown as ResolvedCollectionLimits;
  if (
    typedLimits.maxRepositories > localRepositoryConfigHardLimits.maxRepositories ||
    typedLimits.maxFilesPerRepository > localRepositoryConfigHardLimits.maxFilesPerRepository ||
    typedLimits.maxBytesPerFile > localRepositoryConfigHardLimits.maxBytesPerFile ||
    typedLimits.maxTotalBytesPerRepository >
      localRepositoryConfigHardLimits.maxTotalBytesPerRepository ||
    typedLimits.maxDepth > localRepositoryConfigHardLimits.maxDepth ||
    typedLimits.maxDurationMs > localRepositoryConfigHardLimits.maxDurationMs ||
    typedLimits.maxConcurrency > localRepositoryConfigHardLimits.maxConcurrency
  ) {
    return { ok: false, category: "limit-exceeded" };
  }
  if (typedLimits.maxTotalBytesPerRepository < typedLimits.maxBytesPerFile) {
    return { ok: false, category: "invalid-config" };
  }
  return { ok: true, value: { ...typedLimits } };
}

async function resolveDirectory(
  port: CanonicalDirectoryPort,
  candidatePath: string,
  platform: LocalPathPlatform,
): Promise<
  | { readonly ok: true; readonly canonicalPath: string; readonly pathIdentity: string }
  | { readonly ok: false; readonly result: ResolveAuthorizedRepositoryConfigResult }
> {
  try {
    const resolved = await port.canonicalizeDirectory(candidatePath);
    if (typeof resolved !== "string" || !isAcceptableAbsolutePath(resolved, platform)) {
      return { ok: false, result: failure("path-unavailable", true) };
    }
    const pathApi = platform === "win32" ? path.win32 : path.posix;
    const canonicalPath = pathApi.normalize(resolved);
    return {
      ok: true,
      canonicalPath,
      pathIdentity: platform === "win32" ? canonicalPath.toLowerCase() : canonicalPath,
    };
  } catch {
    return { ok: false, result: failure("path-unavailable", true) };
  }
}

function isAcceptableAbsolutePath(value: string, platform: LocalPathPlatform): boolean {
  if (
    value.length === 0 ||
    containsControlCharacter(value) ||
    Buffer.byteLength(value, "utf8") > localRepositoryConfigHardLimits.maxRootPathBytes
  ) {
    return false;
  }
  if (platform === "win32" && /^\\\\[.?]\\/u.test(value)) return false;
  return (platform === "win32" ? path.win32 : path.posix).isAbsolute(value);
}

function isSafeRelativePath(value: string): boolean {
  if (
    value.length === 0 ||
    containsControlCharacter(value) ||
    !relativePathPattern.test(value) ||
    value.startsWith("/")
  ) {
    return false;
  }
  return value === "." || value.split("/").every((segment) => segment !== "." && segment !== "..");
}

function isContainedPath(
  rootPath: string,
  candidatePath: string,
  pathApi: typeof path.win32 | typeof path.posix,
): boolean {
  const relative = pathApi.relative(rootPath, candidatePath);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${pathApi.sep}`) && !pathApi.isAbsolute(relative))
  );
}

function failure(
  category: AuthorizedRepositoryConfigErrorCategory,
  retryable: boolean,
): ResolveAuthorizedRepositoryConfigResult {
  return Object.freeze({ ok: false, error: Object.freeze({ category, retryable }) });
}

function isExactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort(compareText);
  const expected = [...keys].sort(compareText);
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x1f || codeUnit === 0x7f) return true;
  }
  return false;
}

function deepFreeze<Value>(value: Value): Value {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
