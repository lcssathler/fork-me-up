import { Buffer } from "node:buffer";

import {
  isIssuedAuthorizedRepositoryConfig,
  type ResolvedAuthorizedRepositoryConfig,
  type ResolvedSelectedRepository,
} from "./authorized-repository-config.ts";

export const publicHistoryConfigVersion = "0.1.0" as const;

export const publicHistoryConfigHardLimits = Object.freeze({
  maximumJsonBytes: 32_768,
  maximumRepositories: 32,
  maximumConsentDurationMs: 86_400_000,
  maximumCommits: 64,
  maximumRequests: 257,
  maximumResponseBytes: 1_048_576,
  maximumTotalResponseBytes: 16_777_216,
  maximumDurationMs: 60_000,
  maximumPagesPerCommit: 4,
  maximumChangedPaths: 4_096,
});

export type PublicHistoryConfigErrorCategory =
  "invalid-config" | "unsupported-version" | "limit-exceeded" | "not-authorized";

export interface ResolvedPublicHistoryRepository {
  readonly repositoryId: string;
  readonly rootId: string;
  readonly owner: string;
  readonly name: string;
  readonly expectedHeadObjectId: string | null;
}

export interface ResolvedPublicHistoryConfig {
  readonly historyVersion: typeof publicHistoryConfigVersion;
  readonly mode: "local-first";
  readonly github: {
    readonly authentication: "existing-gh";
    readonly permission: "public-metadata-read-only";
    readonly consent: {
      readonly decision: "allow-read-selected-public-history";
      readonly issuedAt: string;
      readonly expiresAt: string;
    };
    readonly repositories: readonly ResolvedPublicHistoryRepository[];
    readonly limits: {
      readonly maxCommits: number;
      readonly maxRequests: number;
      readonly maxResponseBytes: number;
      readonly maxTotalResponseBytes: number;
      readonly maxDurationMs: number;
      readonly maxPagesPerCommit: number;
      readonly maxChangedPaths: number;
    };
  };
}

export type ResolvePublicHistoryConfigResult =
  | { readonly ok: true; readonly value: ResolvedPublicHistoryConfig }
  | {
      readonly ok: false;
      readonly error: {
        readonly category: PublicHistoryConfigErrorCategory;
        readonly retryable: false;
      };
    };

const issuedConfigurations = new WeakSet<object>();
const configurationAuthorities = new WeakMap<object, ResolvedAuthorizedRepositoryConfig>();
const configurationRepositories = new WeakMap<
  object,
  ReadonlyMap<string, ResolvedSelectedRepository>
>();
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;
const githubOwnerPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u;
const githubRepositoryPattern = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9_-])?$/u;
const sha1Pattern = /^[0-9a-f]{40}$/u;

export function resolvePublicHistoryConfig(
  source: string,
  authorization: ResolvedAuthorizedRepositoryConfig,
): ResolvePublicHistoryConfigResult {
  if (!isIssuedAuthorizedRepositoryConfig(authorization)) return failure("not-authorized");
  let input: unknown;
  try {
    if (
      typeof source !== "string" ||
      !source.isWellFormed() ||
      Buffer.byteLength(source, "utf8") > publicHistoryConfigHardLimits.maximumJsonBytes
    ) {
      return failure("limit-exceeded");
    }
    input = JSON.parse(source);
  } catch {
    return failure("invalid-config");
  }
  if (
    !shape(input, ["historyVersion", "mode", "github"]) ||
    input["historyVersion"] !== publicHistoryConfigVersion
  ) {
    return failure(
      record(input) && typeof input["historyVersion"] === "string"
        ? "unsupported-version"
        : "invalid-config",
    );
  }
  if (input["mode"] !== "local-first") return failure("invalid-config");
  const github = input["github"];
  if (
    !shape(github, ["authentication", "permission", "consent", "repositories", "limits"]) ||
    github["authentication"] !== "existing-gh" ||
    github["permission"] !== "public-metadata-read-only"
  ) {
    return failure("invalid-config");
  }
  const consent = github["consent"];
  if (
    !shape(consent, ["decision", "issuedAt", "expiresAt"]) ||
    consent["decision"] !== "allow-read-selected-public-history" ||
    !timestamp(consent["issuedAt"]) ||
    !timestamp(consent["expiresAt"])
  ) {
    return failure("invalid-config");
  }
  const issuedAt = Date.parse(consent["issuedAt"]);
  const expiresAt = Date.parse(consent["expiresAt"]);
  if (
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > publicHistoryConfigHardLimits.maximumConsentDurationMs
  ) {
    return failure("limit-exceeded");
  }
  if (
    !Array.isArray(github["repositories"]) ||
    github["repositories"].length < 1 ||
    github["repositories"].length >
      Math.min(
        publicHistoryConfigHardLimits.maximumRepositories,
        authorization.limits.maxRepositories,
      )
  ) {
    return failure("limit-exceeded");
  }
  const authorized = new Map(
    authorization.repositories.map((repository) => [repository.repositoryId, repository]),
  );
  const repositoryIds = new Set<string>();
  const githubNames = new Set<string>();
  const boundRepositories = new Map<string, ResolvedSelectedRepository>();
  const repositories: ResolvedPublicHistoryRepository[] = [];
  for (const candidate of github["repositories"]) {
    if (
      !shape(candidate, ["repositoryId", "owner", "name", "expectedHeadObjectId"]) ||
      !identifier(candidate["repositoryId"]) ||
      !githubOwner(candidate["owner"]) ||
      !githubRepository(candidate["name"]) ||
      !(
        candidate["expectedHeadObjectId"] === null ||
        (typeof candidate["expectedHeadObjectId"] === "string" &&
          sha1Pattern.test(candidate["expectedHeadObjectId"]))
      )
    ) {
      return failure("invalid-config");
    }
    const selected = authorized.get(candidate["repositoryId"]);
    if (selected === undefined) return failure("not-authorized");
    const githubName = `${candidate["owner"].toLowerCase()}/${candidate["name"].toLowerCase()}`;
    if (repositoryIds.has(candidate["repositoryId"]) || githubNames.has(githubName)) {
      return failure("invalid-config");
    }
    repositoryIds.add(candidate["repositoryId"]);
    githubNames.add(githubName);
    boundRepositories.set(candidate["repositoryId"], selected);
    repositories.push(
      Object.freeze({
        repositoryId: candidate["repositoryId"],
        rootId: selected.rootId,
        owner: candidate["owner"],
        name: candidate["name"],
        expectedHeadObjectId: candidate["expectedHeadObjectId"],
      }),
    );
  }
  const limits = parseLimits(github["limits"]);
  if (limits === null) return failure("limit-exceeded");
  repositories.sort((left, right) => compare(left.repositoryId, right.repositoryId));
  const value = deepFreeze({
    historyVersion: publicHistoryConfigVersion,
    mode: "local-first" as const,
    github: {
      authentication: "existing-gh" as const,
      permission: "public-metadata-read-only" as const,
      consent: {
        decision: "allow-read-selected-public-history" as const,
        issuedAt: consent["issuedAt"],
        expiresAt: consent["expiresAt"],
      },
      repositories,
      limits,
    },
  });
  issuedConfigurations.add(value);
  configurationAuthorities.set(value, authorization);
  configurationRepositories.set(value, boundRepositories);
  return Object.freeze({ ok: true, value });
}

export function isIssuedPublicHistoryConfig(value: unknown): value is ResolvedPublicHistoryConfig {
  return typeof value === "object" && value !== null && issuedConfigurations.has(value);
}

export function isIssuedPublicHistoryConfigFor(
  value: unknown,
  authorization: ResolvedAuthorizedRepositoryConfig,
): value is ResolvedPublicHistoryConfig {
  return (
    isIssuedPublicHistoryConfig(value) && configurationAuthorities.get(value) === authorization
  );
}

export function isIssuedPublicHistoryConfigForRepository(
  value: unknown,
  repository: ResolvedSelectedRepository,
): value is ResolvedPublicHistoryConfig {
  return (
    isIssuedPublicHistoryConfig(value) &&
    configurationRepositories.get(value)?.get(repository.repositoryId) === repository
  );
}

function parseLimits(value: unknown): ResolvedPublicHistoryConfig["github"]["limits"] | null {
  if (
    !shape(value, [
      "maxCommits",
      "maxRequests",
      "maxResponseBytes",
      "maxTotalResponseBytes",
      "maxDurationMs",
      "maxPagesPerCommit",
      "maxChangedPaths",
    ]) ||
    !bounded(value["maxCommits"], 1, publicHistoryConfigHardLimits.maximumCommits) ||
    !bounded(value["maxRequests"], 2, publicHistoryConfigHardLimits.maximumRequests) ||
    !bounded(value["maxResponseBytes"], 1, publicHistoryConfigHardLimits.maximumResponseBytes) ||
    !bounded(
      value["maxTotalResponseBytes"],
      1,
      publicHistoryConfigHardLimits.maximumTotalResponseBytes,
    ) ||
    Number(value["maxTotalResponseBytes"]) < Number(value["maxResponseBytes"]) ||
    !bounded(value["maxDurationMs"], 1, publicHistoryConfigHardLimits.maximumDurationMs) ||
    !bounded(value["maxPagesPerCommit"], 1, publicHistoryConfigHardLimits.maximumPagesPerCommit) ||
    !bounded(value["maxChangedPaths"], 1, publicHistoryConfigHardLimits.maximumChangedPaths)
  ) {
    return null;
  }
  return Object.freeze({
    maxCommits: Number(value["maxCommits"]),
    maxRequests: Number(value["maxRequests"]),
    maxResponseBytes: Number(value["maxResponseBytes"]),
    maxTotalResponseBytes: Number(value["maxTotalResponseBytes"]),
    maxDurationMs: Number(value["maxDurationMs"]),
    maxPagesPerCommit: Number(value["maxPagesPerCommit"]),
    maxChangedPaths: Number(value["maxChangedPaths"]),
  });
}

function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value)) {
    return false;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value.replace("Z", ".000Z");
}

function githubOwner(value: unknown): value is string {
  return typeof value === "string" && githubOwnerPattern.test(value) && !value.includes("--");
}

function githubRepository(value: unknown): value is string {
  return (
    typeof value === "string" &&
    githubRepositoryPattern.test(value) &&
    value !== "." &&
    value !== ".."
  );
}

function identifier(value: unknown): value is string {
  return typeof value === "string" && identifierPattern.test(value);
}

function bounded(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum
  );
}

function shape(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!record(value)) return false;
  const actual = Object.keys(value).sort(compare);
  const expected = [...keys].sort(compare);
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failure(category: PublicHistoryConfigErrorCategory): ResolvePublicHistoryConfigResult {
  return Object.freeze({
    ok: false,
    error: Object.freeze({ category, retryable: false as const }),
  });
}

function deepFreeze<Value>(value: Value): Value {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
