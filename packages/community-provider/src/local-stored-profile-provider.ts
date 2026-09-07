import { createHash } from "node:crypto";
import {
  compileDeveloperContextPacket,
  intersectDemandProfileWithDeveloperProfile,
} from "@fork-me-up/core";
import {
  isProfileProviderRequest,
  isProfileProviderResponse,
  utf8ByteLength,
  type ProfileProviderCapabilities,
  type ProfileProviderErrorCategory,
  type ProfileProviderOperation,
  type ProfileProviderResponse,
  type ProfilePayload,
} from "@fork-me-up/protocol";
import {
  isIssuedLocalProfileStoreConfig,
  type ResolvedLocalProfileStoreConfig,
} from "./local-profile-store-config.ts";
import { loadLocalProfileStore } from "./local-profile-store.ts";
import { produceDemandProfile } from "./demand-profile-producer.ts";
import type { FilesystemMetadataSnapshot } from "./filesystem-metadata-collector.ts";

export interface LocalStoredProfileProviderOptions {
  readonly projectRef: string;
  readonly repositoryId: string;
  readonly clock: () => Date;
  readonly createId: (kind: "demand" | "packet") => string;
  readonly source?: () => FilesystemMetadataSnapshot | null;
  readonly available?: () => boolean;
  readonly maxObservationAgeMs: number;
}
export interface LocalStoredProfileProvider {
  readonly capabilities: ProfileProviderCapabilities;
  invoke(request: unknown): Promise<ProfileProviderResponse>;
}
const operations: readonly ProfileProviderOperation[] = [
  "get-provider-capabilities",
  "get-profile-metadata",
  "get-task-context",
];
const sensitiveIdentifier =
  /CANARY|(?:ghp_|github_pat_|sk-)|AKIA[0-9A-Z]{16}|password|secret|token/iu;
const fallbackCorrelation = {
  requestId: "request_invalid",
  operation: "get-provider-capabilities" as const,
};

/** Local owner-selected read surface. Collection, persistence and owner operations remain separate. */
export function createLocalStoredProfileProvider(
  configuration: ResolvedLocalProfileStoreConfig,
  options: LocalStoredProfileProviderOptions,
): LocalStoredProfileProvider {
  if (!isIssuedLocalProfileStoreConfig(configuration) || !validOptions(options))
    throw new TypeError("Invalid local provider configuration.");
  const settings = Object.freeze({ ...options });
  let previousTime: number | null = null;
  const capabilities = freeze<ProfileProviderCapabilities>({
    schemaVersion: "0.1.0",
    kind: "profile-provider-capabilities",
    providerId: "provider_local_community",
    protocolVersions: ["0.1.0"],
    operations,
    sourceClasses: ["selected-local-repository"],
    disclosureClasses: ["task-context"],
    deployment: "local",
    limits: {
      maxTaskBytes: 1024,
      maxOutputBytes: 32_768,
      maxOutputTokens: 8_192,
      maxRequestedCapabilities: 32,
    },
    freshnessSupport: { partialResults: true, staleResults: true },
  });
  return Object.freeze({
    capabilities,
    async invoke(input: unknown): Promise<ProfileProviderResponse> {
      let correlation: { requestId: string; operation: ProfileProviderOperation } =
        fallbackCorrelation;
      try {
        correlation = safeCorrelation(input);
        if (
          record(input) &&
          typeof input["schemaVersion"] === "string" &&
          input["schemaVersion"] !== "0.1.0"
        )
          return errorResponse(correlation, "unsupported-version", false, ["0.1.0"]);
        if (!isProfileProviderRequest(input) || sensitiveIdentifier.test(input.requestId))
          return errorResponse(correlation, "invalid-input");
        const request = input;
        if (!operations.includes(request.operation))
          return errorResponse(correlation, "unsupported-operation");
        if (request.operation === "get-provider-capabilities")
          return successResponse(correlation, capabilities);
        if (
          request.operation === "get-task-context" &&
          (utf8ByteLength(request.input.task) > capabilities.limits.maxTaskBytes ||
            request.input.maxTokens > capabilities.limits.maxOutputTokens ||
            request.input.requestedCapabilities.length >
              capabilities.limits.maxRequestedCapabilities)
        )
          return errorResponse(correlation, "invalid-input");
        if (settings.available !== undefined && settings.available() !== true)
          return errorResponse(correlation, "profile-unavailable");
        const clock = settings.clock();
        if (!(clock instanceof Date) || !Number.isFinite(clock.getTime()))
          return errorResponse(correlation, "profile-unavailable");
        const milliseconds = clock.getTime();
        if (previousTime !== null && milliseconds < previousTime)
          return errorResponse(correlation, "profile-unavailable");
        const at = canonicalTime(Math.floor(milliseconds / 1000) * 1000);
        previousTime = milliseconds;
        const loaded = await loadLocalProfileStore(configuration);
        if (
          !loaded.ok ||
          loaded.value === null ||
          (settings.available !== undefined && settings.available() !== true)
        )
          return errorResponse(correlation, "profile-unavailable");
        const stored = loaded.value;
        if (stored.internalState.lastValidatedAt > at || futureProfile(stored.profile, at))
          return errorResponse(correlation, "profile-unavailable");
        const profile = freeze({
          profileVersion: `profile_${createHash("sha256").update(stored.profileVersion).digest("hex")}`,
          profile: {
            ...stored.profile,
            claims: stored.profile.claims.map((claim) => ({
              ...claim,
              freshness: {
                ...claim.freshness,
                stale:
                  claim.freshness.stale ||
                  (claim.freshness.observedThrough !== null &&
                    Date.parse(claim.freshness.observedThrough) <
                      milliseconds - settings.maxObservationAgeMs),
              },
            })),
          },
        });
        if (request.operation === "get-profile-metadata") {
          const observed = [
            ...profile.profile.evidence.map((item) => item.freshness.observedAt),
            ...profile.profile.claims.flatMap((item) =>
              item.freshness.observedThrough === null ? [] : [item.freshness.observedThrough],
            ),
          ].sort();
          return successResponse(correlation, {
            profileVersion: profile.profileVersion,
            freshnessStatus: profile.profile.claims.some((claim) => claim.freshness.stale)
              ? "stale"
              : profile.profile.claims.some((claim) => claim.freshness.observedThrough === null)
                ? "partial"
                : "fresh",
            observedThrough: observed.at(-1) ?? null,
            claimCount: profile.profile.claims.length,
            evidenceCount: profile.profile.evidence.length,
          });
        }
        if (request.operation !== "get-task-context")
          return errorResponse(correlation, "unsupported-operation");
        const demand = produceDemandProfile(
          JSON.stringify({
            producerVersion: "0.1.0",
            demandId: settings.createId("demand"),
            generatedAt: at,
            project: {
              projectRef: settings.projectRef,
              repositoryId: settings.repositoryId,
              sourcePaths: null,
            },
            task: {
              summary: request.input.task,
              purpose: request.input.purpose,
              capabilities: request.input.requestedCapabilities.map((capability) => ({
                capability,
                relevance: "required",
              })),
              alternatives: [],
            },
          }),
          settings.source?.() ?? null,
        );
        if (!demand.ok || demand.status !== "ready")
          return errorResponse(correlation, "profile-unavailable");
        const intersection = intersectDemandProfileWithDeveloperProfile(demand.value, profile);
        if (!intersection.ok) return errorResponse(correlation, "internal-error");
        const compiled = compileDeveloperContextPacket(intersection.value, {
          packetId: settings.createId("packet"),
          generatedAt: at,
          expiresAt: canonicalTime(Math.floor(milliseconds / 1000) * 1000 + 3_600_000),
          authorization: "allow",
          audience: { class: "local-assistant", consumerId: null },
          disclosureClass: "task-context",
          budget: {
            maxBytes: capabilities.limits.maxOutputBytes,
            maxTokens: request.input.maxTokens,
          },
        });
        if (!compiled.ok)
          return errorResponse(
            correlation,
            compiled.error.category === "budget-exceeded"
              ? "budget-too-small"
              : compiled.error.category === "redaction-failed"
                ? "redaction-failed"
                : "internal-error",
          );
        if (settings.available !== undefined && settings.available() !== true)
          return errorResponse(correlation, "profile-unavailable");
        return successResponse(correlation, compiled.value.packet);
      } catch {
        return errorResponse(correlation, "profile-unavailable");
      }
    },
  });
}
function validOptions(value: LocalStoredProfileProviderOptions): boolean {
  return (
    record(value) &&
    Object.keys(value).every((key) =>
      [
        "projectRef",
        "repositoryId",
        "clock",
        "createId",
        "source",
        "available",
        "maxObservationAgeMs",
      ].includes(key),
    ) &&
    identifier(value.projectRef) &&
    identifier(value.repositoryId) &&
    typeof value.clock === "function" &&
    typeof value.createId === "function" &&
    (value.source === undefined || typeof value.source === "function") &&
    (value.available === undefined || typeof value.available === "function") &&
    Number.isSafeInteger(value.maxObservationAgeMs) &&
    value.maxObservationAgeMs >= 0 &&
    value.maxObservationAgeMs <= 86_400_000
  );
}
function futureProfile(profile: ProfilePayload, at: string): boolean {
  return (
    profile.evidence.some((item) => item.freshness.collectedAt > at) ||
    profile.claims.some(
      (item) => item.freshness.observedThrough !== null && item.freshness.observedThrough > at,
    ) ||
    profile.declarations.some((item) => item.declaredAt > at) ||
    profile.corrections.some((item) => item.createdAt > at)
  );
}
function safeCorrelation(value: unknown): {
  requestId: string;
  operation: ProfileProviderOperation;
} {
  if (!record(value)) return fallbackCorrelation;
  return {
    requestId:
      identifier(value["requestId"]) && !sensitiveIdentifier.test(value["requestId"])
        ? value["requestId"]
        : "request_invalid",
    operation: [...operations, "get-capability-evidence"].includes(String(value["operation"]))
      ? (value["operation"] as ProfileProviderOperation)
      : "get-provider-capabilities",
  };
}
function successResponse(
  correlation: { requestId: string; operation: ProfileProviderOperation },
  data: Extract<ProfileProviderResponse, { outcome: "success" }>["data"],
): ProfileProviderResponse {
  const result = {
    schemaVersion: "0.1.0",
    kind: "profile-provider-response",
    ...correlation,
    outcome: "success",
    data,
    error: null,
  };
  return isProfileProviderResponse(result)
    ? freeze(result)
    : errorResponse(correlation, "internal-error");
}
function errorResponse(
  correlation: { requestId: string; operation: ProfileProviderOperation },
  category: ProfileProviderErrorCategory,
  retryable = false,
  supportedVersions: readonly string[] = [],
): ProfileProviderResponse {
  return freeze({
    schemaVersion: "0.1.0",
    kind: "profile-provider-response",
    ...correlation,
    outcome: "error",
    data: null,
    error: { category, retryable, supportedVersions },
  });
}
function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}(?![\s\S])/u.test(value);
}
function canonicalTime(milliseconds: number): string {
  const value = new Date(milliseconds).toISOString().replace(".000Z", "Z");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z(?![\s\S])/u.test(value))
    throw new Error("Invalid clock.");
  return value;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function freeze<Value>(value: Value): Value {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
