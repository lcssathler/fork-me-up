import { createHash, randomUUID } from "node:crypto";
import { constants, type BigIntStats } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  open,
  opendir,
  readFile,
  realpath,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, normalize } from "node:path";
import { TextDecoder } from "node:util";
import {
  renderCodexGuidance,
  type CodexCachedGuidance,
  type CodexSessionState,
} from "./codex-hook-adapter.ts";

const maximumCacheBytes = 8_192;
const defaultStateRoot = join(tmpdir(), "fork-me-up-codex-adapter-v1");
const maximumDirectoryEntries = 256;
const lockName = ".mutation.lock";
const deletedName = ".deleted";
const recognizedName =
  /^[a-f0-9]{64}\.json(?:\.[1-9][0-9]*\.[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.tmp)?$/u;

/** The optional root is a trusted embedding/test input, never a hook request field. */
export interface FileCodexSessionStateOptions {
  readonly root?: string;
}
export type ClearFileCodexSessionStateResult =
  | { readonly ok: true; readonly status: "deleted"; readonly removedEntries: number }
  | {
      readonly ok: false;
      readonly error: {
        readonly category: "deletion-incomplete" | "conflict" | "not-authorized";
        readonly retryable: boolean;
      };
    };
export interface InspectFileCodexSessionStateResult {
  readonly status:
    "ready" | "absent" | "deleted" | "busy" | "invalid" | "unavailable" | "limit-exceeded";
  readonly entries: number;
  readonly fresh: number;
  readonly stale: number;
}
class CacheInspectionFault extends Error {
  readonly status: InspectFileCodexSessionStateResult["status"];
  constructor(status: InspectFileCodexSessionStateResult["status"]) {
    super(status);
    this.status = status;
  }
}
class CacheFault extends Error {
  readonly category: "deletion-incomplete" | "conflict" | "not-authorized";
  constructor(category: "deletion-incomplete" | "conflict" | "not-authorized") {
    super(category);
    this.category = category;
  }
}

export function createFileCodexSessionState(
  options: FileCodexSessionStateOptions = {},
): CodexSessionState {
  const configured = configuredRoot(options);
  const useDefaultRoot = options.root === undefined;
  return Object.freeze({
    async load(sessionId: string): Promise<unknown | null> {
      const root = await operationalRoot(configured, useDefaultRoot);
      return withGate(root, async () => {
        if (await isDeleted(root)) return null;
        const path = statePath(root, sessionId);
        const metadata = await inspectFile(root, path);
        if (metadata === null || metadata.size > maximumCacheBytes) return null;
        const source = await readFile(path, { encoding: "utf8" });
        if (Buffer.byteLength(source, "utf8") > maximumCacheBytes) return null;
        return JSON.parse(source) as unknown;
      });
    },
    async save(sessionId: string, value: CodexCachedGuidance): Promise<void> {
      const root = await operationalRoot(configured, useDefaultRoot);
      await withGate(root, async () => {
        if (await isDeleted(root)) throw new CacheFault("not-authorized");
        const path = statePath(root, sessionId);
        await inspectFile(root, path);
        const temporaryPath = `${path}.${String(process.pid)}.${randomUUID()}.tmp`;
        const source = JSON.stringify(value);
        if (Buffer.byteLength(source, "utf8") > maximumCacheBytes) {
          throw new RangeError("Cache value exceeds its fixed bound.");
        }
        try {
          await writeFile(temporaryPath, source, { encoding: "utf8", flag: "wx", mode: 0o600 });
          await verifyRoot(root);
          await rename(temporaryPath, path);
          if (process.platform !== "win32") await chmod(path, 0o600);
        } catch {
          await verifyRoot(root);
          await unlink(temporaryPath).catch(() => undefined);
          throw new CacheFault("deletion-incomplete");
        }
      });
    },
    async clear(sessionId: string): Promise<void> {
      const root = await operationalRoot(configured, useDefaultRoot);
      await withGate(root, async () => {
        if (await isDeleted(root)) return;
        const path = statePath(root, sessionId);
        if (await inspectFile(root, path)) await unlink(path);
      });
    },
  });
}

async function ensureStateRoot(root: string): Promise<void> {
  try {
    await verifyRoot(root);
  } catch (error) {
    if (!isMissing(error)) throw error;
    await mkdir(root, { mode: 0o700 }).catch((cause: unknown) => {
      if (!isExists(cause)) throw cause;
    });
    await verifyRoot(root);
  }
  if (process.platform !== "win32") await chmod(root, 0o700);
}

function statePath(root: string, sessionId: string): string {
  const key = createHash("sha256").update(sessionId).digest("hex");
  return join(root, `${key}.json`);
}

/** Deletes recognized files only. The durable marker intentionally prevents cache reuse. */
export async function clearFileCodexSessionState(
  request: { readonly scope: "all-adapter-cache" },
  options: FileCodexSessionStateOptions = {},
): Promise<ClearFileCodexSessionStateResult> {
  try {
    if (
      !isRecord(request) ||
      Object.keys(request).length !== 1 ||
      request["scope"] !== "all-adapter-cache"
    )
      throw new CacheFault("not-authorized");
    const root = await operationalRoot(configuredRoot(options), options.root === undefined);
    const removedEntries = await withGate(root, async () => {
      if (!(await isDeleted(root))) {
        const marker = await open(join(root, deletedName), "wx", 0o600);
        try {
          await marker.sync();
        } finally {
          await marker.close();
        }
      }
      // Resumption may observe a barrier created before a prior directory sync failed.
      await syncRoot(root);
      const names = await recognizedEntries(root);
      for (const name of names) await inspectFile(root, join(root, name));
      for (const name of names) {
        const path = join(root, name);
        if (await inspectFile(root, path)) await unlink(path);
      }
      await syncRoot(root);
      if ((await recognizedEntries(root)).length !== 0 || !(await isDeleted(root)))
        throw new CacheFault("deletion-incomplete");
      return names.length;
    });
    return Object.freeze({ ok: true, status: "deleted", removedEntries });
  } catch (error) {
    const category = error instanceof CacheFault ? error.category : "deletion-incomplete";
    return Object.freeze({
      ok: false,
      error: Object.freeze({ category, retryable: category !== "not-authorized" }),
    });
  }
}

/** Read-only owner diagnostics: no root creation, permission changes, gates or cleanup. */
export async function inspectFileCodexSessionState(
  request: { readonly at: string },
  options: FileCodexSessionStateOptions = {},
): Promise<InspectFileCodexSessionStateResult> {
  try {
    if (
      !isRecord(request) ||
      Object.keys(request).length !== 1 ||
      !inspectionTimestamp(request["at"])
    )
      return inspectionResult("invalid");
    const root = await operationalRoot(configuredRoot(options), options.root === undefined);
    let before;
    try {
      before = await inspectionRoot(root);
    } catch (error) {
      if (isMissing(error)) return inspectionResult("absent");
      throw error;
    }
    const barrier = await inspectionControl(root);
    const directory = await opendir(root);
    const names: string[] = [];
    let count = 0;
    for await (const entry of directory) {
      if (++count > maximumDirectoryEntries) throw new CacheInspectionFault("limit-exceeded");
      if (recognizedName.test(entry.name)) names.push(entry.name);
    }
    if (names.some((name) => !name.endsWith(".json")) || (barrier && names.length > 0))
      throw new CacheInspectionFault("invalid");
    let bytes = 0;
    let fresh = 0;
    let stale = 0;
    for (const name of names.sort()) {
      const read = await readInspectionEntry(root, name, 2_097_152 - bytes);
      bytes += read.bytes;
      if (read.value.expiresAt > request.at) fresh += 1;
      else stale += 1;
    }
    const afterBarrier = await inspectionControl(root);
    const after = await inspectionRoot(root);
    if (!sameInspectionStamp(before, after) || barrier !== afterBarrier)
      throw new CacheInspectionFault("busy");
    return inspectionResult(barrier ? "deleted" : "ready", names.length, fresh, stale);
  } catch (error) {
    return inspectionResult(
      error instanceof CacheInspectionFault
        ? error.status
        : error instanceof CacheFault
          ? "invalid"
          : "unavailable",
    );
  }
}

async function inspectionRoot(root: string): Promise<BigIntStats> {
  const before = await lstat(root, { bigint: true });
  await verifyRoot(root);
  const after = await lstat(root, { bigint: true });
  if (!sameInspectionStamp(before, after)) throw new CacheInspectionFault("busy");
  return after;
}
async function inspectionControl(root: string): Promise<boolean> {
  if (await inspectFile(root, join(root, lockName))) throw new CacheInspectionFault("busy");
  return isDeleted(root);
}
async function readInspectionEntry(
  root: string,
  name: string,
  remainingBytes: number,
): Promise<{ readonly value: CodexCachedGuidance; readonly bytes: number }> {
  const path = join(root, name);
  await inspectFile(root, path);
  const before = await lstat(path, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) throw new CacheInspectionFault("invalid");
  if (before.size > BigInt(maximumCacheBytes)) throw new CacheInspectionFault("limit-exceeded");
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || !sameInspectionStamp(before, opened))
      throw new CacheInspectionFault("busy");
    const buffer = Buffer.alloc(Math.min(maximumCacheBytes + 1, remainingBytes + 1));
    let bytes = 0;
    while (bytes < buffer.length) {
      const read = await handle.read(buffer, bytes, buffer.length - bytes, bytes);
      if (read.bytesRead === 0) break;
      bytes += read.bytesRead;
    }
    if (bytes > maximumCacheBytes || bytes > remainingBytes)
      throw new CacheInspectionFault("limit-exceeded");
    const finished = await handle.stat({ bigint: true });
    const after = await lstat(path, { bigint: true });
    if (
      !sameInspectionStamp(opened, finished) ||
      !sameInspectionStamp(opened, after) ||
      BigInt(bytes) !== finished.size
    )
      throw new CacheInspectionFault("busy");
    await verifyRoot(root);
    let value: CodexCachedGuidance;
    try {
      value = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytes)),
      ) as CodexCachedGuidance;
    } catch {
      throw new CacheInspectionFault("invalid");
    }
    if (renderCodexGuidance(value) === null) throw new CacheInspectionFault("invalid");
    return { value, bytes };
  } finally {
    await handle.close();
  }
}
function sameInspectionStamp(left: BigIntStats, right: BigIntStats): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}
function inspectionTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z(?![\s\S])/u.test(value))
    return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value.replace("Z", ".000Z");
}
function inspectionResult(
  status: InspectFileCodexSessionStateResult["status"],
  entries = 0,
  fresh = 0,
  stale = 0,
): InspectFileCodexSessionStateResult {
  return Object.freeze({ status, entries, fresh, stale });
}

function configuredRoot(options: FileCodexSessionStateOptions): string {
  if (!isRecord(options) || Object.keys(options).some((key) => key !== "root"))
    throw new CacheFault("not-authorized");
  const root = options["root"] ?? defaultStateRoot;
  if (
    typeof root !== "string" ||
    !root.isWellFormed() ||
    !isAbsolute(root) ||
    [...root].some((character) => character.charCodeAt(0) < 32)
  )
    throw new CacheFault("not-authorized");
  return normalize(root);
}
async function operationalRoot(configured: string, useDefaultRoot: boolean): Promise<string> {
  // Windows may expose TEMP through an 8.3 alias. Canonicalize only the existing parent;
  // verifyRoot must still reject a redirected adapter directory itself.
  return useDefaultRoot
    ? join(await realpath(tmpdir()), "fork-me-up-codex-adapter-v1")
    : configured;
}
async function verifyRoot(root: string): Promise<void> {
  const before = await lstat(root);
  if (
    !before.isDirectory() ||
    before.isSymbolicLink() ||
    identity(await realpath(root)) !== identity(root)
  )
    throw new CacheFault("not-authorized");
  const after = await lstat(root);
  if (
    !after.isDirectory() ||
    after.isSymbolicLink() ||
    before.dev !== after.dev ||
    before.ino !== after.ino
  )
    throw new CacheFault("not-authorized");
}
async function withGate<Value>(root: string, operation: () => Promise<Value>): Promise<Value> {
  await ensureStateRoot(root);
  let handle;
  try {
    handle = await open(join(root, lockName), "wx", 0o600);
  } catch (error) {
    if (isExists(error)) throw new CacheFault("conflict");
    throw error;
  }
  try {
    await handle.sync();
    await verifyRoot(root);
    return await operation();
  } finally {
    await handle.close();
    await verifyRoot(root);
    await unlink(join(root, lockName));
  }
}
async function inspectFile(
  root: string,
  path: string,
): Promise<Awaited<ReturnType<typeof lstat>> | null> {
  await verifyRoot(root);
  let metadata;
  try {
    metadata = await lstat(path);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    identity(await realpath(path)) !== identity(path)
  )
    throw new CacheFault("not-authorized");
  return metadata;
}
async function isDeleted(root: string): Promise<boolean> {
  const marker = join(root, deletedName);
  const metadata = await inspectFile(root, marker);
  if (metadata === null) return false;
  if (metadata.size !== 0) throw new CacheFault("not-authorized");
  return true;
}
async function recognizedEntries(root: string): Promise<string[]> {
  await verifyRoot(root);
  const directory = await opendir(root);
  const recognized: string[] = [];
  let count = 0;
  for await (const entry of directory) {
    if (++count > maximumDirectoryEntries) throw new CacheFault("deletion-incomplete");
    if (recognizedName.test(entry.name)) recognized.push(entry.name);
  }
  return recognized.sort();
}
async function syncRoot(root: string): Promise<void> {
  await verifyRoot(root);
  if (process.platform === "win32") return;
  const directory = await open(root, "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}
function identity(path: string): string {
  return process.platform === "win32" ? normalize(path).toLowerCase() : normalize(path);
}
function isExists(error: unknown): boolean {
  return isRecord(error) && error["code"] === "EEXIST";
}
function isMissing(error: unknown): boolean {
  return isRecord(error) && error["code"] === "ENOENT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
