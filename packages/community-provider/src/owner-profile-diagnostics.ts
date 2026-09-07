import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import {
  isDeveloperContextPacket,
  isProfileProviderResponse,
  type CapabilityEvidence,
  type Claim,
} from "@fork-me-up/protocol";
import {
  isIssuedLocalProfileStoreConfig,
  type ResolvedLocalProfileStoreConfig,
} from "./local-profile-store-config.ts";
import {
  loadLocalProfileStore,
  nodeLocalProfileStorePort,
  type LocalProfileStoreFilePort,
} from "./local-profile-store.ts";

export const ownerDiagnosticsLimits = Object.freeze({
  inputBytes: 65_536,
  outputBytes: 32_768,
  claims: 8,
  evidencePerClaim: 8,
});
export interface OwnerDiagnosticsOptions {
  readonly port?: LocalProfileStoreFilePort;
  /** Trusted composition probes; never fields supplied by the owner request. */
  readonly inspectAdapterCache?: (at: string) => Promise<unknown>;
  readonly installation?: {
    readonly modules: "available";
    readonly runtime: "supported" | "unsupported";
  };
}
type CacheStatus =
  "ready" | "absent" | "deleted" | "busy" | "invalid" | "unavailable" | "limit-exceeded";
interface CacheInspection {
  readonly status: CacheStatus;
  readonly entries: number;
  readonly fresh: number;
  readonly stale: number;
}
type Failure = {
  readonly ok: false;
  readonly error: {
    readonly category:
      | "invalid-input"
      | "not-configured"
      | "limit-exceeded"
      | "redaction-failed"
      | "store-unavailable";
    readonly retryable: boolean;
  };
};
export type OwnerDiagnosticsResult =
  | Failure
  | { readonly ok: true; readonly status: "evidence" | "diagnosed"; readonly view: unknown };
const safeLimitations = new Set([
  "source-risk-fork",
  "source-risk-template",
  "source-risk-generated",
  "source-risk-vendored",
  "source-risk-tutorial",
  "source-risk-duplicated",
  "source-risk-uncertain",
  "origin-unverified",
  "automated-language-derivation",
  "project-scoped-source-evidence",
  "no-attributable-evidence",
  "weak-source-evidence",
  "evidence-reference-limit-reached",
  "stale-evidence",
  "no-standalone-demonstrated-depth",
  "additional-limitations-omitted",
]);

/** Owner-only metadata. This does not advertise or enable consumer evidence disclosure. */
export async function runOwnerDiagnostics(
  configuration: ResolvedLocalProfileStoreConfig | null,
  requestJson: string,
  options: OwnerDiagnosticsOptions = {},
): Promise<OwnerDiagnosticsResult> {
  try {
    if (typeof requestJson !== "string" || !requestJson.isWellFormed())
      return failure("invalid-input");
    if (Buffer.byteLength(requestJson, "utf8") > ownerDiagnosticsLimits.inputBytes)
      return failure("limit-exceeded");
    const request: unknown = JSON.parse(requestJson);
    if (!record(request) || request["version"] !== "0.1.0") return failure("invalid-input");
    if (configuration !== null && !isIssuedLocalProfileStoreConfig(configuration))
      return failure("not-configured");
    if (request["operation"] === "get-capability-evidence") {
      if (
        !shape(request, ["version", "operation", "capability", "limit"]) ||
        !capability(request["capability"]) ||
        !integer(request["limit"], 1, ownerDiagnosticsLimits.claims)
      )
        return failure("invalid-input");
      if (configuration === null) return failure("not-configured");
      if (sensitive(request["capability"])) return failure("redaction-failed");
      const loaded = await loadLocalProfileStore(
        configuration,
        options.port === undefined ? {} : { port: options.port },
      );
      if (!loaded.ok) return failure("store-unavailable", loaded.error.retryable);
      if (loaded.value === null)
        return evidenceSuccess({
          state: "absent",
          generation: null,
          totalClaims: 0,
          truncated: false,
          claims: [],
        });
      const profile = loaded.value.profile;
      const matching = profile.claims.filter((claim) => claim.capability === request["capability"]);
      const historical = new Set(
        profile.claims
          .filter((claim) => claim.state === "disputed")
          .flatMap((claim) => {
            const target = profile.corrections.find(
              (item) => item.correctionId === claim.basis.correctionRef,
            )?.targetClaimRef;
            return target !== undefined && target !== null && target !== claim.claimId
              ? [target]
              : [];
          }),
      );
      const claims = matching.slice(0, request["limit"]).map((claim) => {
        const correctedTarget =
          profile.corrections.find((item) => item.correctionId === claim.basis.correctionRef)
            ?.targetClaimRef ?? claim.claimId;
        const allEvidence = profile.evidence.filter((item) =>
          claim.basis.evidenceRefs.includes(item.evidenceId),
        );
        const evidence: CapabilityEvidence = {
          capability: claim.capability,
          claimRef: opaque(claim.claimId),
          evidence: allEvidence.slice(0, ownerDiagnosticsLimits.evidencePerClaim).map((item) => ({
            evidenceRef: opaque(item.evidenceId),
            sourceClass: item.source.class,
            strength: item.strength,
            observedAt: item.freshness.observedAt,
            limitations: limitations(item.limitations),
          })),
          limitations: limitations(claim.limitations),
        };
        if (
          !isProfileProviderResponse({
            schemaVersion: "0.1.0",
            kind: "profile-provider-response",
            requestId: "owner_evidence",
            operation: "get-capability-evidence",
            outcome: "success",
            error: null,
            data: evidence,
          })
        )
          throw new Error("invalid-metadata");
        return {
          ...assessment(claim),
          historical: historical.has(claim.claimId),
          totalEvidence: allEvidence.length,
          truncated: allEvidence.length > evidence.evidence.length,
          correctionCount: profile.corrections.filter(
            (item) => item.targetClaimRef === correctedTarget,
          ).length,
          evidence,
        };
      });
      return evidenceSuccess({
        state: loaded.status,
        generation: loaded.value.internalState.generation,
        totalClaims: matching.length,
        truncated: matching.length > claims.length,
        claims,
      });
    }
    if (
      request["operation"] !== "doctor" ||
      !shape(request, [
        "version",
        "operation",
        "at",
        "packet",
        "maxContextBytes",
        "maxContextTokens",
      ]) ||
      !timestamp(request["at"]) ||
      !integer(request["maxContextBytes"], 1, 32_768) ||
      !integer(request["maxContextTokens"], 1, 8_192)
    )
      return failure("invalid-input");
    const mutationBefore =
      configuration === null
        ? "not-checked"
        : await mutationState(configuration, options.port ?? nodeLocalProfileStorePort);
    const loaded =
      configuration === null
        ? null
        : await loadLocalProfileStore(
            configuration,
            options.port === undefined ? {} : { port: options.port },
          );
    const mutationAfter =
      configuration === null
        ? "not-checked"
        : await mutationState(configuration, options.port ?? nodeLocalProfileStorePort);
    const mutation =
      mutationBefore === "blocked" || mutationAfter === "blocked"
        ? "blocked"
        : mutationBefore === mutationAfter
          ? mutationAfter
          : "unavailable";
    const store =
      loaded === null
        ? { state: "not-configured", schema: "not-checked" }
        : !loaded.ok
          ? { state: storeFailureState(loaded.error.category), schema: "not-validated" }
          : {
              state: loaded.status,
              schema: loaded.value === null ? "not-present" : "valid",
              maintenanceRequired: loaded.maintenanceRequired,
              generation: loaded.value?.internalState.generation ?? null,
              claimCount: loaded.value?.profile.claims.length ?? 0,
              evidenceCount: loaded.value?.profile.evidence.length ?? 0,
            };
    let cache: CacheInspection = cacheUnavailable();
    if (options.inspectAdapterCache !== undefined) {
      try {
        cache = validatedCache(await options.inspectAdapterCache(request["at"]));
      } catch {
        /* Fixed unavailable state. */
      }
    }
    const packet = request["packet"];
    const context =
      packet === null
        ? { state: "not-provided", bytes: null, tokenUpperBound: null }
        : !isDeveloperContextPacket(packet)
          ? { state: "invalid", bytes: null, tokenUpperBound: null }
          : contextSize(
              packet,
              request["at"],
              request["maxContextBytes"],
              request["maxContextTokens"],
            );
    const installation = options.installation;
    const view = {
      installation:
        installation?.modules === "available" &&
        ["supported", "unsupported"].includes(installation.runtime)
          ? { modules: "available", runtime: installation.runtime }
          : { modules: "not-checked", runtime: "not-checked" },
      supportedSchemas: { store: "0.1.0", protocol: "0.1.0" },
      store: { ...store, mutationGate: mutation },
      adapter: {
        state: options.inspectAdapterCache === undefined ? "not-checked" : "available",
        cache,
      },
      sourceCache: { persistence: "none", otherProcesses: "not-checked" },
      context,
    };
    return bounded({ ok: true, status: "diagnosed", view });
  } catch {
    return failure("invalid-input");
  }
}

function assessment(claim: Claim) {
  return {
    claimRef: opaque(claim.claimId),
    state: claim.state,
    observedDepth: claim.observedDepth,
    confidence: claim.confidence,
    scope: claim.scope,
    projectRef: claim.projectRef === null ? null : opaque(claim.projectRef),
    freshness: { ...claim.freshness },
  };
}
function limitations(values: readonly string[]): string[] {
  const result = [...new Set(values.filter((value) => safeLimitations.has(value)))];
  if (values.some((value) => !safeLimitations.has(value)))
    result.push("private-limitations-omitted");
  return result.length <= 8 ? result : [...result.slice(0, 7), "additional-limitations-omitted"];
}
function contextSize(
  packet: { readonly generatedAt: string; readonly expiresAt: string },
  at: string,
  maximumBytes: number,
  maximumTokens: number,
) {
  const bytes = Buffer.byteLength(JSON.stringify(packet), "utf8");
  return {
    state:
      packet.generatedAt > at
        ? "future"
        : packet.expiresAt <= at
          ? "expired"
          : bytes > maximumBytes || bytes > maximumTokens
            ? "over-budget"
            : "within-budget",
    bytes,
    tokenUpperBound: bytes,
  };
}
async function mutationState(
  configuration: ResolvedLocalProfileStoreConfig,
  port: LocalProfileStoreFilePort,
): Promise<"available" | "blocked" | "unavailable"> {
  try {
    const directory = await port.inspectDirectory(
      configuration.directoryPath,
      configuration.platform,
    );
    if (
      directory.kind !== "directory" ||
      directory.canonicalPath !== configuration.directoryPath ||
      directory.pathIdentity !== configuration.directoryIdentity
    )
      return "unavailable";
    const marker = await port.readEntry(
      configuration.directoryPath,
      ".community-profile-store.mutation.lock",
      64,
      configuration.platform,
    );
    const after = await port.inspectDirectory(configuration.directoryPath, configuration.platform);
    if (
      after.kind !== "directory" ||
      after.canonicalPath !== configuration.directoryPath ||
      after.pathIdentity !== configuration.directoryIdentity
    )
      return "unavailable";
    return marker === null ? "available" : "blocked";
  } catch {
    return "unavailable";
  }
}
function storeFailureState(category: string): string {
  if (category === "profile-deleted") return "deleted";
  if (category === "unsupported-version") return "unsupported-version";
  if (category === "limit-exceeded") return "limit-exceeded";
  if (category === "invalid-input" || category === "corrupt-store") return "invalid";
  if (category === "migration-required") return "migration-required";
  if (category === "not-authorized") return "not-authorized";
  return "unavailable";
}
function validatedCache(value: unknown): CacheInspection {
  if (
    !shape(value, ["status", "entries", "fresh", "stale"]) ||
    !["ready", "absent", "deleted", "busy", "invalid", "unavailable", "limit-exceeded"].includes(
      String(value["status"]),
    ) ||
    !integer(value["entries"], 0, 256) ||
    !integer(value["fresh"], 0, 256) ||
    !integer(value["stale"], 0, 256) ||
    value["fresh"] + value["stale"] !== value["entries"] ||
    (value["status"] !== "ready" && value["entries"] !== 0)
  )
    return cacheUnavailable();
  return {
    status: value["status"] as CacheStatus,
    entries: value["entries"],
    fresh: value["fresh"],
    stale: value["stale"],
  };
}
function cacheUnavailable(): CacheInspection {
  return { status: "unavailable", entries: 0, fresh: 0, stale: 0 };
}
function evidenceSuccess(view: unknown): OwnerDiagnosticsResult {
  const result = { ok: true as const, status: "evidence" as const, view };
  return sensitive(JSON.stringify(result)) ? failure("redaction-failed") : bounded(result);
}
function bounded(result: OwnerDiagnosticsResult): OwnerDiagnosticsResult {
  return Buffer.byteLength(JSON.stringify(result), "utf8") > ownerDiagnosticsLimits.outputBytes
    ? failure("limit-exceeded")
    : freeze(result);
}
function failure(category: Failure["error"]["category"], retryable = false): Failure {
  return freeze({ ok: false, error: { category, retryable } });
}
function opaque(value: string): string {
  return `ref_${createHash("sha256").update(value).digest("hex")}`;
}
function sensitive(value: string): boolean {
  return /(?:FMU[_-][A-Z0-9_-]*CANARY|(?<![A-Za-z0-9])(?:ghp_|github_pat_|sk-)[A-Za-z0-9_-]{8,}|AKIA[0-9A-Z]{16}|-----BEGIN .*PRIVATE KEY-----)/iu.test(
    value,
  );
}
function capability(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 128 &&
    /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*(?![\s\S])/u.test(value)
  );
}
function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
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
function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z(?![\s\S])/u.test(value))
    return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value.replace("Z", ".000Z");
}
function freeze<Value>(value: Value): Value {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
