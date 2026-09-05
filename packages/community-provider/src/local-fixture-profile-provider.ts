import {
  compileDeveloperContextPacket,
  intersectDemandProfileWithDeveloperProfile,
  loadDeveloperProfileFromPortableExport,
  type LoadedDeveloperProfile,
} from "@fork-me-up/core";
import {
  isProfileProviderRequest,
  utf8ByteLength,
  type DemandProfile,
  type ProfileMetadata,
  type ProfileProviderCapabilities,
  type ProfileProviderErrorCategory,
  type ProfileProviderOperation,
  type ProfileProviderResponse,
  type TaskContextInput,
} from "@fork-me-up/protocol";

const protocolVersion = "0.1.0" as const;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;
const operations: readonly ProfileProviderOperation[] = [
  "get-provider-capabilities",
  "get-profile-metadata",
  "get-task-context",
];

export interface LocalFixtureProfileProviderOptions {
  readonly profile: unknown | null;
  readonly clock: () => Date;
  readonly createId: (kind: "demand" | "packet") => string;
}

export interface LocalFixtureProfileProvider {
  readonly capabilities: ProfileProviderCapabilities;
  invoke(request: unknown): ProfileProviderResponse;
}

export function createLocalFixtureProfileProvider(
  options: LocalFixtureProfileProviderOptions,
): LocalFixtureProfileProvider {
  const profile = loadProfile(options.profile);
  const capabilities = immutableCopy<ProfileProviderCapabilities>({
    schemaVersion: protocolVersion,
    kind: "profile-provider-capabilities",
    providerId: "provider_local_fixture",
    protocolVersions: [protocolVersion],
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
    invoke(requestInput: unknown): ProfileProviderResponse {
      const correlation = getSafeCorrelation(requestInput);
      if (isUnsupportedVersion(requestInput)) {
        return errorResponse(correlation, "unsupported-version", false, [protocolVersion]);
      }
      if (!isProfileProviderRequest(requestInput)) {
        return errorResponse(correlation, "invalid-input", false);
      }
      const request = requestInput;
      if (!operations.includes(request.operation)) {
        return errorResponse(request, "unsupported-operation", false);
      }
      if (request.operation === "get-provider-capabilities") {
        return successResponse(request, immutableCopy(capabilities));
      }
      if (
        request.operation === "get-task-context" &&
        (utf8ByteLength(request.input.task) > capabilities.limits.maxTaskBytes ||
          request.input.maxTokens > capabilities.limits.maxOutputTokens ||
          request.input.requestedCapabilities.length > capabilities.limits.maxRequestedCapabilities)
      ) {
        return errorResponse(request, "invalid-input", false);
      }
      if (profile === null) {
        return errorResponse(request, "profile-unavailable", false);
      }
      if (request.operation === "get-profile-metadata") {
        return successResponse(request, buildProfileMetadata(profile));
      }
      if (request.operation !== "get-task-context") {
        return errorResponse(request, "unsupported-operation", false);
      }
      const input: TaskContextInput = request.input;

      const now = canonicalTime(options.clock());
      const demand: DemandProfile = {
        schemaVersion: protocolVersion,
        kind: "demand-profile",
        demandId: options.createId("demand"),
        project: {
          projectRef: "project_local_fixture",
          metadataStatus: "unavailable",
          metadataRevisionRef: null,
        },
        task: { summary: input.task, purpose: input.purpose },
        capabilities: input.requestedCapabilities.map((capability) => ({
          capability,
          relevance: "required" as const,
          basis: "task-input" as const,
        })),
        generatedAt: now,
      };
      const intersection = intersectDemandProfileWithDeveloperProfile(demand, profile);
      if (!intersection.ok) return errorResponse(request, "internal-error", false);
      const generatedAtMilliseconds = Date.parse(now);
      const compilation = compileDeveloperContextPacket(intersection.value, {
        packetId: options.createId("packet"),
        generatedAt: now,
        expiresAt: canonicalTime(new Date(generatedAtMilliseconds + 60 * 60 * 1000)),
        authorization: "allow",
        audience: { class: "local-assistant", consumerId: null },
        disclosureClass: "task-context",
        budget: {
          maxBytes: capabilities.limits.maxOutputBytes,
          maxTokens: input.maxTokens,
        },
      });
      if (compilation.ok) return successResponse(request, compilation.value.packet);
      if (compilation.error.category === "budget-exceeded") {
        return errorResponse(request, "budget-too-small", false);
      }
      if (compilation.error.category === "redaction-failed") {
        return errorResponse(request, "redaction-failed", false);
      }
      return errorResponse(request, "internal-error", false);
    },
  });
}

function loadProfile(input: unknown | null): LoadedDeveloperProfile | null {
  if (input === null) return null;
  const loaded = loadDeveloperProfileFromPortableExport(input);
  if (!loaded.ok) throw new TypeError("Invalid fixture profile.");
  return loaded.value;
}

function buildProfileMetadata(profile: LoadedDeveloperProfile): ProfileMetadata {
  const observedValues = [
    ...profile.profile.evidence.map((item) => item.freshness.observedAt),
    ...profile.profile.claims.flatMap((item) =>
      item.freshness.observedThrough === null ? [] : [item.freshness.observedThrough],
    ),
  ].sort(compareText);
  const hasStaleClaim = profile.profile.claims.some((item) => item.freshness.stale);
  const hasUnknownFreshness = profile.profile.claims.some(
    (item) => item.freshness.observedThrough === null,
  );
  return immutableCopy({
    profileVersion: profile.profileVersion,
    freshnessStatus: hasStaleClaim ? "stale" : hasUnknownFreshness ? "partial" : "fresh",
    observedThrough: observedValues.at(-1) ?? null,
    claimCount: profile.profile.claims.length,
    evidenceCount: profile.profile.evidence.length,
  });
}

function getSafeCorrelation(value: unknown): {
  requestId: string;
  operation: ProfileProviderOperation;
} {
  if (!isRecord(value)) {
    return { requestId: "request_invalid", operation: "get-provider-capabilities" };
  }
  const requestId = value["requestId"];
  const operation = value["operation"];
  return {
    requestId:
      typeof requestId === "string" && identifierPattern.test(requestId)
        ? requestId
        : "request_invalid",
    operation: isProviderOperation(operation) ? operation : "get-provider-capabilities",
  };
}

function isUnsupportedVersion(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value["schemaVersion"] === "string" &&
    value["schemaVersion"] !== protocolVersion
  );
}

function isProviderOperation(value: unknown): value is ProfileProviderOperation {
  return (
    value === "get-provider-capabilities" ||
    value === "get-profile-metadata" ||
    value === "get-task-context" ||
    value === "get-capability-evidence"
  );
}

function successResponse(
  request: { requestId: string; operation: ProfileProviderOperation },
  data: Extract<ProfileProviderResponse, { outcome: "success" }>["data"],
): ProfileProviderResponse {
  return immutableCopy({
    schemaVersion: protocolVersion,
    kind: "profile-provider-response",
    requestId: request.requestId,
    operation: request.operation,
    outcome: "success",
    data,
    error: null,
  });
}

function errorResponse(
  request: { requestId: string; operation: ProfileProviderOperation },
  category: ProfileProviderErrorCategory,
  retryable: boolean,
  supportedVersions: readonly string[] = [],
): ProfileProviderResponse {
  return immutableCopy({
    schemaVersion: protocolVersion,
    kind: "profile-provider-response",
    requestId: request.requestId,
    operation: request.operation,
    outcome: "error",
    data: null,
    error: { category, retryable, supportedVersions },
  });
}

function canonicalTime(value: Date): string {
  if (!Number.isFinite(value.getTime())) throw new TypeError("Invalid clock value.");
  return new Date(Math.floor(value.getTime() / 1000) * 1000).toISOString().replace(".000Z", "Z");
}

function immutableCopy<Value>(value: Value): Value {
  return deepFreeze(structuredClone(value));
}

function deepFreeze<Value>(value: Value): Value {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
