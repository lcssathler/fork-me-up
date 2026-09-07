import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { TextDecoder } from "node:util";
import {
  isPortableProfileExport,
  type PortableProfileExport,
  type ProfilePayload,
} from "@fork-me-up/protocol";
import {
  type ResolvedLocalProfileStoreConfig,
  isIssuedLocalProfileStoreConfig,
  resolveLocalProfileStoreConfig,
} from "./local-profile-store-config.ts";
import {
  deleteLocalProfileStore,
  loadLocalProfileStore,
  nodeLocalProfileStorePort,
  writeLocalProfileStore,
  type LocalProfileStoreFilePort,
  type LocalProfileStoreErrorCategory,
} from "./local-profile-store.ts";
import { disposeIncrementalRefreshSessions } from "./incremental-refresh.ts";

export const ownerPortabilityMaximumInputBytes = 4_194_304;
export const portableProfileArtifactMaximumBytes = ownerPortabilityMaximumInputBytes - 32_768;
type PortabilityError =
  LocalProfileStoreErrorCategory | "redaction-failed" | "not-found" | "export-outcome-unknown";
type Failure = {
  readonly ok: false;
  readonly error: { readonly category: PortabilityError; readonly retryable: boolean };
};
export type OwnerPortabilityResult =
  | Failure
  | {
      readonly ok: true;
      readonly status: "imported" | "exported" | "deleted";
      readonly generation: number | null;
      readonly fileName: string | null;
      readonly disposedSessions: number;
      readonly maintenanceRequired: boolean;
    };
export interface OwnerPortabilityOptions {
  readonly port?: LocalProfileStoreFilePort;
  readonly nonce?: string;
  /** Required for full CLI cache deletion; implemented by the adapter, never by Community. */
  readonly clearAdapterCache?: () => Promise<{ readonly ok: boolean }>;
}

/** Explicit first-party operations; no Provider/MCP registration. */
export async function runOwnerPortabilityOperation(
  configuration: ResolvedLocalProfileStoreConfig,
  requestJson: string,
  options: OwnerPortabilityOptions = {},
): Promise<OwnerPortabilityResult> {
  if (!isIssuedLocalProfileStoreConfig(configuration)) return failure("not-configured");
  try {
    if (
      typeof requestJson !== "string" ||
      !requestJson.isWellFormed() ||
      Buffer.byteLength(requestJson, "utf8") > ownerPortabilityMaximumInputBytes
    )
      return failure("limit-exceeded");
    const request: unknown = JSON.parse(requestJson);
    if (!record(request) || request["version"] !== "0.1.0") return failure("invalid-input");
    const port = options.port ?? nodeLocalProfileStorePort;
    if (request["operation"] === "delete") {
      if (
        !shape(request, ["version", "operation", "confirm", "cacheScope"]) ||
        request["confirm"] !== "delete-local-profile" ||
        request["cacheScope"] !== "all-local-adapter-caches" ||
        options.clearAdapterCache === undefined
      )
        return failure("invalid-input");
      const disposedSessions = disposeIncrementalRefreshSessions(configuration.subjectRef);
      const deleted = await deleteLocalProfileStore(configuration, { port });
      if (!deleted.ok) return deleted;
      let caches;
      try {
        caches = await options.clearAdapterCache();
      } catch {
        return failure("deletion-incomplete", true);
      }
      if (!caches.ok) return failure("deletion-incomplete", true);
      return success("deleted", null, null, disposedSessions);
    }
    if (!timestamp(request["at"])) return failure("invalid-input");
    if (request["operation"] === "import") {
      if (
        !shape(request, ["version", "operation", "at", "portableProfile"]) ||
        !isPortableProfileExport(request["portableProfile"])
      )
        return failure("invalid-input");
      const incoming = request["portableProfile"];
      if (
        incoming.subjectRef !== configuration.subjectRef ||
        incoming.generatedAt > request["at"] ||
        futureProfile(incoming.profile, request["at"])
      )
        return failure("invalid-input");
      const loaded = await loadLocalProfileStore(configuration, { port });
      if (!loaded.ok) return loaded;
      if (loaded.value !== null) return failure("conflict", true);
      const sanitized = projectPortable(
        incoming.profile,
        incoming.subjectRef,
        incoming.profileVersion,
        incoming.exportId,
        incoming.generatedAt,
      );
      if (sanitized === null) return failure("redaction-failed");
      const candidate = {
        storeSchemaVersion: "0.1.0",
        kind: "community-profile-store",
        storeId: configuration.storeId,
        subjectRef: configuration.subjectRef,
        profileVersion: sanitized.profileVersion,
        profile: sanitized.profile,
        internalState: {
          generation: 0,
          createdAt: request["at"],
          updatedAt: request["at"],
          lastValidatedAt: request["at"],
          migratedFromStoreSchemaVersion: null,
        },
      };
      const written = await writeLocalProfileStore(configuration, JSON.stringify(candidate), {
        expectedGeneration: null,
        port,
        ...(options.nonce === undefined ? {} : { nonce: options.nonce }),
      });
      if (!written.ok) return written;
      return success(
        "imported",
        written.value.internalState.generation,
        null,
        0,
        written.maintenanceRequired,
      );
    }
    if (
      request["operation"] !== "export" ||
      !shape(request, [
        "version",
        "operation",
        "at",
        "expectedGeneration",
        "exportId",
        "destinationDirectory",
      ]) ||
      !Number.isSafeInteger(request["expectedGeneration"]) ||
      Number(request["expectedGeneration"]) < 0 ||
      !identifier(request["exportId"]) ||
      typeof request["destinationDirectory"] !== "string"
    )
      return failure("invalid-input");
    const loaded = await loadLocalProfileStore(configuration, { port });
    if (!loaded.ok) return loaded;
    if (loaded.value === null) return failure("not-found");
    if (loaded.value.internalState.generation !== request["expectedGeneration"])
      return failure("conflict", true);
    if (
      loaded.value.internalState.lastValidatedAt > request["at"] ||
      futureProfile(loaded.value.profile, request["at"])
    )
      return failure("invalid-input");
    const portable = projectPortable(
      loaded.value.profile,
      configuration.subjectRef,
      loaded.value.profileVersion,
      request["exportId"],
      request["at"],
    );
    if (portable === null) return failure("redaction-failed");
    const destination = await resolveLocalProfileStoreConfig(
      JSON.stringify({
        configVersion: "0.1.0",
        directoryPath: request["destinationDirectory"],
        storeId: configuration.storeId,
        subjectRef: configuration.subjectRef,
      }),
    );
    if (!destination.ok) return destination;
    const fileName = `portable-profile-export.${portable.exportId}.json`;
    const nonce = options.nonce ?? randomUUID();
    if (!/^[A-Za-z0-9_-]{1,36}(?![\s\S])/u.test(nonce)) return failure("invalid-input");
    const temporary = `.portable-profile-export.${portable.exportId}_${nonce}.tmp`;
    const bytes = Buffer.from(`${JSON.stringify(portable)}\n`, "utf8");
    if (bytes.length > portableProfileArtifactMaximumBytes) return failure("limit-exceeded");
    let staged = false;
    let linked = false;
    try {
      await checkDirectory(destination.value, port);
      staged =
        (await port.writeEntryExclusive(destination.value.directoryPath, temporary, bytes)) ===
        "created";
      if (!staged) return failure("conflict", true);
      await verifyExport(destination.value, temporary, bytes, port);
      await checkDirectory(destination.value, port);
      if (
        (await port.linkEntryExclusive(destination.value.directoryPath, temporary, fileName)) !==
        "linked"
      )
        return failure("conflict", true);
      linked = true;
      await port.syncDirectory(destination.value.directoryPath, destination.value.platform);
      await verifyExport(destination.value, fileName, bytes, port);
      const removed = await port
        .removeEntry(destination.value.directoryPath, temporary)
        .catch(() => false);
      staged = false;
      return success("exported", loaded.value.internalState.generation, fileName, 0, !removed);
    } catch {
      return failure(linked ? "export-outcome-unknown" : "persistence-failed", true);
    } finally {
      if (staged)
        await port.removeEntry(destination.value.directoryPath, temporary).catch(() => false);
    }
  } catch {
    return failure("invalid-input");
  }
}

/** Rebuild every public field; private text never survives by accident. */
function projectPortable(
  profile: ProfilePayload,
  subjectRef: string,
  profileVersion: string,
  exportId: string,
  generatedAt: string,
): PortableProfileExport | null {
  const semantic = [
    subjectRef,
    ...profile.claims.map((item) => item.capability),
    ...profile.evidence.map((item) => item.capabilitySignal),
    ...profile.declarations.map((item) => item.capability),
    ...profile.corrections.map((item) => item.capability),
    ...profile.claims.flatMap((item) => item.basis.adjacentFrom),
  ];
  if (semantic.some(sensitive)) return null;
  const projected: PortableProfileExport = {
    schemaVersion: "0.1.0",
    kind: "portable-profile-export",
    exportId: opaque("export", exportId),
    profileVersion: opaque("profile", profileVersion),
    subjectRef,
    generatedAt,
    exclusions: {
      credentials: true,
      rawSource: true,
      sourceGrants: true,
      sharingGrants: true,
      internalState: true,
    },
    profile: {
      projectRefs: profile.projectRefs.map((id) => opaque("project", id)),
      preferences: { ...profile.preferences },
      evidence: profile.evidence.map((item) => ({
        schemaVersion: "0.1.0",
        kind: "observation",
        evidenceId: opaque("evidence", item.evidenceId),
        capabilitySignal: item.capabilitySignal,
        source: {
          class: item.source.class,
          visibility: item.source.visibility,
          sourceRelativeRef: `source/${opaque("ref", item.source.sourceRelativeRef)}`,
          repositoryRef: opaque("repository", item.source.repositoryRef),
          revisionRef: opaque("revision", item.source.revisionRef),
        },
        authorAssessment: {
          state: item.authorAssessment.state,
          subjectRef:
            item.authorAssessment.subjectRef === null
              ? null
              : item.authorAssessment.subjectRef === subjectRef
                ? subjectRef
                : opaque("subject", item.authorAssessment.subjectRef),
        },
        freshness: { ...item.freshness },
        strength: item.strength,
        limitations: limitations(item.limitations),
        extractor: { name: "portable-observation", version: "0.1.0" },
        invalidation: { rule: item.invalidation.rule, fingerprint: item.invalidation.fingerprint },
      })),
      claims: profile.claims.map((item) => ({
        schemaVersion: "0.1.0",
        claimId: opaque("claim", item.claimId),
        capability: item.capability,
        state: item.state,
        observedDepth: item.observedDepth,
        confidence: item.confidence,
        scope: item.scope,
        projectRef: item.projectRef === null ? null : opaque("project", item.projectRef),
        basis: {
          kind: item.basis.kind,
          evidenceRefs: item.basis.evidenceRefs.map((id) => opaque("evidence", id)),
          adjacentFrom: [...item.basis.adjacentFrom],
          rationale:
            item.basis.rationale === null
              ? null
              : "Private rationale omitted from portable profile.",
          declarationRef:
            item.basis.declarationRef === null
              ? null
              : opaque("declaration", item.basis.declarationRef),
          correctionRef:
            item.basis.correctionRef === null
              ? null
              : opaque("correction", item.basis.correctionRef),
          correctionSummary:
            item.basis.correctionSummary === null
              ? null
              : "Owner correction retained; private note omitted.",
        },
        limitations: limitations(item.limitations),
        freshness: { ...item.freshness },
      })),
      declarations: profile.declarations.map((item) => ({
        declarationId: opaque("declaration", item.declarationId),
        capability: item.capability,
        summary: "Owner declaration retained; private note omitted.",
        declaredAt: item.declaredAt,
      })),
      corrections: profile.corrections.map((item) => ({
        correctionId: opaque("correction", item.correctionId),
        kind: item.kind,
        capability: item.capability,
        targetClaimRef: item.targetClaimRef === null ? null : opaque("claim", item.targetClaimRef),
        summary: "Owner correction retained; private note omitted.",
        createdAt: item.createdAt,
      })),
    },
  };
  return isPortableProfileExport(projected) && !sensitive(JSON.stringify(projected))
    ? freeze(projected)
    : null;
}
function limitations(values: readonly string[]): readonly string[] {
  return values.map((_value, index) => `Limitation ${index + 1} retained; private text omitted.`);
}
function sensitive(value: string): boolean {
  return /(?:FMU[_-][A-Z0-9_-]*CANARY|(?:ghp_|github_pat_|sk-)[A-Za-z0-9_-]{8,}|AKIA[0-9A-Z]{16}|-----BEGIN .*PRIVATE KEY-----|\b(?:password|secret|token)\s*[:=]\s*\S+)/iu.test(
    value,
  );
}
function futureProfile(profile: ProfilePayload, at: string): boolean {
  return (
    profile.evidence.some((item) => item.freshness.collectedAt > at) ||
    profile.claims.some(
      (item) => item.freshness.observedThrough !== null && item.freshness.observedThrough > at,
    ) ||
    profile.corrections.some((item) => item.createdAt > at) ||
    profile.declarations.some((item) => item.declaredAt > at)
  );
}
async function checkDirectory(
  configuration: ResolvedLocalProfileStoreConfig,
  port: LocalProfileStoreFilePort,
): Promise<void> {
  const value = await port.inspectDirectory(configuration.directoryPath, configuration.platform);
  if (
    value.kind !== "directory" ||
    value.canonicalPath !== configuration.directoryPath ||
    value.pathIdentity !== configuration.directoryIdentity
  )
    throw new Error("not-authorized");
}
async function verifyExport(
  configuration: ResolvedLocalProfileStoreConfig,
  name: string,
  bytes: Uint8Array,
  port: LocalProfileStoreFilePort,
): Promise<void> {
  await checkDirectory(configuration, port);
  const actual = await port.readEntry(
    configuration.directoryPath,
    name,
    ownerPortabilityMaximumInputBytes,
    configuration.platform,
  );
  if (
    actual === null ||
    !Buffer.from(actual).equals(bytes) ||
    !isPortableProfileExport(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(actual)))
  )
    throw new Error("persistence-failed");
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function shape(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    record(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}(?![\s\S])/u.test(value);
}
function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z(?![\s\S])/u.test(value))
    return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value.replace("Z", ".000Z");
}
function opaque(prefix: string, value: string): string {
  return `${prefix}_${createHash("sha256").update(value).digest("hex")}`;
}
function success(
  status: "imported" | "exported" | "deleted",
  generation: number | null,
  fileName: string | null,
  disposedSessions = 0,
  maintenanceRequired = false,
): OwnerPortabilityResult {
  return freeze({ ok: true, status, generation, fileName, disposedSessions, maintenanceRequired });
}
function failure(category: PortabilityError, retryable = false): Failure {
  return freeze({ ok: false, error: { category, retryable } });
}
function freeze<Value>(value: Value): Value {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
