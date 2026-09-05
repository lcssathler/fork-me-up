import { Buffer } from "node:buffer";

import { isPortableProfileExport, type ProfilePayload } from "@fork-me-up/protocol";

export const communityProfileStoreSchemaVersion = "0.1.0" as const;
export const legacyCommunityProfileStoreSchemaVersion = "0.0.0" as const;
export const communityProfileStoreMaximumBytes = 4_194_304;

export interface CommunityProfileStore {
  readonly storeSchemaVersion: typeof communityProfileStoreSchemaVersion;
  readonly kind: "community-profile-store";
  readonly storeId: string;
  readonly profileVersion: string;
  readonly subjectRef: string;
  readonly profile: ProfilePayload;
  readonly internalState: {
    readonly generation: number;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastValidatedAt: string;
    readonly migratedFromStoreSchemaVersion: string | null;
  };
}

export interface LegacyCommunityProfileStore {
  readonly storeSchemaVersion: typeof legacyCommunityProfileStoreSchemaVersion;
  readonly kind: "community-profile-store";
  readonly storeId: string;
  readonly profileVersion: string;
  readonly subjectRef: string;
  readonly profile: ProfilePayload;
  readonly internalState: {
    readonly generation: number;
    readonly createdAt: string;
    readonly updatedAt: string;
  };
}

export type ParsedCommunityProfileStore = CommunityProfileStore | LegacyCommunityProfileStore;
export type CommunityProfileStoreFormatErrorCategory =
  "invalid-input" | "limit-exceeded" | "unsupported-version";

export type ParseCommunityProfileStoreResult =
  | { readonly ok: true; readonly value: ParsedCommunityProfileStore }
  | {
      readonly ok: false;
      readonly error: {
        readonly category: CommunityProfileStoreFormatErrorCategory;
        readonly retryable: false;
      };
    };

export type MigrateCommunityProfileStoreResult =
  | { readonly ok: true; readonly value: CommunityProfileStore }
  | {
      readonly ok: false;
      readonly error: {
        readonly category: "invalid-input" | "limit-exceeded" | "unsupported-version";
        readonly retryable: false;
      };
    };

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;
const semanticVersionPattern =
  /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const issuedParsedStores = new WeakSet<object>();

export function parseCommunityProfileStore(source: string): ParseCommunityProfileStoreResult {
  if (typeof source !== "string" || !source.isWellFormed()) return failure("invalid-input");
  if (Buffer.byteLength(source, "utf8") > communityProfileStoreMaximumBytes) {
    return failure("limit-exceeded");
  }
  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch {
    return failure("invalid-input");
  }
  if (!isRecord(value)) return failure("invalid-input");
  const version = value["storeSchemaVersion"];
  if (
    version !== communityProfileStoreSchemaVersion &&
    version !== legacyCommunityProfileStoreSchemaVersion
  ) {
    return failure(typeof version === "string" ? "unsupported-version" : "invalid-input");
  }
  if (!validateCommon(value)) return failure("invalid-input");
  if (version === communityProfileStoreSchemaVersion) {
    if (!validateCurrentInternalState(value["internalState"])) return failure("invalid-input");
  } else if (!validateLegacyInternalState(value["internalState"])) {
    return failure("invalid-input");
  }
  const detached = JSON.parse(JSON.stringify(value)) as ParsedCommunityProfileStore;
  const parsed = deepFreeze(detached);
  issuedParsedStores.add(parsed);
  return deepFreeze({ ok: true as const, value: parsed });
}

export function migrateCommunityProfileStore(
  source: LegacyCommunityProfileStore,
  input: { readonly generation: number; readonly validatedAt: string },
): MigrateCommunityProfileStoreResult {
  if (
    !issuedParsedStores.has(source) ||
    source.storeSchemaVersion !== legacyCommunityProfileStoreSchemaVersion ||
    !Number.isSafeInteger(input.generation) ||
    input.generation <= source.internalState.generation ||
    !isCanonicalTimestamp(input.validatedAt) ||
    source.internalState.updatedAt > input.validatedAt
  ) {
    return failure("invalid-input");
  }
  const candidate = {
    storeSchemaVersion: communityProfileStoreSchemaVersion,
    kind: "community-profile-store" as const,
    storeId: source.storeId,
    profileVersion: source.profileVersion,
    subjectRef: source.subjectRef,
    profile: source.profile,
    internalState: {
      generation: input.generation,
      createdAt: source.internalState.createdAt,
      updatedAt: source.internalState.updatedAt,
      lastValidatedAt: input.validatedAt,
      migratedFromStoreSchemaVersion: legacyCommunityProfileStoreSchemaVersion,
    },
  };
  const serialized = serializeCommunityProfileStore(candidate);
  if (!serialized.ok) return serialized;
  const parsed = parseCommunityProfileStore(serialized.value);
  if (!parsed.ok || parsed.value.storeSchemaVersion !== communityProfileStoreSchemaVersion) {
    return failure(parsed.ok ? "invalid-input" : parsed.error.category);
  }
  return deepFreeze({ ok: true as const, value: parsed.value });
}

export function serializeCommunityProfileStore(value: CommunityProfileStore):
  | { readonly ok: true; readonly value: string }
  | {
      readonly ok: false;
      readonly error: {
        readonly category: CommunityProfileStoreFormatErrorCategory;
        readonly retryable: false;
      };
    } {
  let source: string;
  try {
    source = `${JSON.stringify(value)}\n`;
  } catch {
    return failure("invalid-input");
  }
  const parsed = parseCommunityProfileStore(source);
  if (!parsed.ok) return parsed;
  if (parsed.value.storeSchemaVersion !== communityProfileStoreSchemaVersion) {
    return failure("unsupported-version");
  }
  return deepFreeze({ ok: true as const, value: source });
}

function validateCommon(value: Record<string, unknown>): boolean {
  if (
    !hasExactKeys(value, [
      "storeSchemaVersion",
      "kind",
      "storeId",
      "profileVersion",
      "subjectRef",
      "profile",
      "internalState",
    ]) ||
    value["kind"] !== "community-profile-store" ||
    !isIdentifier(value["storeId"]) ||
    !isIdentifier(value["profileVersion"]) ||
    !isIdentifier(value["subjectRef"])
  ) {
    return false;
  }
  return isPortableProfileExport({
    schemaVersion: "0.1.0",
    kind: "portable-profile-export",
    exportId: "export_internal_validation",
    profileVersion: value["profileVersion"],
    subjectRef: value["subjectRef"],
    generatedAt: "2000-01-01T00:00:00Z",
    profile: value["profile"],
    exclusions: {
      credentials: true,
      rawSource: true,
      sourceGrants: true,
      sharingGrants: true,
      internalState: true,
    },
  });
}

function validateCurrentInternalState(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "generation",
      "createdAt",
      "updatedAt",
      "lastValidatedAt",
      "migratedFromStoreSchemaVersion",
    ]) ||
    !isGeneration(value["generation"]) ||
    !isCanonicalTimestamp(value["createdAt"]) ||
    !isCanonicalTimestamp(value["updatedAt"]) ||
    !isCanonicalTimestamp(value["lastValidatedAt"]) ||
    (value["migratedFromStoreSchemaVersion"] !== null &&
      (typeof value["migratedFromStoreSchemaVersion"] !== "string" ||
        value["migratedFromStoreSchemaVersion"].length > 32 ||
        !semanticVersionPattern.test(value["migratedFromStoreSchemaVersion"])))
  ) {
    return false;
  }
  return value["createdAt"] <= value["updatedAt"] && value["updatedAt"] <= value["lastValidatedAt"];
}

function validateLegacyInternalState(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["generation", "createdAt", "updatedAt"]) &&
    isGeneration(value["generation"]) &&
    isCanonicalTimestamp(value["createdAt"]) &&
    isCanonicalTimestamp(value["updatedAt"]) &&
    value["createdAt"] <= value["updatedAt"]
  );
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]Z$/u.test(
      value,
    )
  )
    return false;
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value.replace("Z", ".000Z")
  );
}

function isGeneration(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && identifierPattern.test(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort(compareText);
  const expected = [...keys].sort(compareText);
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failure(category: CommunityProfileStoreFormatErrorCategory): {
  readonly ok: false;
  readonly error: {
    readonly category: CommunityProfileStoreFormatErrorCategory;
    readonly retryable: false;
  };
} {
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
