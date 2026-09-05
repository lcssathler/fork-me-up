import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CodexCachedGuidance, CodexSessionState } from "./codex-hook-adapter.ts";

const maximumCacheBytes = 8_192;
const stateRoot = join(tmpdir(), "fork-me-up-codex-adapter-v1");

export function createFileCodexSessionState(): CodexSessionState {
  return Object.freeze({
    async load(sessionId: string): Promise<unknown | null> {
      await ensureStateRoot();
      const path = statePath(sessionId);
      let metadata;
      try {
        metadata = await lstat(path);
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
      if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > maximumCacheBytes) {
        return null;
      }
      const source = await readFile(path, { encoding: "utf8" });
      if (Buffer.byteLength(source, "utf8") > maximumCacheBytes) return null;
      return JSON.parse(source) as unknown;
    },
    async save(sessionId: string, value: CodexCachedGuidance): Promise<void> {
      await ensureStateRoot();
      const path = statePath(sessionId);
      const temporaryPath = `${path}.${String(process.pid)}.${randomUUID()}.tmp`;
      const source = JSON.stringify(value);
      if (Buffer.byteLength(source, "utf8") > maximumCacheBytes) {
        throw new RangeError("Cache value exceeds its fixed bound.");
      }
      try {
        await writeFile(temporaryPath, source, { encoding: "utf8", flag: "wx", mode: 0o600 });
        await rename(temporaryPath, path);
        if (process.platform !== "win32") await chmod(path, 0o600);
      } catch (error) {
        await unlink(temporaryPath).catch(() => undefined);
        throw error;
      }
    },
    async clear(sessionId: string): Promise<void> {
      await ensureStateRoot();
      const path = statePath(sessionId);
      let metadata;
      try {
        metadata = await lstat(path);
      } catch (error) {
        if (isMissing(error)) return;
        throw error;
      }
      if (!metadata.isFile() && !metadata.isSymbolicLink()) {
        throw new TypeError("Invalid cache entry.");
      }
      await unlink(path);
    },
  });
}

async function ensureStateRoot(): Promise<void> {
  try {
    const metadata = await lstat(stateRoot);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new TypeError("Invalid cache root.");
    }
  } catch (error) {
    if (!isMissing(error)) throw error;
    await mkdir(stateRoot, { recursive: true, mode: 0o700 });
    const metadata = await lstat(stateRoot);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new TypeError("Invalid cache root.", { cause: error });
    }
  }
  if (process.platform !== "win32") await chmod(stateRoot, 0o700);
}

function statePath(sessionId: string): string {
  const key = createHash("sha256").update(sessionId).digest("hex");
  return join(stateRoot, `${key}.json`);
}

function isMissing(error: unknown): boolean {
  return isRecord(error) && error["code"] === "ENOENT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
