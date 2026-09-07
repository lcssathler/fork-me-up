import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { resolveAuthorizedRepositoryConfig } from "./authorized-repository-config.ts";
import { resolveDeveloperIdentityConfig } from "./developer-identity-config.ts";
import { resolveEvidenceSourceRiskConfig } from "./evidence-source-risk-config.ts";
import { resolveLocalProfileStoreConfig } from "./local-profile-store-config.ts";
import {
  createIncrementalRefreshSession,
  refreshLocalRepositories,
  type IncrementalRefreshPorts,
  type IncrementalRefreshConfiguration,
} from "./incremental-refresh.ts";
import { saveOwnerDerivation, runOwnerProfileOperation } from "./owner-profile-workflow.ts";
import { runOwnerPortabilityOperation } from "./owner-profile-portability.ts";
import { runOwnerDiagnostics } from "./owner-profile-diagnostics.ts";
import { createLocalStoredProfileProvider } from "./local-stored-profile-provider.ts";
import type { FilesystemMetadataSnapshot } from "./filesystem-metadata-collector.ts";

export const localCommunityLimits = Object.freeze({
  configurationBytes: 131_072,
  requestBytes: 4_194_304,
  outputBytes: 262_144,
});
export interface LocalCommunityRuntimeOptions {
  readonly refreshPorts?: IncrementalRefreshPorts;
  readonly clock?: () => Date;
  readonly clearAdapterCache?: () => Promise<{ readonly ok: boolean }>;
  readonly inspectAdapterCache?: (at: string) => Promise<unknown>;
  readonly installation?: {
    readonly modules: "available";
    readonly runtime: "supported" | "unsupported";
  };
}
export interface LocalCommunityRuntime {
  readonly provider: ReturnType<typeof createLocalStoredProfileProvider>;
  run(requestJson: string): Promise<unknown>;
}
type CreationResult =
  { readonly ok: true; readonly value: LocalCommunityRuntime } | ReturnType<typeof failure>;

/** First-party configuration composition; never accepted through Provider/MCP requests. */
export async function createLocalCommunityRuntime(
  configurationJson: string,
  options: LocalCommunityRuntimeOptions = {},
): Promise<CreationResult> {
  try {
    const input = parse(configurationJson, localCommunityLimits.configurationBytes);
    if (
      !shape(input, ["version", "sources", "identity", "risk", "refresh", "store", "project"]) ||
      input["version"] !== "0.1.0" ||
      !shape(input["project"], ["projectRef", "repositoryId"]) ||
      !identifier(input["project"]["projectRef"]) ||
      !identifier(input["project"]["repositoryId"])
    )
      return failure("invalid-config");
    const project = input["project"];
    const projectRef = input["project"]["projectRef"];
    const repositoryId = input["project"]["repositoryId"];
    const sources = await resolveAuthorizedRepositoryConfig(JSON.stringify(input["sources"]));
    const identity = resolveDeveloperIdentityConfig(JSON.stringify(input["identity"]));
    const risk = resolveEvidenceSourceRiskConfig(JSON.stringify(input["risk"]));
    const store = await resolveLocalProfileStoreConfig(JSON.stringify(input["store"]));
    if (
      !sources.ok ||
      !identity.ok ||
      !risk.ok ||
      !store.ok ||
      identity.value.subjectRef !== store.value.subjectRef
    )
      return failure("invalid-config");
    if (
      sources.value.repositories.some((repository) =>
        overlaps(repository.canonicalPath, store.value.directoryPath),
      )
    )
      return failure("invalid-config");
    const refresh = input["refresh"];
    if (
      !record(refresh) ||
      !Array.isArray(refresh["repositoryProjects"]) ||
      !refresh["repositoryProjects"].some(
        (entry: unknown) =>
          record(entry) &&
          entry["repositoryId"] === project["repositoryId"] &&
          entry["projectRef"] === project["projectRef"],
      )
    )
      return failure("invalid-config");
    const session = createIncrementalRefreshSession(
      sources.value,
      identity.value,
      risk.value,
      JSON.stringify(refresh),
      options.refreshPorts ?? {},
    );
    if (!session.ok) return failure("invalid-config");
    // The authentic session resolver has validated and detached all refresh settings.
    const settings = refresh as unknown as IncrementalRefreshConfiguration;
    let complete = true;
    let snapshots: readonly FilesystemMetadataSnapshot[] = [];
    let busy = false;
    const provider = createLocalStoredProfileProvider(store.value, {
      projectRef,
      repositoryId,
      clock: options.clock ?? (() => new Date()),
      createId: (kind) => `${kind}_${randomUUID()}`,
      source: () =>
        snapshots.find((snapshot) =>
          snapshot.repositories.some((repository) => repository.repositoryId === repositoryId),
        ) ?? null,
      available: () => complete && !busy,
      maxObservationAgeMs: settings.limits.maxCacheAgeMs,
    });
    const runtime: LocalCommunityRuntime = Object.freeze({
      provider,
      async run(requestJson: string): Promise<unknown> {
        if (busy) return failure("busy");
        let request;
        try {
          request = parse(requestJson, localCommunityLimits.requestBytes);
        } catch {
          return failure("invalid-input");
        }
        if (!record(request) || request["version"] !== "0.1.0") return failure("invalid-input");
        if (request["operation"] === "provider") {
          if (!shape(request, ["version", "operation", "request"])) return failure("invalid-input");
          const response = await provider.invoke(request["request"]);
          return bounded({ ok: response.outcome === "success", status: "provider", response });
        }
        busy = true;
        try {
          if (request["operation"] === "refresh") {
            if (
              !shape(request, ["version", "operation", "request", "expectedGeneration", "at"]) ||
              !(
                request["expectedGeneration"] === null ||
                (typeof request["expectedGeneration"] === "number" &&
                  Number.isSafeInteger(request["expectedGeneration"]) &&
                  request["expectedGeneration"] >= 0)
              ) ||
              !timestamp(request["at"])
            )
              return failure("invalid-input");
            const refreshRequest = request["request"];
            if (
              !shape(refreshRequest, ["refreshVersion", "observedAt", "staleBefore", "force"]) ||
              refreshRequest["refreshVersion"] !== "0.1.0" ||
              !timestamp(refreshRequest["observedAt"]) ||
              !timestamp(refreshRequest["staleBefore"]) ||
              refreshRequest["staleBefore"] > refreshRequest["observedAt"] ||
              typeof refreshRequest["force"] !== "boolean" ||
              request["at"] < refreshRequest["observedAt"]
            )
              return failure("invalid-input");
            complete = false;
            snapshots = [];
            const refreshed = await refreshLocalRepositories(
              session.value,
              JSON.stringify(request["request"]),
            );
            if (
              !refreshed.ok ||
              refreshed.value.derivation === null ||
              refreshed.value.status !== "fresh"
            )
              return failure("refresh-incomplete");
            const saved = await saveOwnerDerivation(
              store.value,
              refreshed.value.derivation,
              JSON.stringify({
                version: "0.1.0",
                expectedGeneration: request["expectedGeneration"],
                at: request["at"],
              }),
            );
            if (!saved.ok) return saved;
            snapshots = refreshed.value.filesystemSnapshots;
            complete = true;
            return bounded({
              ok: true,
              status: "refreshed",
              generation: saved.generation,
              maintenanceRequired: saved.maintenanceRequired,
              repositories: refreshed.value.repositories.map((item) => ({
                status: item.status,
                origin: item.origin,
                reason: item.reason,
              })),
              work: refreshed.value.work,
            });
          }
          if (["import", "export", "delete"].includes(String(request["operation"]))) {
            if (
              request["operation"] === "delete" &&
              shape(request, ["version", "operation", "confirm", "cacheScope"]) &&
              request["confirm"] === "delete-local-profile" &&
              request["cacheScope"] === "all-local-adapter-caches" &&
              options.clearAdapterCache !== undefined
            ) {
              complete = false;
              snapshots = [];
            }
            const result = await runOwnerPortabilityOperation(
              store.value,
              requestJson,
              options.clearAdapterCache === undefined
                ? {}
                : { clearAdapterCache: options.clearAdapterCache },
            );
            if (result.ok && result.status === "imported") {
              complete = true;
              snapshots = [];
            }
            return bounded(result);
          }
          if (["doctor", "get-capability-evidence"].includes(String(request["operation"]))) {
            return bounded(
              await runOwnerDiagnostics(store.value, requestJson, {
                ...(options.inspectAdapterCache === undefined
                  ? {}
                  : { inspectAdapterCache: options.inspectAdapterCache }),
                ...(options.installation === undefined
                  ? {}
                  : { installation: options.installation }),
              }),
            );
          }
          return bounded(await runOwnerProfileOperation(store.value, requestJson));
        } catch {
          return failure("operation-unavailable");
        } finally {
          busy = false;
        }
      },
    });
    return { ok: true, value: runtime };
  } catch {
    return failure("invalid-config");
  }
}
function overlaps(left: string, right: string): boolean {
  return [path.relative(left, right), path.relative(right, left)].some(
    (relative) =>
      relative === "" ||
      (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`)),
  );
}
function parse(source: string, maxBytes: number): unknown {
  if (
    typeof source !== "string" ||
    !source.isWellFormed() ||
    Buffer.byteLength(source, "utf8") > maxBytes
  )
    throw new Error("invalid-input");
  return JSON.parse(source);
}
function bounded(value: unknown): unknown {
  return Buffer.byteLength(JSON.stringify(value), "utf8") <= localCommunityLimits.outputBytes
    ? value
    : failure("limit-exceeded");
}
function failure(
  category:
    | "invalid-config"
    | "invalid-input"
    | "busy"
    | "refresh-incomplete"
    | "operation-unavailable"
    | "limit-exceeded",
) {
  return Object.freeze({
    ok: false as const,
    error: Object.freeze({ category, retryable: false }),
  });
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
