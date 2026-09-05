import { Buffer } from "node:buffer";
import path from "node:path";

import {
  nodeCanonicalDirectoryPort,
  type CanonicalDirectoryPort,
  type LocalPathPlatform,
} from "./authorized-repository-config.ts";

export const localProfileStoreConfigVersion = "0.1.0" as const;
export const localProfileStoreConfigMaximumBytes = 4_096;

export interface ResolvedLocalProfileStoreConfig {
  readonly kind: "resolved-local-profile-store-config";
  readonly configVersion: typeof localProfileStoreConfigVersion;
  readonly platform: LocalPathPlatform;
  readonly directoryPath: string;
  readonly directoryIdentity: string;
  readonly storeId: string;
  readonly subjectRef: string;
}

export type LocalProfileStoreConfigErrorCategory =
  "invalid-input" | "path-unavailable" | "not-authorized" | "unsupported-version";

export type ResolveLocalProfileStoreConfigResult =
  | { readonly ok: true; readonly value: ResolvedLocalProfileStoreConfig }
  | {
      readonly ok: false;
      readonly error: {
        readonly category: LocalProfileStoreConfigErrorCategory;
        readonly retryable: boolean;
      };
    };

const issuedConfigurations = new WeakSet<object>();
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;

export async function resolveLocalProfileStoreConfig(
  source: string,
  options: {
    readonly platform?: LocalPathPlatform;
    readonly directoryPort?: CanonicalDirectoryPort;
  } = {},
): Promise<ResolveLocalProfileStoreConfigResult> {
  if (
    typeof source !== "string" ||
    Buffer.byteLength(source, "utf8") > localProfileStoreConfigMaximumBytes ||
    (options.platform !== undefined &&
      options.platform !== "win32" &&
      options.platform !== "posix") ||
    (options.directoryPort !== undefined && !isDirectoryPort(options.directoryPort))
  ) {
    return failure("invalid-input", false);
  }
  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch {
    return failure("invalid-input", false);
  }
  if (!isRecord(value)) return failure("invalid-input", false);
  if (value["configVersion"] !== localProfileStoreConfigVersion) {
    return failure(
      typeof value["configVersion"] === "string" ? "unsupported-version" : "invalid-input",
      false,
    );
  }
  if (
    !hasExactKeys(value, ["configVersion", "directoryPath", "storeId", "subjectRef"]) ||
    typeof value["directoryPath"] !== "string" ||
    !value["directoryPath"].isWellFormed() ||
    !isIdentifier(value["storeId"]) ||
    !isIdentifier(value["subjectRef"])
  ) {
    return failure("invalid-input", false);
  }
  const platform = options.platform ?? (process.platform === "win32" ? "win32" : "posix");
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  if (
    !pathApi.isAbsolute(value["directoryPath"]) ||
    containsUnsafeControl(value["directoryPath"])
  ) {
    return failure("invalid-input", false);
  }
  try {
    const canonicalPath = await (
      options.directoryPort ?? nodeCanonicalDirectoryPort
    ).canonicalizeDirectory(value["directoryPath"]);
    if (
      typeof canonicalPath !== "string" ||
      !canonicalPath.isWellFormed() ||
      !pathApi.isAbsolute(canonicalPath) ||
      containsUnsafeControl(canonicalPath)
    ) {
      return failure("not-authorized", false);
    }
    const normalizedPath = pathApi.normalize(canonicalPath);
    const resolved = deepFreeze({
      kind: "resolved-local-profile-store-config" as const,
      configVersion: localProfileStoreConfigVersion,
      platform,
      directoryPath: normalizedPath,
      directoryIdentity: identityFor(normalizedPath, platform),
      storeId: value["storeId"],
      subjectRef: value["subjectRef"],
    });
    issuedConfigurations.add(resolved);
    return deepFreeze({ ok: true as const, value: resolved });
  } catch {
    return failure("path-unavailable", true);
  }
}

export function isIssuedLocalProfileStoreConfig(value: ResolvedLocalProfileStoreConfig): boolean {
  return typeof value === "object" && value !== null && issuedConfigurations.has(value);
}

function identityFor(value: string, platform: LocalPathPlatform): string {
  const normalized = (platform === "win32" ? path.win32 : path.posix).normalize(value);
  return platform === "win32" ? normalized.toLowerCase() : normalized;
}

function isDirectoryPort(value: CanonicalDirectoryPort): boolean {
  return (
    typeof value === "object" && value !== null && typeof value.canonicalizeDirectory === "function"
  );
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && identifierPattern.test(value);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failure(
  category: LocalProfileStoreConfigErrorCategory,
  retryable: boolean,
): ResolveLocalProfileStoreConfigResult {
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
