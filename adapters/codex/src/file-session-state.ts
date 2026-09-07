import { createHash, randomUUID } from "node:crypto";
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
import type { CodexCachedGuidance, CodexSessionState } from "./codex-hook-adapter.ts";

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
