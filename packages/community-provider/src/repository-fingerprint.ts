import { createHash } from "node:crypto";
import { lstat, opendir, realpath } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import {
  isIssuedAuthorizedRepositoryConfig,
  type ResolvedAuthorizedRepositoryConfig,
} from "./authorized-repository-config.ts";

export interface RepositoryFingerprintEntry {
  readonly canonicalPath: string;
  readonly kind: "file" | "directory" | "invalid";
  readonly stamp: string;
}

/** Trusted implementation port; source content never supplies this adapter. */
export interface RepositoryFingerprintPort {
  inspect(candidate: string): Promise<RepositoryFingerprintEntry>;
  list(directory: string, maximumEntries: number): Promise<readonly string[]>;
  hasRepositoryMarker(directory: string): Promise<boolean>;
}

export type RepositoryFingerprintFailure =
  | "invalid-input"
  | "path-unavailable"
  | "not-authorized"
  | "limit-exceeded"
  | "deadline-exceeded"
  | "source-changed";
export type RepositoryFingerprintResult =
  | { readonly ok: true; readonly fingerprint: string; readonly entries: number }
  | {
      readonly ok: false;
      readonly category: RepositoryFingerprintFailure;
      readonly entries: number;
    };

const ignored = new Set(["node_modules", ".fork-me-up", ".hg", ".svn"]);
const digest = /^[0-9a-f]{64}(?![\s\S])/u;

export const nodeRepositoryFingerprintPort: RepositoryFingerprintPort = Object.freeze({
  async hasRepositoryMarker(directory: string) {
    try {
      await lstat(path.join(directory, ".git"));
      return true;
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")
        return false;
      throw error;
    }
  },
  async inspect(candidate: string) {
    const before = await lstat(candidate, { bigint: true });
    if (!before.isFile() && !before.isDirectory())
      return { canonicalPath: candidate, kind: "invalid" as const, stamp: "0".repeat(64) };
    const canonicalPath = await realpath(candidate);
    const after = await lstat(candidate, { bigint: true });
    const beforeStamp = stamp(before);
    if (beforeStamp !== stamp(after)) throw new ProbeFault("source-changed");
    return {
      canonicalPath,
      kind: before.isDirectory() ? ("directory" as const) : ("file" as const),
      stamp: beforeStamp,
    };
  },
  async list(directory: string, maximumEntries: number) {
    if (maximumEntries < 1) throw new ProbeFault("limit-exceeded");
    const handle = await opendir(directory);
    const names: string[] = [];
    for await (const entry of handle) {
      names.push(entry.name);
      // Reserve the final observation for detecting exhaustion without reading an extra entry.
      if (names.length >= maximumEntries) throw new ProbeFault("limit-exceeded");
    }
    return names.sort(compare);
  },
});

class ProbeFault extends Error {
  readonly category: RepositoryFingerprintFailure;
  constructor(category: RepositoryFingerprintFailure) {
    super(category);
    this.category = category;
  }
}

/** Walk metadata only. The authority must already be narrowed to one repository. */
export async function fingerprintRepository(
  authorization: ResolvedAuthorizedRepositoryConfig,
  options: {
    readonly maximumEntries: number;
    readonly port?: RepositoryFingerprintPort;
    readonly now?: () => number;
  },
): Promise<RepositoryFingerprintResult> {
  let entries = 0;
  try {
    if (
      !isIssuedAuthorizedRepositoryConfig(authorization) ||
      authorization.repositories.length !== 1 ||
      !Number.isSafeInteger(options.maximumEntries) ||
      options.maximumEntries < 1
    )
      throw new ProbeFault("invalid-input");
    const repository = authorization.repositories[0];
    const root = authorization.authorizedRoots[0];
    if (repository === undefined || root === undefined || root.rootId !== repository.rootId)
      throw new ProbeFault("invalid-input");
    const port = options.port ?? nodeRepositoryFingerprintPort;
    const now = options.now ?? (() => performance.now());
    const started = now();
    let last = started;
    const checkTime = () => {
      const current = now();
      if (
        !Number.isFinite(current) ||
        current < 0 ||
        current < last ||
        !Number.isFinite(started) ||
        started < 0
      )
        throw new ProbeFault("invalid-input");
      last = current;
      if (current - started >= authorization.limits.maxDurationMs)
        throw new ProbeFault("deadline-exceeded");
    };
    const api = authorization.platform === "win32" ? path.win32 : path.posix;
    const identity = (value: string) =>
      authorization.platform === "win32"
        ? api.normalize(value).toLowerCase()
        : api.normalize(value);
    const maximumEntries = Math.min(
      options.maximumEntries,
      authorization.limits.maxFilesPerRepository,
    );
    const hash = createHash("sha256").update("repository-metadata-v1");
    const inspect = async (candidate: string, boundary: string) => {
      checkTime();
      if (entries >= maximumEntries) throw new ProbeFault("limit-exceeded");
      entries += 1;
      const item = await port.inspect(candidate);
      checkTime();
      if (
        item === null ||
        typeof item !== "object" ||
        typeof item.canonicalPath !== "string" ||
        typeof item.stamp !== "string" ||
        !digest.test(item.stamp) ||
        (item.kind !== "directory" && item.kind !== "file")
      )
        throw new ProbeFault("not-authorized");
      const relative = api.relative(boundary, item.canonicalPath);
      if (
        identity(item.canonicalPath) !== identity(candidate) ||
        api.isAbsolute(relative) ||
        relative === ".." ||
        relative.startsWith(`..${api.sep}`)
      )
        throw new ProbeFault("not-authorized");
      return item;
    };
    const rootBefore = await inspect(root.canonicalPath, root.canonicalPath);
    if (rootBefore.kind !== "directory" || identity(rootBefore.canonicalPath) !== root.pathIdentity)
      throw new ProbeFault("not-authorized");
    hash.update(JSON.stringify([root.rootId, rootBefore.stamp]));
    const walk = async (
      candidate: string,
      relative: string,
      depth: number,
      git: boolean,
    ): Promise<void> => {
      if (depth > authorization.limits.maxDepth) throw new ProbeFault("limit-exceeded");
      const item = await inspect(candidate, repository.canonicalPath);
      if (
        relative === "" &&
        (item.kind !== "directory" || identity(item.canonicalPath) !== repository.pathIdentity)
      )
        throw new ProbeFault("not-authorized");
      hash.update(JSON.stringify([relative, item.kind, item.stamp]));
      if (item.kind === "file") return;
      let nested = false;
      if (!git && relative !== "") {
        if (entries >= maximumEntries) throw new ProbeFault("limit-exceeded");
        entries += 1;
        nested = await port.hasRepositoryMarker(candidate);
        checkTime();
        if (typeof nested !== "boolean") throw new ProbeFault("invalid-input");
      }
      // A nested repository remains an opaque boundary, as in M2-S02.
      if (nested) {
        hash.update("nested-repository");
      } else {
        const allowance = maximumEntries - entries;
        let names: readonly string[];
        try {
          names = await port.list(candidate, allowance);
        } catch (error) {
          entries += allowance;
          throw error;
        }
        if (!Array.isArray(names) || names.length > allowance) {
          entries += allowance;
          throw new ProbeFault("limit-exceeded");
        }
        entries += names.length;
        checkTime();
        if (new Set(names).size !== names.length || !names.every(safeName))
          throw new ProbeFault("limit-exceeded");
        for (const name of [...names].sort(compare)) {
          if (!git && ignored.has(name)) continue;
          await walk(
            api.join(candidate, name),
            relative === "" ? name : `${relative}/${name}`,
            depth + 1,
            git || (relative === "" && name === ".git"),
          );
        }
      }
      const after = await inspect(candidate, repository.canonicalPath);
      if (after.kind !== item.kind || after.stamp !== item.stamp)
        throw new ProbeFault("source-changed");
    };
    const rootRelative = api.relative(root.canonicalPath, repository.canonicalPath);
    if (
      api.isAbsolute(rootRelative) ||
      rootRelative === ".." ||
      rootRelative.startsWith(`..${api.sep}`)
    )
      throw new ProbeFault("not-authorized");
    await walk(repository.canonicalPath, "", 0, false);
    const rootAfter = await inspect(root.canonicalPath, root.canonicalPath);
    if (rootBefore.stamp !== rootAfter.stamp) throw new ProbeFault("source-changed");
    return Object.freeze({ ok: true, fingerprint: hash.digest("hex"), entries });
  } catch (error) {
    return Object.freeze({
      ok: false,
      category: error instanceof ProbeFault ? error.category : "path-unavailable",
      entries,
    });
  }
}

function stamp(value: {
  readonly dev: bigint;
  readonly ino: bigint;
  readonly mode: bigint;
  readonly size: bigint;
  readonly mtimeNs: bigint;
  readonly ctimeNs: bigint;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        [value.dev, value.ino, value.mode, value.size, value.mtimeNs, value.ctimeNs].map(String),
      ),
    )
    .digest("hex");
}

function safeName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 255 &&
    value !== "." &&
    value !== ".." &&
    !/[\\/:]/u.test(value) &&
    [...value].every((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
