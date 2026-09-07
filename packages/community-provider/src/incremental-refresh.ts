import { Buffer } from "node:buffer";
import { performance } from "node:perf_hooks";
import {
  isIssuedAuthorizedRepositoryConfig,
  selectAuthorizedRepository,
  type ResolvedAuthorizedRepositoryConfig,
} from "./authorized-repository-config.ts";
import {
  isIssuedDeveloperIdentityConfig,
  type ResolvedDeveloperIdentityConfig,
} from "./developer-identity-config.ts";
import {
  isIssuedEvidenceSourceRiskConfig,
  type ResolvedEvidenceSourceRiskConfig,
} from "./evidence-source-risk-config.ts";
import {
  collectFilesystemMetadata,
  type FilesystemMetadataPort,
  type FilesystemMetadataSnapshot,
} from "./filesystem-metadata-collector.ts";
import { collectGitMetadata, type GitMetadataSnapshot } from "./git-metadata-collector.ts";
import type { BoundedGitCommandPort } from "./bounded-git-command.ts";
import { assessGitAuthorship } from "./git-authorship-assessment.ts";
import { classifyEvidenceSourceRisk } from "./evidence-source-risk-classifier.ts";
import {
  deriveEvidenceClaims,
  type EvidenceClaimDerivationSnapshot,
  type EvidenceClaimRepositoryProject,
} from "./evidence-claim-derivation.ts";
import { fingerprintRepository, type RepositoryFingerprintPort } from "./repository-fingerprint.ts";

export const incrementalRefreshVersion = "0.1.0" as const;
export const incrementalRefreshHardLimits = Object.freeze({
  maximumJsonBytes: 32_768,
  maximumCacheAgeMs: 300_000,
  maximumCacheBytes: 16_777_216,
  maximumProbeEntries: 100_000,
  maximumDurationMs: 120_000,
  maximumCollections: 32,
});

export interface IncrementalRefreshConfiguration {
  readonly refreshVersion: typeof incrementalRefreshVersion;
  readonly repositoryProjects: readonly EvidenceClaimRepositoryProject[];
  readonly limits: {
    readonly maxCacheAgeMs: number;
    readonly maxCacheBytes: number;
    readonly maxProbeEntries: number;
    readonly maxDurationMs: number;
    readonly maxCollections: number;
  };
}
export interface IncrementalRefreshRequest {
  readonly refreshVersion: typeof incrementalRefreshVersion;
  readonly observedAt: string;
  readonly staleBefore: string;
  readonly force: boolean;
}
export interface IncrementalRefreshSession {
  readonly kind: "incremental-refresh-session";
  readonly refreshVersion: typeof incrementalRefreshVersion;
}
export interface IncrementalRefreshPorts {
  readonly fingerprintPort?: RepositoryFingerprintPort;
  readonly fileSystemPort?: FilesystemMetadataPort;
  readonly commandPort?: BoundedGitCommandPort;
  readonly now?: () => number;
}
export type RefreshReason =
  | "cold"
  | "unchanged"
  | "fingerprint-changed"
  | "expired"
  | "forced"
  | "unavailable"
  | "budget-exhausted"
  | "invalid-source"
  | "source-changed"
  | "cache-limit";
export interface RepositoryRefreshState {
  readonly repositoryId: string;
  readonly projectRef: string;
  readonly status: "fresh" | "stale" | "invalid";
  readonly origin: "collection" | "memory-cache" | "none";
  readonly fingerprint: string | null;
  readonly collectedAt: string | null;
  readonly checkedAt: string;
  readonly reason: RefreshReason;
}
export interface IncrementalRefreshSnapshot {
  readonly kind: "incremental-refresh-snapshot";
  readonly refreshVersion: typeof incrementalRefreshVersion;
  /** Source-cache usability. Individual Claims retain their independent freshness.stale value. */
  readonly status: "fresh" | "partial" | "stale" | "invalid";
  readonly observedAt: string;
  readonly repositories: readonly RepositoryRefreshState[];
  readonly work: {
    readonly probeEntries: number;
    readonly collections: number;
    readonly cacheBytes: number;
  };
  readonly failure: "incomplete-sources" | "derivation-failed" | null;
  readonly derivation: EvidenceClaimDerivationSnapshot | null;
  readonly filesystemSnapshots: readonly FilesystemMetadataSnapshot[];
}
type RefreshError = {
  readonly ok: false;
  readonly error: {
    readonly category: "invalid-input" | "not-configured" | "busy" | "invalid-clock";
    readonly retryable: false;
  };
};
export type CreateIncrementalRefreshResult =
  { readonly ok: true; readonly value: IncrementalRefreshSession } | RefreshError;
export type RefreshLocalRepositoriesResult =
  { readonly ok: true; readonly value: IncrementalRefreshSnapshot } | RefreshError;

interface CacheEntry {
  readonly fingerprint: string;
  readonly collectedAt: string;
  readonly filesystem: FilesystemMetadataSnapshot;
  readonly git: GitMetadataSnapshot;
  readonly bytes: number;
}
interface SessionState {
  readonly authorization: ResolvedAuthorizedRepositoryConfig;
  readonly identity: ResolvedDeveloperIdentityConfig;
  readonly risk: ResolvedEvidenceSourceRiskConfig;
  readonly configuration: IncrementalRefreshConfiguration;
  readonly ports: IncrementalRefreshPorts;
  readonly cache: Map<string, CacheEntry>;
  lastObservedAt: string | null;
  previous: EvidenceClaimDerivationSnapshot | null;
  previousBytes: number;
  lastClock: number | null;
  busy: boolean;
}
const sessions = new WeakMap<IncrementalRefreshSession, SessionState>();
const identifier = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}(?![\s\S])/u;

export function createIncrementalRefreshSession(
  authorization: ResolvedAuthorizedRepositoryConfig,
  identity: ResolvedDeveloperIdentityConfig,
  risk: ResolvedEvidenceSourceRiskConfig,
  configurationJson: string,
  ports: IncrementalRefreshPorts = {},
): CreateIncrementalRefreshResult {
  try {
    if (
      !isIssuedAuthorizedRepositoryConfig(authorization) ||
      !isIssuedDeveloperIdentityConfig(identity) ||
      !isIssuedEvidenceSourceRiskConfig(risk)
    )
      return failure("not-configured");
    const configuration = parseConfiguration(configurationJson, authorization);
    const ids = new Set(authorization.repositories.map((item) => item.repositoryId));
    if (
      identity.annotations.some((item) => !ids.has(item.repositoryId)) ||
      risk.repositoryAnnotations.some((item) => !ids.has(item.repositoryId)) ||
      risk.pathAnnotations.some((item) => !ids.has(item.repositoryId))
    )
      return failure("invalid-input");
    const session: IncrementalRefreshSession = Object.freeze({
      kind: "incremental-refresh-session",
      refreshVersion: incrementalRefreshVersion,
    });
    sessions.set(session, {
      authorization,
      identity,
      risk,
      configuration,
      ports: { ...ports },
      cache: new Map(),
      lastObservedAt: null,
      previous: null,
      previousBytes: 0,
      lastClock: null,
      busy: false,
    });
    return Object.freeze({ ok: true, value: session });
  } catch {
    return failure("invalid-input");
  }
}

export async function refreshLocalRepositories(
  session: IncrementalRefreshSession,
  requestJson: string,
): Promise<RefreshLocalRepositoriesResult> {
  const state = sessions.get(session);
  if (state === undefined) return failure("not-configured");
  if (state.busy) return failure("busy");
  let request: IncrementalRefreshRequest;
  try {
    request = parseRequest(requestJson);
    if (state.lastObservedAt !== null && request.observedAt < state.lastObservedAt)
      return failure("invalid-input");
  } catch {
    return failure("invalid-input");
  }
  state.busy = true;
  try {
    const readNow = state.ports.now ?? (() => performance.now());
    let clockInvalid = false;
    const now = () => {
      if (clockInvalid) throw new Error("invalid-clock");
      let current: number;
      try {
        current = readNow();
      } catch {
        clockInvalid = true;
        throw new Error("invalid-clock");
      }
      if (
        !Number.isFinite(current) ||
        current < 0 ||
        (state.lastClock !== null && current < state.lastClock)
      ) {
        clockInvalid = true;
        throw new Error("invalid-clock");
      }
      state.lastClock = current;
      return current;
    };
    const start = now();
    let last = start;
    const remaining = () => {
      const current = now();
      if (!Number.isFinite(start) || !Number.isFinite(current) || current < last)
        throw new Error("invalid-clock");
      last = current;
      return Math.max(0, Math.floor(state.configuration.limits.maxDurationMs - (current - start)));
    };
    remaining();
    state.lastObservedAt = request.observedAt;
    const work = { probeEntries: 0, collections: 0 };
    const records: RepositoryRefreshState[] = [];
    const selected = [...state.configuration.repositoryProjects].sort((a, b) =>
      compare(a.repositoryId, b.repositoryId),
    );
    for (const mapping of selected) {
      const cached = state.cache.get(mapping.repositoryId);
      const report = (
        status: RepositoryRefreshState["status"],
        origin: RepositoryRefreshState["origin"],
        reason: RefreshReason,
        entry: CacheEntry | undefined,
      ) => {
        records.push({
          ...mapping,
          status,
          origin,
          reason,
          fingerprint: entry?.fingerprint ?? null,
          collectedAt: entry?.collectedAt ?? null,
          checkedAt: request.observedAt,
        });
      };
      const unavailable = (reason: RefreshReason, evict: boolean) => {
        if (evict) state.cache.delete(mapping.repositoryId);
        const retained = evict ? undefined : cached;
        report(
          retained === undefined ? "invalid" : "stale",
          retained === undefined ? "none" : "memory-cache",
          reason,
          retained,
        );
      };
      const authority = () =>
        selectAuthorizedRepository(
          state.authorization,
          mapping.repositoryId,
          Math.min(remaining(), state.authorization.limits.maxDurationMs),
        );
      const probe = async () => {
        const narrowed = authority();
        const entries = state.configuration.limits.maxProbeEntries - work.probeEntries;
        if (narrowed === null || entries <= 0)
          return { ok: false as const, category: "deadline-exceeded" as const, entries: 0 };
        const result = await fingerprintRepository(narrowed, {
          maximumEntries: entries,
          ...(state.ports.fingerprintPort === undefined
            ? {}
            : { port: state.ports.fingerprintPort }),
          now,
        });
        work.probeEntries += result.entries;
        if (remaining() === 0)
          return {
            ok: false as const,
            category: "deadline-exceeded" as const,
            entries: result.entries,
          };
        return result;
      };
      const before = await probe();
      if (!before.ok) {
        const budget =
          before.category === "limit-exceeded" || before.category === "deadline-exceeded";
        unavailable(
          budget
            ? "budget-exhausted"
            : before.category === "path-unavailable"
              ? "unavailable"
              : "invalid-source",
          !budget && before.category !== "path-unavailable",
        );
        continue;
      }
      const age =
        cached === undefined
          ? Infinity
          : Date.parse(request.observedAt) - Date.parse(cached.collectedAt);
      const changed = cached !== undefined && cached.fingerprint !== before.fingerprint;
      if (
        cached !== undefined &&
        !request.force &&
        !changed &&
        age < state.configuration.limits.maxCacheAgeMs
      ) {
        report("fresh", "memory-cache", "unchanged", cached);
        continue;
      }
      if (changed) state.cache.delete(mapping.repositoryId);
      if (work.collections >= state.configuration.limits.maxCollections || remaining() === 0) {
        unavailable("budget-exhausted", changed);
        continue;
      }
      work.collections += 1;
      const fsAuthority = authority();
      if (fsAuthority === null) {
        unavailable("budget-exhausted", changed);
        continue;
      }
      const filesystem = await collectFilesystemMetadata(fsAuthority, {
        ...(state.ports.fileSystemPort === undefined
          ? {}
          : { fileSystemPort: state.ports.fileSystemPort }),
        now,
      });
      if (!filesystem.ok) {
        const budget =
          filesystem.error.category === "deadline-exceeded" ||
          filesystem.error.category === "limit-exceeded";
        unavailable(
          budget
            ? "budget-exhausted"
            : filesystem.error.category === "path-unavailable"
              ? "unavailable"
              : "invalid-source",
          changed || (!budget && !filesystem.error.retryable),
        );
        continue;
      }
      const gitAuthority = authority();
      if (gitAuthority === null) {
        unavailable("budget-exhausted", changed);
        continue;
      }
      const git = await collectGitMetadata(gitAuthority, {
        ...(state.ports.commandPort === undefined ? {} : { commandPort: state.ports.commandPort }),
        now,
      });
      if (!git.ok) {
        const budget =
          git.error.category === "deadline-exceeded" || git.error.category === "limit-exceeded";
        unavailable(
          budget
            ? "budget-exhausted"
            : git.error.category === "git-unavailable" || git.error.category === "path-unavailable"
              ? "unavailable"
              : "invalid-source",
          changed || (!budget && !git.error.retryable),
        );
        continue;
      }
      const after = await probe();
      if (!after.ok) {
        const budget =
          after.category === "limit-exceeded" || after.category === "deadline-exceeded";
        unavailable(budget ? "budget-exhausted" : "source-changed", changed || !budget);
        continue;
      }
      if (after.fingerprint !== before.fingerprint) {
        unavailable("source-changed", true);
        continue;
      }
      const entry: CacheEntry = {
        fingerprint: after.fingerprint,
        collectedAt: request.observedAt,
        filesystem: filesystem.value,
        git: git.value,
        bytes: Buffer.byteLength(JSON.stringify([filesystem.value, git.value]), "utf8"),
      };
      if (
        cacheBytes(state) - (state.cache.get(mapping.repositoryId)?.bytes ?? 0) + entry.bytes >
        state.configuration.limits.maxCacheBytes
      ) {
        unavailable("cache-limit", true);
        continue;
      }
      state.cache.set(mapping.repositoryId, entry);
      report(
        "fresh",
        "collection",
        cached === undefined
          ? "cold"
          : changed
            ? "fingerprint-changed"
            : request.force
              ? "forced"
              : "expired",
        entry,
      );
    }
    if (clockInvalid) throw new Error("invalid-clock");
    let derivation: EvidenceClaimDerivationSnapshot | null = null;
    let files: readonly FilesystemMetadataSnapshot[] = [];
    let resultFailure: IncrementalRefreshSnapshot["failure"] = "incomplete-sources";
    const complete = records.every((record) => record.status === "fresh");
    if (complete && remaining() > 0) {
      const entries = selected.map((item) => state.cache.get(item.repositoryId));
      if (entries.every((item): item is CacheEntry => item !== undefined)) {
        const fs: FilesystemMetadataSnapshot = {
          kind: "filesystem-metadata-snapshot",
          snapshotVersion: "0.1.0",
          repositories: entries.flatMap((entry) => entry.filesystem.repositories),
        };
        const git: GitMetadataSnapshot = {
          kind: "git-metadata-snapshot",
          snapshotVersion: "0.1.0",
          repositories: entries.flatMap((entry) => entry.git.repositories),
        };
        const authorship = assessGitAuthorship(git, state.identity);
        const risk = authorship.ok
          ? classifyEvidenceSourceRisk(fs, git, authorship.value, state.risk)
          : null;
        const sourceObservedAt = entries.map((entry) => entry.collectedAt).sort(compare)[0];
        const derived =
          risk?.ok === true && sourceObservedAt !== undefined
            ? deriveEvidenceClaims(
                risk.value,
                {
                  kind: "evidence-claim-derivation-request",
                  derivationVersion: "0.1.0",
                  sourceObservedAt,
                  derivedAt: request.observedAt,
                  staleBefore: request.staleBefore,
                  repositoryProjects: selected,
                },
                state.previous,
              )
            : null;
        const derivedBytes =
          derived?.ok === true ? Buffer.byteLength(JSON.stringify(derived.value), "utf8") : 0;
        if (
          derived?.ok === true &&
          remaining() > 0 &&
          cacheBytes(state) - state.previousBytes + derivedBytes <=
            state.configuration.limits.maxCacheBytes
        ) {
          derivation = derived.value;
          state.previous = derivation;
          state.previousBytes = derivedBytes;
          files = entries.map((entry) => entry.filesystem);
          resultFailure = null;
        } else resultFailure = "derivation-failed";
      }
    }
    const status =
      derivation !== null
        ? "fresh"
        : complete
          ? "invalid"
          : records.some((record) => record.status === "fresh")
            ? "partial"
            : records.some((record) => record.status === "stale")
              ? "stale"
              : "invalid";
    return freeze({
      ok: true,
      value: {
        kind: "incremental-refresh-snapshot",
        refreshVersion: incrementalRefreshVersion,
        status,
        observedAt: request.observedAt,
        repositories: records,
        work: { ...work, cacheBytes: cacheBytes(state) },
        failure: resultFailure,
        derivation,
        filesystemSnapshots: files,
      },
    });
  } catch {
    // No cached payload is returned when the injected clock or an internal operation fails.
    state.cache.clear();
    return failure("invalid-clock");
  } finally {
    state.busy = false;
  }
}

function parseConfiguration(
  text: string,
  authorization: ResolvedAuthorizedRepositoryConfig,
): IncrementalRefreshConfiguration {
  const value = parseJson(text);
  if (
    !shape(value, ["refreshVersion", "repositoryProjects", "limits"]) ||
    value["refreshVersion"] !== incrementalRefreshVersion ||
    !Array.isArray(value["repositoryProjects"]) ||
    value["repositoryProjects"].length !== authorization.repositories.length ||
    !shape(value["limits"], [
      "maxCacheAgeMs",
      "maxCacheBytes",
      "maxProbeEntries",
      "maxDurationMs",
      "maxCollections",
    ])
  )
    throw new Error("invalid");
  const ids = new Set<string>();
  for (const mapping of value["repositoryProjects"]) {
    if (
      !shape(mapping, ["repositoryId", "projectRef"]) ||
      !isId(mapping["repositoryId"]) ||
      !isId(mapping["projectRef"]) ||
      ids.has(mapping["repositoryId"]) ||
      !authorization.repositories.some((item) => item.repositoryId === mapping["repositoryId"])
    )
      throw new Error("invalid");
    ids.add(mapping["repositoryId"]);
  }
  const limits = value["limits"];
  if (
    !bounded(limits["maxCacheAgeMs"], 0, incrementalRefreshHardLimits.maximumCacheAgeMs) ||
    !bounded(limits["maxCacheBytes"], 1, incrementalRefreshHardLimits.maximumCacheBytes) ||
    !bounded(limits["maxProbeEntries"], 1, incrementalRefreshHardLimits.maximumProbeEntries) ||
    !bounded(limits["maxDurationMs"], 1, incrementalRefreshHardLimits.maximumDurationMs) ||
    !bounded(
      limits["maxCollections"],
      1,
      Math.min(authorization.repositories.length, incrementalRefreshHardLimits.maximumCollections),
    )
  )
    throw new Error("invalid");
  return freeze(value as unknown as IncrementalRefreshConfiguration);
}
function parseRequest(text: string): IncrementalRefreshRequest {
  const value = parseJson(text);
  if (
    !shape(value, ["refreshVersion", "observedAt", "staleBefore", "force"]) ||
    value["refreshVersion"] !== incrementalRefreshVersion ||
    !timestamp(value["observedAt"]) ||
    !timestamp(value["staleBefore"]) ||
    value["staleBefore"] > value["observedAt"] ||
    typeof value["force"] !== "boolean"
  )
    throw new Error("invalid");
  return value as unknown as IncrementalRefreshRequest;
}
function parseJson(text: string): unknown {
  if (
    typeof text !== "string" ||
    Buffer.byteLength(text, "utf8") > incrementalRefreshHardLimits.maximumJsonBytes
  )
    throw new Error("invalid");
  return JSON.parse(text);
}
function shape(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
function bounded(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum
  );
}
function isId(value: unknown): value is string {
  return typeof value === "string" && identifier.test(value);
}
function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z(?![\s\S])/u.test(value))
    return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value.replace("Z", ".000Z");
}
function cacheBytes(state: SessionState): number {
  return (
    state.previousBytes + [...state.cache.values()].reduce((sum, entry) => sum + entry.bytes, 0)
  );
}
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
function freeze<Value>(value: Value): Value {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function failure(category: RefreshError["error"]["category"]): RefreshError {
  return freeze({ ok: false, error: { category, retryable: false } });
}
