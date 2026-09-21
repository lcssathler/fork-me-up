import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, open, opendir, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";

export const catalogLanguages = Object.freeze([
  "typescript",
  "javascript",
  "java",
  "python",
  "csharp",
  "go",
  "rust",
  "powershell",
  "php",
  "ruby",
]);
export interface CatalogRecord {
  key: string;
  authority: string;
  identity: string;
  state: string;
  kind: "local" | "github";
  algorithm: "catalog-observation-v1";
  observedAt: number;
  expiresAt: number;
  languages: string[];
  files: number;
  bytes: number;
  commits: number;
  fork: boolean | null;
  coverage: "bounded-sample";
}
interface Envelope {
  version: "0.1.0";
  binding: string;
  generation: number;
  records: CatalogRecord[];
  checksum: string;
}
export interface CatalogTransaction {
  readonly records: readonly CatalogRecord[];
  readonly recovered: boolean;
  save(records: readonly CatalogRecord[]): Promise<void>;
  delete(): Promise<void>;
}
const maximumBytes = 131072;
const generationPattern = /^catalog\.g-(0|[1-9][0-9]{0,14})\.json$/u;
const stagingPattern = /^\.catalog\.[a-f0-9-]{36}\.tmp$/u;
const lockName = ".catalog.lock";
const barrier = ".catalog.deleted";
const decoder = new TextDecoder("utf8", { fatal: true });
export function catalogHash(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
export function catalogRecord(value: unknown): value is CatalogRecord {
  if (
    !exact(value, [
      "key",
      "authority",
      "identity",
      "state",
      "kind",
      "algorithm",
      "observedAt",
      "expiresAt",
      "languages",
      "files",
      "bytes",
      "commits",
      "fork",
      "coverage",
    ])
  )
    return false;
  return (
    ["key", "authority", "identity", "state"].every((key) => hash(value[key])) &&
    ["local", "github"].includes(String(value["kind"])) &&
    value["algorithm"] === "catalog-observation-v1" &&
    integer(value["observedAt"], 0, 8.64e15) &&
    integer(value["expiresAt"], value["observedAt"] + 1, value["observedAt"] + 86400000) &&
    validLanguages(value["languages"]) &&
    integer(value["files"], 0, 100000) &&
    integer(value["bytes"], 0, 1073741824) &&
    integer(value["commits"], 0, 64) &&
    (value["fork"] === null || typeof value["fork"] === "boolean") &&
    value["coverage"] === "bounded-sample"
  );
}
export function validLanguages(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= catalogLanguages.length &&
    value.every((item) => typeof item === "string" && catalogLanguages.includes(item)) &&
    new Set(value).size === value.length
  );
}
export function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
export function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}
function hash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}
function recordsValid(records: unknown): records is CatalogRecord[] {
  return (
    Array.isArray(records) &&
    records.length <= 32 &&
    records.every(catalogRecord) &&
    new Set(records.map((record) => record.key)).size === records.length
  );
}
function identity(value: string): string {
  return process.platform === "win32" ? path.normalize(value).toLowerCase() : path.normalize(value);
}

/** No serialized catalog field grants authority. The caller owns source revalidation. */
export async function withSourceCatalog<T>(
  directory: string,
  binding: string,
  now: number,
  operation: (transaction: CatalogTransaction) => Promise<T>,
  options: {
    readonly allowDeleted?: boolean;
    readonly beforeActivate?: () => Promise<void>;
    readonly recordAllowed?: (record: CatalogRecord) => boolean;
  } = {},
): Promise<T> {
  if (!path.isAbsolute(directory) || !hash(binding) || !Number.isFinite(now))
    throw new Error("invalid-catalog");
  const canonical = await realpath(directory);
  const root = await lstat(directory, { bigint: true });
  if (!root.isDirectory() || root.isSymbolicLink() || identity(canonical) !== identity(directory))
    throw new Error("invalid-catalog");
  const guard = async (): Promise<void> => {
    const current = await lstat(directory, { bigint: true });
    if (
      !current.isDirectory() ||
      current.isSymbolicLink() ||
      current.dev !== root.dev ||
      current.ino !== root.ino ||
      identity(await realpath(directory)) !== identity(canonical)
    )
      throw new Error("invalid-catalog");
  };
  const read = async (name: string): Promise<Buffer | null> => {
    await guard();
    const filename = path.join(canonical, name);
    let before;
    try {
      before = await lstat(filename, { bigint: true });
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
    if (!before.isFile() || before.isSymbolicLink() || before.size > maximumBytes)
      throw new Error("invalid-catalog");
    const handle = await open(
      filename,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const opened = await handle.stat({ bigint: true });
      if (!same(before, opened)) throw new Error("invalid-catalog");
      const buffer = Buffer.alloc(maximumBytes + 1);
      let count = 0;
      while (count < buffer.length) {
        const result = await handle.read(buffer, count, buffer.length - count, count);
        if (result.bytesRead === 0) break;
        count += result.bytesRead;
      }
      if (
        count > maximumBytes ||
        BigInt(count) !== opened.size ||
        !same(opened, await handle.stat({ bigint: true })) ||
        !same(opened, await lstat(filename, { bigint: true }))
      )
        throw new Error("invalid-catalog");
      await guard();
      return buffer.subarray(0, count);
    } finally {
      await handle.close();
    }
  };
  const create = async (name: string, contents: Buffer): Promise<void> => {
    await guard();
    const handle = await open(
      path.join(canonical, name),
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await handle.writeFile(contents);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await guard();
  };
  const remove = async (name: string): Promise<void> => {
    await guard();
    if ((await read(name)) !== null) await unlink(path.join(canonical, name));
  };
  const sync = async (): Promise<void> => {
    if (process.platform === "win32") return;
    const handle = await open(canonical, constants.O_RDONLY);
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  };
  await create(lockName, Buffer.from("{}"));
  try {
    if ((await read(barrier)) !== null && !options.allowDeleted) throw new Error("catalog-deleted");
    const entries: string[] = [];
    for await (const entry of await opendir(canonical)) {
      entries.push(entry.name);
      if (entries.length > 64) throw new Error("catalog-limit");
    }
    const names = entries
      .filter((name) => generationPattern.test(name))
      .sort((a, b) => generation(b) - generation(a));
    if (names.length > 16) throw new Error("catalog-limit");
    let recovered = false;
    let selected: Envelope | null = null;
    for (const name of names) {
      const bytes = await read(name);
      try {
        const candidate: unknown = bytes === null ? null : JSON.parse(decoder.decode(bytes));
        if (
          !exact(candidate, ["version", "binding", "generation", "records", "checksum"]) ||
          candidate["version"] !== "0.1.0" ||
          !hash(candidate["binding"]) ||
          candidate["generation"] !== generation(name) ||
          !recordsValid(candidate["records"]) ||
          candidate["checksum"] !== catalogHash(JSON.stringify(candidate["records"]))
        )
          throw new Error("invalid-catalog");
        if (
          candidate["records"].some(
            (record) =>
              record.observedAt > now ||
              record.expiresAt <= now ||
              options.recordAllowed?.(record) === false,
          )
        ) {
          await remove(name);
          continue;
        }
        if (candidate["binding"] !== binding) {
          await remove(name);
          continue;
        }
        if (selected === null) selected = candidate as unknown as Envelope;
      } catch {
        recovered = true;
        await remove(name);
      }
    }
    // Only exact task-owned staging names are garbage; unknown files are never removed.
    for (const name of entries.filter((name) => stagingPattern.test(name))) await remove(name);
    let deleted = (await read(barrier)) !== null;
    const next = Math.max(-1, ...names.map(generation)) + 1;
    const transaction: CatalogTransaction = {
      records: structuredClone(selected?.records ?? []),
      recovered,
      async save(records) {
        if (
          deleted ||
          (await read(barrier)) !== null ||
          !recordsValid(records) ||
          records.some((record) => record.observedAt > now || record.expiresAt <= now)
        )
          throw new Error("invalid-catalog");
        const snapshot: Envelope = {
          version: "0.1.0",
          binding,
          generation: next,
          records: structuredClone([...records]),
          checksum: catalogHash(JSON.stringify(records)),
        };
        const bytes = Buffer.from(JSON.stringify(snapshot));
        if (bytes.length > maximumBytes) throw new Error("catalog-limit");
        const temporary = `.catalog.${randomUUID()}.tmp`;
        const target = `catalog.g-${next}.json`;
        await create(temporary, bytes);
        if (!(await read(temporary))?.equals(bytes)) throw new Error("unverified-write");
        await options.beforeActivate?.();
        await guard();
        if ((await read(barrier)) !== null) throw new Error("catalog-deleted");
        await link(path.join(canonical, temporary), path.join(canonical, target));
        await sync();
        if (!(await read(target))?.equals(bytes)) throw new Error("unverified-write");
        await remove(temporary);
        for (const name of names)
          if (
            name !==
            (selected === null ||
            selected.records.some(
              (previous) =>
                !records.some(
                  (record) =>
                    record.key === previous.key &&
                    record.authority === previous.authority &&
                    record.identity === previous.identity,
                ),
            )
              ? null
              : `catalog.g-${selected.generation}.json`)
          )
            await remove(name);
      },
      async delete() {
        if (!deleted) {
          await create(barrier, Buffer.from("{}"));
          await sync();
          deleted = true;
        }
        let count = 0;
        for await (const entry of await opendir(canonical)) {
          if (++count > 64) throw new Error("catalog-limit");
          if (generationPattern.test(entry.name) || stagingPattern.test(entry.name))
            await remove(entry.name);
        }
        await sync();
        count = 0;
        for await (const entry of await opendir(canonical)) {
          if (++count > 64) throw new Error("catalog-limit");
          if (generationPattern.test(entry.name) || stagingPattern.test(entry.name))
            throw new Error("deletion-incomplete");
        }
      },
    };
    return await operation(transaction);
  } finally {
    await remove(lockName);
    await sync();
  }
}
function generation(name: string): number {
  return Number(generationPattern.exec(name)?.[1]);
}
function missing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
function same(a: import("node:fs").BigIntStats, b: import("node:fs").BigIntStats): boolean {
  return (
    a.isFile() &&
    b.isFile() &&
    a.dev === b.dev &&
    a.ino === b.ino &&
    a.mode === b.mode &&
    a.size === b.size &&
    a.mtimeNs === b.mtimeNs &&
    a.ctimeNs === b.ctimeNs
  );
}
