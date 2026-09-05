import { Buffer } from "node:buffer";

import { digestGitIdentity, maximumGitIdentityBytes } from "./git-identity.ts";

export const developerIdentityConfigVersion = "0.1.0" as const;

export const developerIdentityConfigHardLimits = Object.freeze({
  maximumBytes: 32_768,
  maximumIdentities: 128,
  maximumAnnotations: 256,
  maximumPrivateIdentityPartBytes: maximumGitIdentityBytes,
});

export type GitIdentityRole = "developer" | "shared" | "bot";
export type GitCommitAnnotationKind = "pair-work" | "squash";

export interface ResolvedGitIdentity {
  readonly role: GitIdentityRole;
  readonly identityDigest: string;
}

export interface ResolvedGitCommitAnnotation {
  readonly repositoryId: string;
  readonly commitObjectId: string;
  readonly kind: GitCommitAnnotationKind;
}

export interface ResolvedDeveloperIdentityConfig {
  readonly kind: "resolved-developer-identity-config";
  readonly configVersion: typeof developerIdentityConfigVersion;
  readonly subjectRef: string;
  readonly identities: readonly ResolvedGitIdentity[];
  readonly annotations: readonly ResolvedGitCommitAnnotation[];
}

export type DeveloperIdentityConfigErrorCategory = "invalid-input" | "unsupported-version";

export type ResolveDeveloperIdentityConfigResult =
  | { readonly ok: true; readonly value: ResolvedDeveloperIdentityConfig }
  | {
      readonly ok: false;
      readonly error: {
        readonly category: DeveloperIdentityConfigErrorCategory;
        readonly retryable: false;
      };
    };

const issuedConfigurations = new WeakSet<object>();
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;
const objectIdPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;

export function resolveDeveloperIdentityConfig(
  source: string,
): ResolveDeveloperIdentityConfigResult {
  if (
    typeof source !== "string" ||
    Buffer.byteLength(source, "utf8") > developerIdentityConfigHardLimits.maximumBytes
  ) {
    return failure("invalid-input");
  }
  let input: unknown;
  try {
    input = JSON.parse(source) as unknown;
  } catch {
    return failure("invalid-input");
  }
  if (!isRecord(input)) return failure("invalid-input");
  if (input["configVersion"] !== developerIdentityConfigVersion) {
    return failure(
      typeof input["configVersion"] === "string" ? "unsupported-version" : "invalid-input",
    );
  }
  if (!hasExactKeys(input, ["configVersion", "subjectRef", "identities", "annotations"])) {
    return failure("invalid-input");
  }
  if (!isIdentifier(input["subjectRef"])) return failure("invalid-input");
  if (
    !Array.isArray(input["identities"]) ||
    input["identities"].length < 1 ||
    input["identities"].length > developerIdentityConfigHardLimits.maximumIdentities ||
    !Array.isArray(input["annotations"]) ||
    input["annotations"].length > developerIdentityConfigHardLimits.maximumAnnotations
  ) {
    return failure("invalid-input");
  }

  const identities: ResolvedGitIdentity[] = [];
  const seenDigests = new Set<string>();
  let developerIdentityCount = 0;
  for (const candidate of input["identities"]) {
    if (!isRecord(candidate) || !hasExactKeys(candidate, ["role", "name", "email"])) {
      return failure("invalid-input");
    }
    const role = candidate["role"];
    if (role !== "developer" && role !== "shared" && role !== "bot") {
      return failure("invalid-input");
    }
    if (typeof candidate["name"] !== "string" || typeof candidate["email"] !== "string") {
      return failure("invalid-input");
    }
    const identityDigest = digestGitIdentity(candidate["name"], candidate["email"]);
    if (identityDigest === undefined || seenDigests.has(identityDigest)) {
      return failure("invalid-input");
    }
    seenDigests.add(identityDigest);
    if (role === "developer") developerIdentityCount += 1;
    identities.push(Object.freeze({ role, identityDigest }));
  }
  if (developerIdentityCount === 0) return failure("invalid-input");

  const annotations: ResolvedGitCommitAnnotation[] = [];
  const seenAnnotations = new Set<string>();
  for (const candidate of input["annotations"]) {
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, ["repositoryId", "commitObjectId", "kind"]) ||
      !isIdentifier(candidate["repositoryId"]) ||
      typeof candidate["commitObjectId"] !== "string" ||
      !objectIdPattern.test(candidate["commitObjectId"]) ||
      (candidate["kind"] !== "pair-work" && candidate["kind"] !== "squash")
    ) {
      return failure("invalid-input");
    }
    const key = `${candidate["repositoryId"]}\0${candidate["commitObjectId"]}\0${candidate["kind"]}`;
    if (seenAnnotations.has(key)) return failure("invalid-input");
    seenAnnotations.add(key);
    annotations.push(
      Object.freeze({
        repositoryId: candidate["repositoryId"],
        commitObjectId: candidate["commitObjectId"],
        kind: candidate["kind"],
      }),
    );
  }

  identities.sort(
    (left, right) =>
      compareText(left.identityDigest, right.identityDigest) || compareText(left.role, right.role),
  );
  annotations.sort(
    (left, right) =>
      compareText(left.repositoryId, right.repositoryId) ||
      compareText(left.commitObjectId, right.commitObjectId) ||
      compareText(left.kind, right.kind),
  );
  const resolved = deepFreeze({
    kind: "resolved-developer-identity-config" as const,
    configVersion: developerIdentityConfigVersion,
    subjectRef: input["subjectRef"],
    identities,
    annotations,
  });
  issuedConfigurations.add(resolved);
  return deepFreeze({ ok: true as const, value: resolved });
}

export function isIssuedDeveloperIdentityConfig(value: ResolvedDeveloperIdentityConfig): boolean {
  return typeof value === "object" && value !== null && issuedConfigurations.has(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort(compareText);
  const expected = [...keys].sort(compareText);
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && identifierPattern.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failure(
  category: DeveloperIdentityConfigErrorCategory,
): ResolveDeveloperIdentityConfigResult {
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

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
