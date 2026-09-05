import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { chmod, link, lstat, open, opendir, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";

import {
  communityProfileStoreMaximumBytes,
  communityProfileStoreSchemaVersion,
  migrateCommunityProfileStore,
  parseCommunityProfileStore,
  serializeCommunityProfileStore,
  type CommunityProfileStore,
  type CommunityProfileStoreFormatErrorCategory,
  type ParsedCommunityProfileStore,
} from "./community-profile-store-format.ts";
import {
  isIssuedLocalProfileStoreConfig,
  type ResolvedLocalProfileStoreConfig,
} from "./local-profile-store-config.ts";
import type { LocalPathPlatform } from "./authorized-repository-config.ts";

export const localProfileStoreHardLimits = Object.freeze({
  maximumDirectoryEntries: 64,
  maximumRecognizedCandidates: 16,
  retainedValidGenerations: 2,
});

export interface LocalProfileStoreDirectoryInspection {
  readonly canonicalPath: string;
  readonly pathIdentity: string;
  readonly kind: "directory" | "symbolic-link" | "file" | "other";
}

export interface LocalProfileStoreFilePort {
  inspectDirectory(
    directoryPath: string,
    platform: LocalPathPlatform,
  ): Promise<LocalProfileStoreDirectoryInspection>;
  listEntries(directoryPath: string, maximumEntries: number): Promise<readonly string[]>;
  readEntry(
    directoryPath: string,
    entryName: string,
    maximumBytes: number,
    platform: LocalPathPlatform,
  ): Promise<Uint8Array | null>;
  writeEntryExclusive(
    directoryPath: string,
    entryName: string,
    bytes: Uint8Array,
  ): Promise<"created" | "exists">;
  linkEntryExclusive(
    directoryPath: string,
    sourceName: string,
    targetName: string,
  ): Promise<"linked" | "exists">;
  removeEntry(directoryPath: string, entryName: string): Promise<boolean>;
  syncDirectory(directoryPath: string, platform: LocalPathPlatform): Promise<void>;
}

export type LocalProfileStoreErrorCategory =
  | CommunityProfileStoreFormatErrorCategory
  | "commit-outcome-unknown"
  | "conflict"
  | "corrupt-store"
  | "migration-required"
  | "not-authorized"
  | "not-configured"
  | "path-unavailable"
  | "persistence-failed";

export interface LoadedLocalProfileStore {
  readonly status: "active" | "recovered" | "migrated";
  readonly value: CommunityProfileStore;
  readonly invalidCandidateCount: number;
  readonly orphanTemporaryCount: number;
  readonly maintenanceRequired: boolean;
}

export type LoadLocalProfileStoreResult =
  | {
      readonly ok: true;
      readonly status: "absent";
      readonly value: null;
      readonly nextGeneration: number;
      readonly invalidCandidateCount: 0;
      readonly orphanTemporaryCount: number;
      readonly maintenanceRequired: boolean;
    }
  | ({ readonly ok: true; readonly nextGeneration: number } & LoadedLocalProfileStore)
  | {
      readonly ok: false;
      readonly error: {
        readonly category: LocalProfileStoreErrorCategory;
        readonly retryable: boolean;
      };
    };

export type WriteLocalProfileStoreResult =
  | {
      readonly ok: true;
      readonly status: "committed";
      readonly value: CommunityProfileStore;
      readonly previousGeneration: number | null;
      readonly maintenanceRequired: boolean;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly category: LocalProfileStoreErrorCategory;
        readonly retryable: boolean;
      };
    };

interface StoreCandidate {
  readonly entryName: string;
  readonly generation: number;
  readonly value: ParsedCommunityProfileStore;
}

interface StoreScan {
  readonly valid: readonly StoreCandidate[];
  readonly invalidEntries: readonly string[];
  readonly invalidCategories: readonly CommunityProfileStoreFormatErrorCategory[];
  readonly temporaryEntries: readonly string[];
  readonly maximumSeenGeneration: number;
}

const decoder = new TextDecoder("utf-8", { fatal: true });
const committedNamePattern = /^community-profile-store\.g-(0|[1-9][0-9]*)\.json$/u;
const temporaryNamePattern =
  /^\.community-profile-store\.g-(0|[1-9][0-9]*)\.[A-Za-z0-9_-]{1,64}\.tmp$/u;
const noncePattern = /^[A-Za-z0-9_-]{1,64}$/u;

class StoreFault extends Error {
  readonly category: LocalProfileStoreErrorCategory;
  readonly retryable: boolean;

  constructor(category: LocalProfileStoreErrorCategory, retryable: boolean) {
    super(category);
    this.category = category;
    this.retryable = retryable;
  }
}

export async function loadLocalProfileStore(
  configuration: ResolvedLocalProfileStoreConfig,
  options: {
    readonly port?: LocalProfileStoreFilePort;
    readonly migrationValidatedAt?: string;
    readonly nonce?: string;
  } = {},
): Promise<LoadLocalProfileStoreResult> {
  if (!isIssuedLocalProfileStoreConfig(configuration)) return failure("not-configured", false);
  if (!isLoadOptions(options)) return failure("invalid-input", false);
  const port = options.port ?? nodeLocalProfileStorePort;
  if (!isPort(port)) return failure("invalid-input", false);
  try {
    await reauthorize(configuration, port);
    const scan = await scanStore(configuration, port);
    const selected = newestCandidate(scan.valid);
    if (selected === undefined) {
      if (scan.invalidEntries.length > 0) {
        const category = scan.invalidCategories.includes("unsupported-version")
          ? "unsupported-version"
          : "corrupt-store";
        throw new StoreFault(category, false);
      }
      return deepFreeze({
        ok: true as const,
        status: "absent" as const,
        value: null,
        nextGeneration: 0,
        invalidCandidateCount: 0 as const,
        orphanTemporaryCount: scan.temporaryEntries.length,
        maintenanceRequired: scan.temporaryEntries.length > 0,
      });
    }
    if (selected.value.storeSchemaVersion !== communityProfileStoreSchemaVersion) {
      if (options.migrationValidatedAt === undefined) {
        throw new StoreFault("migration-required", false);
      }
      const nextGeneration = incrementGeneration(scan.maximumSeenGeneration);
      const migrated = migrateCommunityProfileStore(selected.value, {
        generation: nextGeneration,
        validatedAt: options.migrationValidatedAt,
      });
      if (!migrated.ok) throw new StoreFault(migrated.error.category, false);
      const committed = await commitCandidate(
        configuration,
        migrated.value,
        scan,
        port,
        options.nonce ?? randomUUID(),
      );
      return deepFreeze({
        ok: true as const,
        status: "migrated" as const,
        value: committed.value,
        nextGeneration: incrementGeneration(committed.value.internalState.generation),
        invalidCandidateCount: scan.invalidEntries.length,
        orphanTemporaryCount: scan.temporaryEntries.length,
        maintenanceRequired: committed.maintenanceRequired,
      });
    }
    const recovered = scan.invalidEntries.some(
      (entryName) => generationFromCommittedName(entryName) > selected.generation,
    );
    return deepFreeze({
      ok: true as const,
      status: recovered ? ("recovered" as const) : ("active" as const),
      value: selected.value,
      nextGeneration: incrementGeneration(scan.maximumSeenGeneration),
      invalidCandidateCount: scan.invalidEntries.length,
      orphanTemporaryCount: scan.temporaryEntries.length,
      maintenanceRequired:
        scan.invalidEntries.length > 0 ||
        scan.temporaryEntries.length > 0 ||
        scan.valid.length > localProfileStoreHardLimits.retainedValidGenerations,
    });
  } catch (error) {
    return failureFor(error);
  }
}

export async function writeLocalProfileStore(
  configuration: ResolvedLocalProfileStoreConfig,
  source: string,
  options: {
    readonly expectedGeneration: number | null;
    readonly port?: LocalProfileStoreFilePort;
    readonly nonce?: string;
  },
): Promise<WriteLocalProfileStoreResult> {
  if (!isIssuedLocalProfileStoreConfig(configuration)) return failure("not-configured", false);
  if (!isWriteOptions(options)) return failure("invalid-input", false);
  const port = options.port ?? nodeLocalProfileStorePort;
  const parsed = parseCommunityProfileStore(source);
  if (!parsed.ok) return failure(parsed.error.category, false);
  if (parsed.value.storeSchemaVersion !== communityProfileStoreSchemaVersion) {
    return failure("migration-required", false);
  }
  try {
    await reauthorize(configuration, port);
    const scan = await scanStore(configuration, port);
    const active = newestCandidate(scan.valid);
    if (
      active?.value.storeSchemaVersion !== communityProfileStoreSchemaVersion &&
      active !== undefined
    ) {
      throw new StoreFault("migration-required", false);
    }
    const activeCurrent = active?.value as CommunityProfileStore | undefined;
    const actualGeneration = activeCurrent?.internalState.generation ?? null;
    if (actualGeneration !== options.expectedGeneration) throw new StoreFault("conflict", true);
    if (active === undefined && scan.invalidEntries.length > 0) {
      throw new StoreFault("corrupt-store", false);
    }
    const expectedNextGeneration =
      active === undefined ? 0 : incrementGeneration(scan.maximumSeenGeneration);
    if (
      parsed.value.internalState.generation !== expectedNextGeneration ||
      parsed.value.storeId !== configuration.storeId ||
      parsed.value.subjectRef !== configuration.subjectRef ||
      (activeCurrent !== undefined &&
        (parsed.value.internalState.createdAt !== activeCurrent.internalState.createdAt ||
          parsed.value.internalState.updatedAt < activeCurrent.internalState.updatedAt ||
          parsed.value.internalState.migratedFromStoreSchemaVersion !==
            activeCurrent.internalState.migratedFromStoreSchemaVersion))
    ) {
      throw new StoreFault("invalid-input", false);
    }
    const committed = await commitCandidate(
      configuration,
      parsed.value,
      scan,
      port,
      options.nonce ?? randomUUID(),
    );
    return deepFreeze({
      ok: true as const,
      status: "committed" as const,
      value: committed.value,
      previousGeneration: actualGeneration,
      maintenanceRequired: committed.maintenanceRequired,
    });
  } catch (error) {
    return failureFor(error);
  }
}

async function commitCandidate(
  configuration: ResolvedLocalProfileStoreConfig,
  value: CommunityProfileStore,
  scan: StoreScan,
  port: LocalProfileStoreFilePort,
  nonce: string,
): Promise<{ readonly value: CommunityProfileStore; readonly maintenanceRequired: boolean }> {
  if (!noncePattern.test(nonce)) throw new StoreFault("invalid-input", false);
  const serialized = serializeCommunityProfileStore(value);
  if (!serialized.ok) throw new StoreFault(serialized.error.category, false);
  const generation = value.internalState.generation;
  const temporaryName = `.community-profile-store.g-${String(generation)}.${nonce}.tmp`;
  const finalName = committedName(generation);
  let maintenanceRequired = false;
  const created = await port.writeEntryExclusive(
    configuration.directoryPath,
    temporaryName,
    Buffer.from(serialized.value, "utf8"),
  );
  if (created === "exists") throw new StoreFault("conflict", true);
  try {
    await requireExactEntry(configuration, temporaryName, serialized.value, port);
    const linked = await port.linkEntryExclusive(
      configuration.directoryPath,
      temporaryName,
      finalName,
    );
    if (linked === "exists") throw new StoreFault("conflict", true);
    try {
      await port.syncDirectory(configuration.directoryPath, configuration.platform);
    } catch {
      throw new StoreFault("commit-outcome-unknown", true);
    }
    await requireExactEntry(configuration, finalName, serialized.value, port).catch(() => {
      throw new StoreFault("commit-outcome-unknown", true);
    });
  } finally {
    try {
      if (!(await port.removeEntry(configuration.directoryPath, temporaryName))) {
        maintenanceRequired = true;
      }
    } catch {
      maintenanceRequired = true;
    }
  }
  const cleanup = await cleanupAfterCommit(configuration, value, scan, port);
  return deepFreeze({ value, maintenanceRequired: maintenanceRequired || cleanup });
}

async function requireExactEntry(
  configuration: ResolvedLocalProfileStoreConfig,
  entryName: string,
  expectedSource: string,
  port: LocalProfileStoreFilePort,
): Promise<void> {
  const bytes = await port.readEntry(
    configuration.directoryPath,
    entryName,
    communityProfileStoreMaximumBytes,
    configuration.platform,
  );
  if (bytes === null) throw new StoreFault("persistence-failed", true);
  let source: string;
  try {
    source = decoder.decode(bytes);
  } catch {
    throw new StoreFault("persistence-failed", true);
  }
  const parsed = parseCommunityProfileStore(source);
  if (
    !parsed.ok ||
    parsed.value.storeSchemaVersion !== communityProfileStoreSchemaVersion ||
    source !== expectedSource
  ) {
    throw new StoreFault("persistence-failed", true);
  }
}

async function scanStore(
  configuration: ResolvedLocalProfileStoreConfig,
  port: LocalProfileStoreFilePort,
): Promise<StoreScan> {
  const entries = await port.listEntries(
    configuration.directoryPath,
    localProfileStoreHardLimits.maximumDirectoryEntries,
  );
  if (!isUniqueStringArray(entries, localProfileStoreHardLimits.maximumDirectoryEntries)) {
    throw new StoreFault("limit-exceeded", false);
  }
  const committedEntries = entries.filter((entryName) => committedNamePattern.test(entryName));
  const temporaryEntries = entries.filter((entryName) => temporaryNamePattern.test(entryName));
  if (
    committedEntries.length + temporaryEntries.length >
    localProfileStoreHardLimits.maximumRecognizedCandidates
  ) {
    throw new StoreFault("limit-exceeded", false);
  }
  const valid: StoreCandidate[] = [];
  const invalidEntries: string[] = [];
  const invalidCategories: CommunityProfileStoreFormatErrorCategory[] = [];
  let maximumSeenGeneration = -1;
  for (const entryName of committedEntries.sort(compareText)) {
    const generation = generationFromCommittedName(entryName);
    maximumSeenGeneration = Math.max(maximumSeenGeneration, generation);
    let source: string;
    try {
      const bytes = await port.readEntry(
        configuration.directoryPath,
        entryName,
        communityProfileStoreMaximumBytes,
        configuration.platform,
      );
      if (bytes === null) throw new StoreFault("persistence-failed", true);
      source = decoder.decode(bytes);
    } catch (error) {
      if (error instanceof StoreFault) throw error;
      invalidEntries.push(entryName);
      invalidCategories.push("invalid-input");
      continue;
    }
    const parsed = parseCommunityProfileStore(source);
    if (
      !parsed.ok ||
      parsed.value.internalState.generation !== generation ||
      parsed.value.storeId !== configuration.storeId ||
      parsed.value.subjectRef !== configuration.subjectRef
    ) {
      invalidEntries.push(entryName);
      invalidCategories.push(parsed.ok ? "invalid-input" : parsed.error.category);
      continue;
    }
    valid.push(deepFreeze({ entryName, generation, value: parsed.value }));
  }
  return deepFreeze({
    valid: valid.sort((left, right) => left.generation - right.generation),
    invalidEntries: invalidEntries.sort(compareText),
    invalidCategories,
    temporaryEntries: temporaryEntries.sort(compareText),
    maximumSeenGeneration,
  });
}

async function cleanupAfterCommit(
  configuration: ResolvedLocalProfileStoreConfig,
  committed: CommunityProfileStore,
  scan: StoreScan,
  port: LocalProfileStoreFilePort,
): Promise<boolean> {
  const retained = new Set([
    committedName(committed.internalState.generation),
    ...scan.valid
      .slice()
      .sort((left, right) => right.generation - left.generation)
      .slice(0, localProfileStoreHardLimits.retainedValidGenerations - 1)
      .map((candidate) => candidate.entryName),
  ]);
  const removable = [
    ...scan.invalidEntries,
    ...scan.temporaryEntries,
    ...scan.valid.map((item) => item.entryName),
  ].filter((entryName) => !retained.has(entryName));
  let maintenanceRequired = false;
  for (const entryName of [...new Set(removable)].sort(compareText)) {
    try {
      if (!(await port.removeEntry(configuration.directoryPath, entryName))) {
        maintenanceRequired = true;
      }
    } catch {
      maintenanceRequired = true;
    }
  }
  try {
    await port.syncDirectory(configuration.directoryPath, configuration.platform);
  } catch {
    maintenanceRequired = true;
  }
  return maintenanceRequired;
}

async function reauthorize(
  configuration: ResolvedLocalProfileStoreConfig,
  port: LocalProfileStoreFilePort,
): Promise<void> {
  let inspected: LocalProfileStoreDirectoryInspection;
  try {
    inspected = await port.inspectDirectory(configuration.directoryPath, configuration.platform);
  } catch {
    throw new StoreFault("path-unavailable", true);
  }
  if (
    inspected.kind !== "directory" ||
    inspected.canonicalPath !== configuration.directoryPath ||
    inspected.pathIdentity !== configuration.directoryIdentity
  ) {
    throw new StoreFault("not-authorized", false);
  }
}

function newestCandidate(candidates: readonly StoreCandidate[]): StoreCandidate | undefined {
  return candidates.at(-1);
}

function incrementGeneration(value: number): number {
  if (!Number.isSafeInteger(value) || value >= Number.MAX_SAFE_INTEGER) {
    throw new StoreFault("limit-exceeded", false);
  }
  return value + 1;
}

function committedName(generation: number): string {
  if (!isGeneration(generation)) throw new StoreFault("invalid-input", false);
  return `community-profile-store.g-${String(generation)}.json`;
}

function generationFromCommittedName(entryName: string): number {
  const match = committedNamePattern.exec(entryName);
  if (match?.[1] === undefined) throw new StoreFault("invalid-input", false);
  const value = Number(match[1]);
  if (!isGeneration(value)) throw new StoreFault("limit-exceeded", false);
  return value;
}

function isPort(value: LocalProfileStoreFilePort): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.inspectDirectory === "function" &&
    typeof value.listEntries === "function" &&
    typeof value.readEntry === "function" &&
    typeof value.writeEntryExclusive === "function" &&
    typeof value.linkEntryExclusive === "function" &&
    typeof value.removeEntry === "function" &&
    typeof value.syncDirectory === "function"
  );
}

function isLoadOptions(value: unknown): value is {
  readonly port?: LocalProfileStoreFilePort;
  readonly migrationValidatedAt?: string;
  readonly nonce?: string;
} {
  if (!isRecord(value) || !hasOnlyKeys(value, ["port", "migrationValidatedAt", "nonce"])) {
    return false;
  }
  return (
    (value["port"] === undefined || isPort(value["port"] as LocalProfileStoreFilePort)) &&
    (value["migrationValidatedAt"] === undefined ||
      typeof value["migrationValidatedAt"] === "string") &&
    (value["nonce"] === undefined ||
      (typeof value["nonce"] === "string" && noncePattern.test(value["nonce"])))
  );
}

function isWriteOptions(value: unknown): value is {
  readonly expectedGeneration: number | null;
  readonly port?: LocalProfileStoreFilePort;
  readonly nonce?: string;
} {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["expectedGeneration", "port", "nonce"]) ||
    !("expectedGeneration" in value)
  ) {
    return false;
  }
  return (
    (value["expectedGeneration"] === null || isGeneration(value["expectedGeneration"])) &&
    (value["port"] === undefined || isPort(value["port"] as LocalProfileStoreFilePort)) &&
    (value["nonce"] === undefined ||
      (typeof value["nonce"] === "string" && noncePattern.test(value["nonce"])))
  );
}

function isGeneration(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isUniqueStringArray(value: unknown, maximum: number): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length <= maximum &&
    value.every((item) => typeof item === "string" && item.isWellFormed()) &&
    new Set(value).size === value.length
  );
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failureFor(error: unknown): LoadLocalProfileStoreResult & WriteLocalProfileStoreResult {
  if (error instanceof StoreFault) return failure(error.category, error.retryable);
  return failure("persistence-failed", true);
}

function failure(
  category: LocalProfileStoreErrorCategory,
  retryable: boolean,
): LoadLocalProfileStoreResult & WriteLocalProfileStoreResult {
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

function isSafeEntryName(value: string): boolean {
  return value.length > 0 && value !== "." && value !== ".." && !/[\\/:]/u.test(value);
}

function identityFor(value: string, platform: LocalPathPlatform): string {
  const normalized = (platform === "win32" ? path.win32 : path.posix).normalize(value);
  return platform === "win32" ? normalized.toLowerCase() : normalized;
}

function sameFile(
  left: Awaited<ReturnType<typeof lstat>>,
  right: Awaited<ReturnType<typeof lstat>>,
): boolean {
  return (
    left.isFile() &&
    right.isFile() &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size
  );
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isExists(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}

const nodeLocalProfileStorePortImplementation: LocalProfileStoreFilePort = {
  async inspectDirectory(directoryPath, platform) {
    try {
      const before = await lstat(directoryPath);
      if (before.isSymbolicLink()) {
        return {
          canonicalPath: directoryPath,
          pathIdentity: identityFor(directoryPath, platform),
          kind: "symbolic-link",
        };
      }
      const canonicalPath = (platform === "win32" ? path.win32 : path.posix).normalize(
        await realpath(directoryPath),
      );
      const after = await lstat(canonicalPath);
      return {
        canonicalPath,
        pathIdentity: identityFor(canonicalPath, platform),
        kind:
          before.isDirectory() &&
          after.isDirectory() &&
          before.dev === after.dev &&
          before.ino === after.ino
            ? "directory"
            : before.isFile()
              ? "file"
              : "other",
      };
    } catch {
      throw new StoreFault("path-unavailable", true);
    }
  },
  async listEntries(directoryPath, maximumEntries) {
    const directory = await opendir(directoryPath);
    const names: string[] = [];
    try {
      for await (const entry of directory) {
        names.push(entry.name);
        if (names.length > maximumEntries) throw new StoreFault("limit-exceeded", false);
      }
    } finally {
      await directory.close().catch(() => undefined);
    }
    return Object.freeze(names.sort(compareText));
  },
  async readEntry(directoryPath, entryName, maximumBytes, platform) {
    if (!isSafeEntryName(entryName)) throw new StoreFault("not-authorized", false);
    const candidate = path.join(directoryPath, entryName);
    let before: Awaited<ReturnType<typeof lstat>>;
    try {
      before = await lstat(candidate);
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
    if (!before.isFile() || before.isSymbolicLink()) throw new StoreFault("not-authorized", false);
    if (before.size > maximumBytes) throw new StoreFault("limit-exceeded", false);
    const canonical = await realpath(candidate);
    if (identityFor(canonical, platform) !== identityFor(candidate, platform)) {
      throw new StoreFault("not-authorized", false);
    }
    const handle = await open(candidate, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const opened = await handle.stat();
      if (!sameFile(before, opened)) throw new StoreFault("not-authorized", false);
      const bytes = await handle.readFile();
      const after = await lstat(candidate);
      if (bytes.byteLength > maximumBytes) throw new StoreFault("limit-exceeded", false);
      if (!sameFile(opened, after) || after.size !== bytes.byteLength) {
        throw new StoreFault("not-authorized", false);
      }
      return bytes;
    } finally {
      await handle.close().catch(() => undefined);
    }
  },
  async writeEntryExclusive(directoryPath, entryName, bytes) {
    if (
      !temporaryNamePattern.test(entryName) ||
      bytes.byteLength > communityProfileStoreMaximumBytes
    ) {
      throw new StoreFault("invalid-input", false);
    }
    const candidate = path.join(directoryPath, entryName);
    let handle;
    try {
      handle = await open(
        candidate,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
        0o600,
      );
    } catch (error) {
      if (isExists(error)) return "exists";
      throw error;
    }
    try {
      await handle.writeFile(bytes);
      await handle.sync();
      if (process.platform !== "win32") await chmod(candidate, 0o600);
      return "created";
    } finally {
      await handle.close().catch(() => undefined);
    }
  },
  async linkEntryExclusive(directoryPath, sourceName, targetName) {
    if (!temporaryNamePattern.test(sourceName) || !committedNamePattern.test(targetName)) {
      throw new StoreFault("invalid-input", false);
    }
    try {
      await link(path.join(directoryPath, sourceName), path.join(directoryPath, targetName));
      return "linked";
    } catch (error) {
      if (isExists(error)) return "exists";
      throw error;
    }
  },
  async removeEntry(directoryPath, entryName) {
    if (!committedNamePattern.test(entryName) && !temporaryNamePattern.test(entryName)) {
      throw new StoreFault("not-authorized", false);
    }
    const candidate = path.join(directoryPath, entryName);
    let metadata;
    try {
      metadata = await lstat(candidate);
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new StoreFault("not-authorized", false);
    }
    await unlink(candidate);
    return true;
  },
  async syncDirectory(directoryPath, platform) {
    if (platform === "win32") return;
    const handle = await open(directoryPath, constants.O_RDONLY);
    try {
      await handle.sync();
    } finally {
      await handle.close().catch(() => undefined);
    }
  },
};

export const nodeLocalProfileStorePort: LocalProfileStoreFilePort = Object.freeze(
  nodeLocalProfileStorePortImplementation,
);
