import { Buffer } from "node:buffer";

import { localRepositoryConfigHardLimits } from "./authorized-repository-config.ts";

export const evidenceSourceRiskConfigVersion = "0.1.0" as const;

export const evidenceSourceRiskConfigHardLimits = Object.freeze({
  maximumBytes: 32_768,
  maximumRepositoryAnnotations: 64,
  maximumPathAnnotations: 512,
});

export type EvidenceSourceRiskFlag =
  "fork" | "template" | "generated" | "vendored" | "tutorial" | "duplicated" | "uncertain";

export type ConfigurableRepositoryRisk = "fork" | "template" | "tutorial" | "uncertain";
export type ConfigurablePathRisk = "template" | "generated" | "vendored" | "tutorial" | "uncertain";

export interface ResolvedRepositoryRiskAnnotation {
  readonly repositoryId: string;
  readonly riskFlags: readonly ConfigurableRepositoryRisk[];
}

export interface ResolvedPathRiskAnnotation {
  readonly repositoryId: string;
  readonly sourceRelativeRef: string;
  readonly riskFlags: readonly ConfigurablePathRisk[];
}

export interface ResolvedEvidenceSourceRiskConfig {
  readonly kind: "resolved-evidence-source-risk-config";
  readonly configVersion: typeof evidenceSourceRiskConfigVersion;
  readonly repositoryAnnotations: readonly ResolvedRepositoryRiskAnnotation[];
  readonly pathAnnotations: readonly ResolvedPathRiskAnnotation[];
}

export type EvidenceSourceRiskConfigErrorCategory = "invalid-input" | "unsupported-version";

export type ResolveEvidenceSourceRiskConfigResult =
  | { readonly ok: true; readonly value: ResolvedEvidenceSourceRiskConfig }
  | {
      readonly ok: false;
      readonly error: {
        readonly category: EvidenceSourceRiskConfigErrorCategory;
        readonly retryable: false;
      };
    };

const issuedConfigurations = new WeakSet<object>();
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;
const repositoryRisks = new Set<ConfigurableRepositoryRisk>([
  "fork",
  "template",
  "tutorial",
  "uncertain",
]);
const pathRisks = new Set<ConfigurablePathRisk>([
  "template",
  "generated",
  "vendored",
  "tutorial",
  "uncertain",
]);

export function resolveEvidenceSourceRiskConfig(
  source: string,
): ResolveEvidenceSourceRiskConfigResult {
  if (
    typeof source !== "string" ||
    Buffer.byteLength(source, "utf8") > evidenceSourceRiskConfigHardLimits.maximumBytes
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
  if (input["configVersion"] !== evidenceSourceRiskConfigVersion) {
    return failure(
      typeof input["configVersion"] === "string" ? "unsupported-version" : "invalid-input",
    );
  }
  if (
    !hasExactKeys(input, ["configVersion", "repositoryAnnotations", "pathAnnotations"]) ||
    !Array.isArray(input["repositoryAnnotations"]) ||
    input["repositoryAnnotations"].length >
      evidenceSourceRiskConfigHardLimits.maximumRepositoryAnnotations ||
    !Array.isArray(input["pathAnnotations"]) ||
    input["pathAnnotations"].length > evidenceSourceRiskConfigHardLimits.maximumPathAnnotations
  ) {
    return failure("invalid-input");
  }

  const repositoryAnnotations: ResolvedRepositoryRiskAnnotation[] = [];
  const seenRepositories = new Set<string>();
  for (const candidate of input["repositoryAnnotations"]) {
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, ["repositoryId", "riskFlags"]) ||
      !isIdentifier(candidate["repositoryId"]) ||
      seenRepositories.has(candidate["repositoryId"]) ||
      !isRiskArray(candidate["riskFlags"], repositoryRisks)
    ) {
      return failure("invalid-input");
    }
    seenRepositories.add(candidate["repositoryId"]);
    repositoryAnnotations.push(
      deepFreeze({
        repositoryId: candidate["repositoryId"],
        riskFlags: [...candidate["riskFlags"]].sort(compareText),
      }),
    );
  }

  const pathAnnotations: ResolvedPathRiskAnnotation[] = [];
  const seenPaths = new Set<string>();
  for (const candidate of input["pathAnnotations"]) {
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, ["repositoryId", "sourceRelativeRef", "riskFlags"]) ||
      !isIdentifier(candidate["repositoryId"]) ||
      typeof candidate["sourceRelativeRef"] !== "string" ||
      !isSafeRelativePath(candidate["sourceRelativeRef"]) ||
      !isRiskArray(candidate["riskFlags"], pathRisks)
    ) {
      return failure("invalid-input");
    }
    const key = `${candidate["repositoryId"]}\0${candidate["sourceRelativeRef"]}`;
    if (seenPaths.has(key)) return failure("invalid-input");
    seenPaths.add(key);
    pathAnnotations.push(
      deepFreeze({
        repositoryId: candidate["repositoryId"],
        sourceRelativeRef: candidate["sourceRelativeRef"],
        riskFlags: [...candidate["riskFlags"]].sort(compareText),
      }),
    );
  }

  repositoryAnnotations.sort((left, right) => compareText(left.repositoryId, right.repositoryId));
  pathAnnotations.sort(
    (left, right) =>
      compareText(left.repositoryId, right.repositoryId) ||
      compareText(left.sourceRelativeRef, right.sourceRelativeRef),
  );
  const resolved = deepFreeze({
    kind: "resolved-evidence-source-risk-config" as const,
    configVersion: evidenceSourceRiskConfigVersion,
    repositoryAnnotations,
    pathAnnotations,
  });
  issuedConfigurations.add(resolved);
  return deepFreeze({ ok: true as const, value: resolved });
}

export function isIssuedEvidenceSourceRiskConfig(value: ResolvedEvidenceSourceRiskConfig): boolean {
  return typeof value === "object" && value !== null && issuedConfigurations.has(value);
}

function isRiskArray<Value extends string>(
  value: unknown,
  allowed: ReadonlySet<Value>,
): value is Value[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= allowed.size &&
    value.every((item) => typeof item === "string" && allowed.has(item as Value)) &&
    new Set(value).size === value.length
  );
}

function isSafeRelativePath(value: string): boolean {
  return (
    value.length > 0 &&
    value.isWellFormed() &&
    !value.startsWith("/") &&
    Buffer.byteLength(value, "utf8") <= localRepositoryConfigHardLimits.maxRelativePathBytes &&
    !/[\\:]/u.test(value) &&
    !containsUnsafeControl(value) &&
    value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}

function containsUnsafeControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x1f || codeUnit === 0x7f) return true;
  }
  return false;
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
  category: EvidenceSourceRiskConfigErrorCategory,
): ResolveEvidenceSourceRiskConfigResult {
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
