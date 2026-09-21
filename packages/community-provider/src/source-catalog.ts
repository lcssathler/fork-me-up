import { Buffer } from "node:buffer";
import path from "node:path";
import { realpath } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { intersectDemandProfileWithDeveloperProfile } from "@fork-me-up/core";
import {
  resolveAuthorizedRepositoryConfig,
  selectAuthorizedRepository,
} from "./authorized-repository-config.ts";
import { resolveDeveloperIdentityConfig } from "./developer-identity-config.ts";
import { resolveLocalProfileStoreConfig } from "./local-profile-store-config.ts";
import { loadLocalProfileStore } from "./local-profile-store.ts";
import { fingerprintRepository } from "./repository-fingerprint.ts";
import { collectFilesystemMetadata } from "./filesystem-metadata-collector.ts";
import { readSelectedGitHubSources, type SelectedGitHubPort } from "./selected-github-source.ts";
import { nodeSelectedGitHubPort } from "./selected-github-transport.ts";
import {
  catalogHash,
  exact,
  integer,
  validLanguages,
  withSourceCatalog,
  type CatalogRecord,
} from "./source-catalog-store.ts";

export const sourceCatalogLimits: Readonly<
  Record<
    "candidates" | "collections" | "requests" | "durationMs" | "probeEntries" | "cacheAgeMs",
    number
  >
> = Object.freeze({
  candidates: 8,
  collections: 3,
  requests: 64,
  durationMs: 60000,
  probeEntries: 8192,
  cacheAgeMs: 300000,
});
interface Candidate {
  sourceRef: string;
  kind: "local" | "github";
  languages: string[];
  configuration: unknown;
}
interface Configuration {
  version: "0.1.0";
  directory: string;
  subjectRef: string;
  identity: unknown;
  profile: unknown;
  projectRef: string;
  sources: Candidate[];
  limits: typeof sourceCatalogLimits;
}
export interface CatalogReceipt {
  readonly ok: true;
  readonly status: "saved" | "deleted" | "exported";
  readonly profile: "available" | "unavailable" | "not-configured";
  readonly profileCoverage: number;
  readonly recovered: boolean;
  readonly counts: {
    candidates: number;
    selected: number;
    unexamined: number;
    collections: number;
    cacheHits: number;
    requests: number;
    responseBytes: number;
    probeEntries: number;
    failures: number;
    records: number;
  };
  readonly sources: readonly {
    key: string;
    origin: "collection" | "persistent-cache" | "none";
    observedAt: number | null;
  }[];
  readonly inventory?: readonly {
    kind: "local" | "github";
    languages: readonly string[];
    files: number;
    bytes: number;
    commits: number;
    observedAt: number;
    expiresAt: number;
    coverage: "bounded-sample";
  }[];
}
export type CatalogResult =
  | CatalogReceipt
  | {
      readonly ok: false;
      readonly error: { readonly category: "catalog-unavailable" };
      readonly saved: false;
    };

/** First-party owner operation; neither configuration nor cache is a consumer grant. */
export async function runSourceCatalog(
  configurationJson: string,
  request: {
    readonly operation: "select" | "delete" | "export";
    readonly languages: readonly string[];
    readonly refresh: boolean;
  },
  options: {
    readonly readAuthority: () => Promise<string | null>;
    readonly githubPort?: SelectedGitHubPort;
    readonly clock?: () => number;
    readonly monotonic?: () => number;
    readonly beforeActivate?: () => Promise<void>;
  },
): Promise<CatalogResult> {
  try {
    const config = parse(configurationJson);
    if (
      !exact(request, ["operation", "languages", "refresh"]) ||
      !["select", "delete", "export"].includes(String(request.operation)) ||
      !validLanguages(request.languages) ||
      typeof request.refresh !== "boolean"
    )
      throw new Error("invalid-input");
    const clock = options.clock ?? Date.now;
    const monotonic = options.monotonic ?? (() => performance.now());
    const start = monotonic();
    let last = start;
    const at = clock();
    const remaining = (): number => {
      const current = monotonic();
      if (!Number.isFinite(start) || start < 0 || !Number.isFinite(current) || current < last)
        throw new Error("clock");
      last = current;
      const remaining = Math.floor(config.limits.durationMs - (current - start));
      if (remaining <= 0) throw new Error("deadline");
      return remaining;
    };
    const authorize = async (): Promise<void> => {
      remaining();
      const current = clock();
      if (
        !Number.isSafeInteger(at) ||
        !Number.isSafeInteger(current) ||
        current < at ||
        current - at > config.limits.durationMs ||
        (await options.readAuthority()) !== configurationJson
      )
        throw new Error("revoked");
      remaining();
    };
    await authorize();
    const identity = resolveDeveloperIdentityConfig(JSON.stringify(config.identity));
    if (!identity.ok || identity.value.subjectRef !== config.subjectRef)
      throw new Error("identity");
    const identityHash = catalogHash(JSON.stringify(identity.value));
    const binding = catalogHash(JSON.stringify([config.subjectRef, identityHash, "catalog-v1"]));
    const directory = await realpath(config.directory);
    const counts = {
      candidates: config.sources.length,
      selected: 0,
      unexamined: config.sources.length,
      collections: 0,
      cacheHits: 0,
      requests: 0,
      responseBytes: 0,
      probeEntries: 0,
      failures: 0,
      records: 0,
    };
    const sources: {
      key: string;
      origin: "collection" | "persistent-cache" | "none";
      observedAt: number | null;
    }[] = [];
    if (request.operation === "delete") {
      // Deletion needs no live source or profile; existing paths still constrain storage.
      const boundaries: string[] = [];
      for (const source of config.sources)
        if (source.kind === "local") {
          if (
            !object(source.configuration) ||
            !Array.isArray(source.configuration["authorizedRoots"])
          )
            throw new Error("source-config");
          for (const root of source.configuration["authorizedRoots"]) {
            if (!object(root) || typeof root["path"] !== "string" || !path.isAbsolute(root["path"]))
              throw new Error("source-config");
            boundaries.push(root["path"]);
          }
        }
      if (config.profile !== null) {
        if (
          !object(config.profile) ||
          typeof config.profile["directoryPath"] !== "string" ||
          !path.isAbsolute(config.profile["directoryPath"])
        )
          throw new Error("store-config");
        boundaries.push(config.profile["directoryPath"]);
      }
      for (const boundary of boundaries) {
        let resolved = boundary;
        try {
          resolved = await realpath(boundary);
        } catch (error) {
          if (!object(error) || error["code"] !== "ENOENT") throw error;
        }
        if (overlap(directory, resolved)) throw new Error("storage-overlap");
      }
      return await withSourceCatalog(
        config.directory,
        binding,
        at,
        async (transaction) => {
          await authorize();
          await transaction.delete();
          return {
            ok: true,
            status: "deleted",
            profile: config.profile === null ? "not-configured" : "unavailable",
            profileCoverage: 0,
            recovered: transaction.recovered,
            counts,
            sources,
          };
        },
        { allowDeleted: true },
      );
    }
    // Resolve all configured local roots before any cache mutation, without reading their content.
    const locals = new Map<string, Awaited<ReturnType<typeof resolveAuthorizedRepositoryConfig>>>();
    for (const source of config.sources) {
      if (source.kind === "local") {
        const local = await resolveAuthorizedRepositoryConfig(JSON.stringify(source.configuration));
        if (
          !local.ok ||
          local.value.repositories.length !== 1 ||
          local.value.authorizedRoots.some((root) => overlap(directory, root.canonicalPath))
        )
          throw new Error("source-config");
        locals.set(source.sourceRef, local);
      } else {
        if (
          !object(source.configuration) ||
          source.configuration["subjectRef"] !== config.subjectRef ||
          !Array.isArray(source.configuration["repositories"]) ||
          source.configuration["repositories"].length !== 1
        )
          throw new Error("source-config");
      }
    }
    let profile: CatalogReceipt["profile"] =
      config.profile === null ? "not-configured" : "unavailable";
    let covered: string[] = [];
    if (config.profile !== null) {
      const store = await resolveLocalProfileStoreConfig(JSON.stringify(config.profile));
      if (
        !store.ok ||
        store.value.subjectRef !== config.subjectRef ||
        overlap(directory, store.value.directoryPath)
      )
        throw new Error("store-config");
      const loaded = await loadLocalProfileStore(store.value);
      if (loaded.ok && loaded.value !== null) {
        profile = "available";
        const intersection = intersectDemandProfileWithDeveloperProfile(
          {
            schemaVersion: "0.1.0",
            kind: "demand-profile",
            demandId: "demand_catalog",
            project: {
              projectRef: config.projectRef,
              metadataStatus: "partial",
              metadataRevisionRef: null,
            },
            task: { summary: "Select relevant source observations", purpose: "technical-learning" },
            capabilities: request.languages.map((language) => ({
              capability: `language.${language}`,
              relevance: "required",
              basis: "task-input",
            })),
            generatedAt: new Date(Math.floor(at / 1000) * 1000).toISOString().replace(".000Z", "Z"),
          },
          { profileVersion: loaded.value.profileVersion, profile: loaded.value.profile },
        );
        if (intersection.ok)
          covered = request.languages.filter((language) => {
            const claims = intersection.value.claims.filter(
              (claim) => claim.capability === `language.${language}`,
            );
            return (
              claims.length > 0 &&
              claims.every(
                (claim) =>
                  !claim.freshness.stale &&
                  (claim.state === "self-declared" ||
                    (claim.state === "demonstrated" &&
                      claim.freshness.observedThrough !== null &&
                      at - Date.parse(claim.freshness.observedThrough) <= 300000)),
              )
            );
          });
      }
    }
    await authorize();
    const remotePort: SelectedGitHubPort = {
      async get(input) {
        await authorize();
        if (counts.requests >= config.limits.requests || counts.responseBytes >= 8388608)
          throw new Error("budget");
        counts.requests++;
        const result = await (options.githubPort ?? nodeSelectedGitHubPort).get({
          ...input,
          beforeRequest: async () => {
            await input.beforeRequest?.();
            await authorize();
          },
          timeoutMs: Math.min(input.timeoutMs, remaining()),
          maximumOutputBytes: Math.min(input.maximumOutputBytes, 8388608 - counts.responseBytes),
        });
        if (result.ok) {
          counts.responseBytes += result.output.byteLength;
          if (counts.responseBytes > 8388608) throw new Error("budget");
        }
        await authorize();
        return result;
      },
    };
    return await withSourceCatalog(
      config.directory,
      binding,
      at,
      async (transaction) => {
        const allowed = new Map(
          config.sources.map((source) => [catalogHash(source.sourceRef), source]),
        );
        const records = new Map(
          transaction.records
            .filter((record) => {
              const source = allowed.get(record.key);
              return (
                source !== undefined &&
                record.authority === catalogHash(JSON.stringify(source.configuration)) &&
                record.identity === identityHash &&
                record.expiresAt > at
              );
            })
            .map((record) => [record.key, record]),
        );
        if (request.operation === "export") {
          await authorize();
          counts.records = records.size;
          return {
            ok: true,
            status: "exported",
            profile,
            profileCoverage: covered.length,
            recovered: transaction.recovered,
            counts,
            sources,
            inventory: [...records.values()].map((record) => ({
              kind: record.kind,
              languages: record.languages,
              files: record.files,
              bytes: record.bytes,
              commits: record.commits,
              observedAt: record.observedAt,
              expiresAt: record.expiresAt,
              coverage: record.coverage,
            })),
          };
        }
        const wanted = request.languages.filter(
          (language) => request.refresh || !covered.includes(language),
        );
        const adjacent = (language: string): string[] =>
          language === "typescript"
            ? ["javascript"]
            : language === "javascript"
              ? ["typescript"]
              : [];
        const ranked = config.sources
          .map((source, index) => {
            const hints = records.get(catalogHash(source.sourceRef))?.languages ?? source.languages;
            const score = wanted.reduce(
              (score, language) =>
                score +
                (hints.includes(language)
                  ? 2
                  : adjacent(language).some((candidate) => hints.includes(candidate))
                    ? 1
                    : 0),
              0,
            );
            return { source, score, index };
          })
          .sort((a, b) => b.score - a.score || a.index - b.index);
        const selected =
          wanted.length === 0 && !request.refresh ? [] : ranked.slice(0, config.limits.candidates);
        counts.selected = selected.length;
        counts.unexamined -= selected.length;
        for (const { source } of selected) {
          const key = catalogHash(source.sourceRef);
          const previous = records.get(key);
          try {
            await authorize();
            let state: string;
            let fork: boolean | null = null;
            let probe: (() => Promise<string>) | null = null;
            const local = locals.get(source.sourceRef);
            if (source.kind === "local") {
              if (!local?.ok) throw new Error("source-config");
              probe = async () => {
                const selected = selectAuthorizedRepository(
                  local.value,
                  local.value.repositories[0]?.repositoryId ?? "",
                  Math.min(local.value.limits.maxDurationMs, remaining()),
                );
                if (selected === null || counts.probeEntries >= config.limits.probeEntries)
                  throw new Error("budget");
                const result = await fingerprintRepository(selected, {
                  maximumEntries: config.limits.probeEntries - counts.probeEntries,
                  now: monotonic,
                });
                counts.probeEntries += result.entries;
                if (!result.ok) throw new Error("source-unavailable");
                return result.fingerprint;
              };
              state = await probe();
            } else {
              const result = await readSelectedGitHubSources(
                JSON.stringify(source.configuration),
                "probe",
                {
                  port: remotePort,
                  clock,
                  monotonic,
                  readAuthority: async () => {
                    await authorize();
                    return JSON.stringify(source.configuration);
                  },
                },
              );
              const observation = result.ok ? result.observations[0] : undefined;
              if (observation === undefined || observation.revision === null)
                throw new Error("source-unavailable");
              state = observation.sourceState;
              fork = observation.fork;
            }
            await authorize();
            if (
              !request.refresh &&
              previous !== undefined &&
              previous.state === state &&
              clock() - previous.observedAt <= config.limits.cacheAgeMs &&
              previous.expiresAt > clock()
            ) {
              counts.cacheHits++;
              sources.push({ key, origin: "persistent-cache", observedAt: previous.observedAt });
              continue;
            }
            records.delete(key);
            if (counts.collections >= config.limits.collections) {
              counts.failures++;
              sources.push({ key, origin: "none", observedAt: null });
              continue;
            }
            counts.collections++;
            let languages: string[];
            let files: number;
            let bytes: number;
            let commits = 0;
            if (source.kind === "local") {
              if (!local?.ok || probe === null) throw new Error("source-config");
              const selected = selectAuthorizedRepository(
                local.value,
                local.value.repositories[0]?.repositoryId ?? "",
                Math.min(local.value.limits.maxDurationMs, remaining()),
              );
              if (selected === null) throw new Error("source-config");
              const result = await collectFilesystemMetadata(selected, { now: monotonic });
              if (!result.ok || (await probe()) !== state) throw new Error("source-changed");
              const repository = result.value.repositories[0];
              if (repository === undefined) throw new Error("source-unavailable");
              languages = [
                ...new Set(
                  repository.files.flatMap((file) =>
                    file.category === "source" && validLanguages([file.language])
                      ? [file.language]
                      : [],
                  ),
                ),
              ].sort();
              files = repository.files.length;
              bytes = repository.bytesRead;
            } else {
              const result = await readSelectedGitHubSources(
                JSON.stringify(source.configuration),
                "collect",
                {
                  port: remotePort,
                  clock,
                  monotonic,
                  readAuthority: async () => {
                    await authorize();
                    return JSON.stringify(source.configuration);
                  },
                },
              );
              const observation = result.ok ? result.observations[0] : undefined;
              if (observation === undefined || observation.sourceState !== state)
                throw new Error("source-changed");
              languages = [...new Set(observation.files.map((file) => file.language))].sort();
              files = observation.files.length;
              bytes = observation.files.reduce((sum, file) => sum + file.bytes, 0);
              commits = observation.commits.length;
            }
            await authorize();
            const sourceExpiry =
              source.kind === "github" && object(source.configuration)
                ? Date.parse(String(source.configuration["expiresAt"]))
                : at + 86400000;
            const record: CatalogRecord = {
              key,
              authority: catalogHash(JSON.stringify(source.configuration)),
              identity: identityHash,
              state,
              kind: source.kind,
              algorithm: "catalog-observation-v1",
              observedAt: at,
              expiresAt: Math.min(at + 86400000, sourceExpiry),
              languages,
              files,
              bytes,
              commits,
              fork,
              coverage: "bounded-sample",
            };
            records.set(key, record);
            sources.push({ key, origin: "collection", observedAt: at });
          } catch {
            records.delete(key);
            counts.failures++;
            sources.push({ key, origin: "none", observedAt: null });
          }
        }
        await authorize();
        // Probes consume time: recheck every reported hit at the final boundary.
        for (const receipt of sources)
          if (receipt.origin === "persistent-cache") {
            const record = records.get(receipt.key);
            if (
              record === undefined ||
              clock() - record.observedAt > config.limits.cacheAgeMs ||
              record.expiresAt <= clock()
            ) {
              records.delete(receipt.key);
              receipt.origin = "none";
              receipt.observedAt = null;
              counts.cacheHits--;
              counts.failures++;
            }
          }
        for (const [key, record] of records) if (record.expiresAt <= clock()) records.delete(key);
        await transaction.save([...records.values()]);
        counts.records = records.size;
        await authorize();
        if (
          sources.some(
            (source) =>
              source.origin === "persistent-cache" &&
              (source.observedAt === null ||
                clock() - source.observedAt > config.limits.cacheAgeMs ||
                (records.get(source.key)?.expiresAt ?? 0) <= clock()),
          )
        )
          throw new Error("expired-hit");
        return {
          ok: true,
          status: "saved",
          profile,
          profileCoverage: covered.length,
          recovered: transaction.recovered,
          counts,
          sources,
        };
      },
      {
        recordAllowed: (record) =>
          config.sources.some(
            (source) =>
              catalogHash(source.sourceRef) === record.key &&
              source.kind === record.kind &&
              catalogHash(JSON.stringify(source.configuration)) === record.authority,
          ) &&
          record.identity === identityHash &&
          record.expiresAt > clock(),
        beforeActivate: async () => {
          await options.beforeActivate?.();
          await authorize();
        },
      },
    );
  } catch {
    return { ok: false, error: { category: "catalog-unavailable" }, saved: false };
  }
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function overlap(a: string, b: string): boolean {
  const left = path.resolve(a).toLowerCase();
  const right = path.resolve(b).toLowerCase();
  return left === right || left.startsWith(right + path.sep) || right.startsWith(left + path.sep);
}
function parse(json: string): Configuration {
  if (typeof json !== "string" || Buffer.byteLength(json) > 131072)
    throw new Error("invalid-input");
  const value: unknown = JSON.parse(json);
  if (
    !exact(value, [
      "version",
      "directory",
      "subjectRef",
      "identity",
      "profile",
      "projectRef",
      "sources",
      "limits",
    ]) ||
    value["version"] !== "0.1.0" ||
    typeof value["directory"] !== "string" ||
    !path.isAbsolute(value["directory"]) ||
    typeof value["subjectRef"] !== "string" ||
    typeof value["projectRef"] !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u.test(value["subjectRef"]) ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u.test(value["projectRef"]) ||
    !Array.isArray(value["sources"]) ||
    value["sources"].length > 32 ||
    !exact(value["limits"], Object.keys(sourceCatalogLimits))
  )
    throw new Error("invalid-input");
  for (const key of Object.keys(sourceCatalogLimits) as (keyof typeof sourceCatalogLimits)[])
    if (!integer(value["limits"][key], 1, sourceCatalogLimits[key]))
      throw new Error("invalid-input");
  const references = new Set<string>();
  for (const source of value["sources"]) {
    if (
      !exact(source, ["sourceRef", "kind", "languages", "configuration"]) ||
      typeof source["sourceRef"] !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u.test(source["sourceRef"]) ||
      references.has(source["sourceRef"]) ||
      !["local", "github"].includes(String(source["kind"])) ||
      !validLanguages(source["languages"])
    )
      throw new Error("invalid-input");
    references.add(source["sourceRef"]);
  }
  return value as unknown as Configuration;
}
