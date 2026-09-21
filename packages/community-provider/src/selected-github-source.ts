import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { TextDecoder } from "node:util";
import { digestGitIdentity } from "./git-identity.ts";
import { nodeSelectedGitHubPort } from "./selected-github-transport.ts";

export const selectedGitHubLimits = Object.freeze({
  repositories: 8,
  requests: 64,
  responseBytes: 1_048_576,
  totalBytes: 8_388_608,
  durationMs: 60_000,
  treeEntries: 4096,
  files: 16,
  fileBytes: 131_072,
  commits: 8,
});
type Limits = typeof selectedGitHubLimits;
export interface SelectedGitHubPort {
  get(request: {
    readonly endpoint: string;
    readonly maximumOutputBytes: number;
    readonly timeoutMs: number;
    readonly beforeRequest?: () => Promise<void>;
  }): Promise<{ readonly ok: true; readonly output: Uint8Array } | { readonly ok: false }>;
}
interface Selection {
  repositoryRef: string;
  owner: string;
  name: string;
  visibility: "public" | "private";
  metadata: boolean;
  content: boolean;
  history: boolean;
}
interface Configuration {
  version: "0.1.0";
  account: string;
  subjectRef: string;
  issuedAt: string;
  expiresAt: string;
  repositories: Selection[];
  limits: Limits;
}
export interface SelectedGitHubObservation {
  readonly repositoryRef: string;
  readonly visibility: "public" | "private";
  readonly fork: boolean;
  readonly archived: boolean;
  readonly revision: string | null;
  readonly files: readonly {
    readonly sourceRef: string;
    readonly language: string;
    readonly bytes: number;
    readonly fingerprint: string;
  }[];
  readonly commits: readonly {
    readonly revision: string;
    readonly authorDigest: string | null;
    readonly parentCount: number;
  }[];
  readonly skippedEntries: number;
  readonly coverage: "metadata-only" | "bounded-sample";
}
export type SelectedGitHubResult =
  | {
      readonly ok: true;
      readonly observations: readonly SelectedGitHubObservation[];
      readonly counts: {
        readonly requests: number;
        readonly responseBytes: number;
        readonly repositories: number;
        readonly files: number;
        readonly commits: number;
      };
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly category:
          | "invalid-input"
          | "not-authorized"
          | "unavailable"
          | "invalid-response"
          | "limit-exceeded";
      };
      readonly requests: number;
    };

const sha = /^[a-f0-9]{40}$/u;
const owner = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/u;
const name = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,98}[a-zA-Z0-9_-])?$/u;
const opaque = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/u;
const decoder = new TextDecoder("utf-8", { fatal: true });
const languages: Readonly<Record<string, string>> = Object.freeze({
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  java: "java",
  py: "python",
  cs: "csharp",
  go: "go",
  rs: "rust",
  ps1: "powershell",
  php: "php",
  rb: "ruby",
});

/** Owner-only read operation. The live authority reader must return the current exact configuration. */
export async function readSelectedGitHubSources(
  configurationJson: string,
  operation: "discover" | "collect",
  options: {
    readonly readAuthority: () => Promise<string | null>;
    readonly port?: SelectedGitHubPort;
    readonly clock?: () => number;
    readonly monotonic?: () => number;
  },
): Promise<SelectedGitHubResult> {
  let requests = 0;
  let bytes = 0;
  try {
    const config = configuration(configurationJson);
    if (operation !== "discover" && operation !== "collect") fail("invalid-input");
    const clock = options.clock ?? Date.now;
    const monotonic = options.monotonic ?? (() => performance.now());
    const start = monotonic();
    let previous = start;
    const elapsed = (): number => {
      const now = monotonic();
      if (!Number.isFinite(now) || !Number.isFinite(start) || now < previous)
        fail("limit-exceeded");
      previous = now;
      const used = now - start;
      if (used >= config.limits.durationMs) fail("limit-exceeded");
      return used;
    };
    const authorize = async (): Promise<void> => {
      elapsed();
      if ((await options.readAuthority()) !== configurationJson) fail("not-authorized");
      const now = clock();
      if (
        !Number.isFinite(now) ||
        now < Date.parse(config.issuedAt) ||
        now >= Date.parse(config.expiresAt)
      )
        fail("not-authorized");
      elapsed();
    };
    const get = async (endpoint: string): Promise<unknown> => {
      await authorize();
      if (requests >= config.limits.requests || bytes >= config.limits.totalBytes)
        fail("limit-exceeded");
      const maximumOutputBytes = Math.min(
        config.limits.responseBytes,
        config.limits.totalBytes - bytes,
      );
      requests++;
      const result = await (options.port ?? nodeSelectedGitHubPort).get({
        endpoint,
        maximumOutputBytes,
        beforeRequest: authorize,
        timeoutMs: Math.max(1, Math.floor(config.limits.durationMs - elapsed())),
      });
      await authorize();
      if (!result.ok) fail("unavailable");
      if (!(result.output instanceof Uint8Array) || result.output.byteLength > maximumOutputBytes)
        fail("limit-exceeded");
      bytes += result.output.byteLength;
      try {
        return JSON.parse(decoder.decode(result.output));
      } catch {
        return fail("invalid-response");
      }
    };
    const identity = async (): Promise<void> => {
      const user = await get("/user");
      if (
        !record(user) ||
        typeof user["login"] !== "string" ||
        user["login"].toLowerCase() !== config.account.toLowerCase()
      )
        fail("not-authorized");
    };
    if (
      config.repositories.some(
        (selection) =>
          !selection.metadata ||
          (operation === "collect" && !selection.content && !selection.history),
      )
    )
      fail("not-authorized");
    await identity();
    const observations: SelectedGitHubObservation[] = [];
    for (const selection of config.repositories) {
      if (
        !selection.metadata ||
        (operation === "collect" && !selection.content && !selection.history)
      )
        fail("not-authorized");
      const base = `/repos/${selection.owner}/${selection.name}`;
      const metadata = await get(base);
      const repositoryId = validateMetadata(metadata, selection);
      const objectBase = `/repositories/${repositoryId}`;
      if (!record(metadata)) fail("invalid-response");
      const files: SelectedGitHubObservation["files"][number][] = [];
      const commits: SelectedGitHubObservation["commits"][number][] = [];
      let revision: string | null = null;
      let skippedEntries = 0;
      if (operation === "collect") {
        // Resolving a ref avoids the REST commit endpoint, which includes unselected patches.
        const branch = metadata["default_branch"];
        if (
          typeof branch !== "string" ||
          !safePath(branch) ||
          !/^[A-Za-z0-9._/-]{1,200}$/u.test(branch)
        )
          fail("invalid-response");
        const ref = await get(`${objectBase}/git/ref/heads/${branch}`);
        if (
          !record(ref) ||
          ref["ref"] !== `refs/heads/${branch}` ||
          !record(ref["object"]) ||
          ref["object"]["type"] !== "commit" ||
          !objectId(ref["object"]["sha"])
        )
          fail("invalid-response");
        revision = ref["object"]["sha"];
        const head = await get(`${objectBase}/git/commits/${revision}`);
        if (
          !record(head) ||
          head["sha"] !== revision ||
          !record(head["tree"]) ||
          !objectId(head["tree"]["sha"])
        )
          fail("invalid-response");
        const treeId = head["tree"]["sha"];
        if (selection.content) {
          const tree = await get(`${objectBase}/git/trees/${treeId}?recursive=1`);
          if (
            !record(tree) ||
            tree["sha"] !== treeId ||
            tree["truncated"] !== false ||
            !Array.isArray(tree["tree"]) ||
            tree["tree"].length > config.limits.treeEntries
          )
            fail("limit-exceeded");
          const seen = new Set<string>();
          for (const entry of tree["tree"]) {
            if (
              !record(entry) ||
              !safePath(entry["path"]) ||
              !objectId(entry["sha"]) ||
              seen.has(entry["path"])
            )
              fail("invalid-response");
            seen.add(entry["path"]);
            const language = sourceLanguage(entry["path"]);
            if (
              entry["type"] !== "blob" ||
              !["100644", "100755"].includes(String(entry["mode"])) ||
              language === null ||
              !integer(entry["size"], 0, config.limits.fileBytes) ||
              files.length >= config.limits.files
            ) {
              skippedEntries++;
              continue;
            }
            const blob = await get(`${objectBase}/git/blobs/${entry["sha"]}`);
            if (
              !record(blob) ||
              blob["sha"] !== entry["sha"] ||
              blob["encoding"] !== "base64" ||
              blob["size"] !== entry["size"] ||
              typeof blob["content"] !== "string"
            )
              fail("invalid-response");
            const encoded = blob["content"].replace(/\n/gu, "");
            if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded))
              fail("invalid-response");
            const content = Buffer.from(encoded, "base64");
            if (
              content.byteLength !== entry["size"] ||
              createHash("sha1")
                .update(`blob ${content.byteLength}\0`)
                .update(content)
                .digest("hex") !== entry["sha"]
            )
              fail("invalid-response");
            // No prose leaves the collection boundary, including instruction-bearing source.
            try {
              if (decoder.decode(content).includes("\0")) {
                skippedEntries++;
                continue;
              }
            } catch {
              skippedEntries++;
              continue;
            }
            files.push(
              Object.freeze({
                sourceRef: digest(entry["path"]),
                language,
                bytes: content.byteLength,
                fingerprint: digest(content),
              }),
            );
          }
        }
        if (selection.history) {
          const pending = [revision];
          const seen = new Set<string>();
          while (pending.length > 0 && commits.length < config.limits.commits) {
            const next = pending.shift();
            if (next === undefined || seen.has(next)) continue;
            seen.add(next);
            const commit =
              next === revision ? head : await get(`${objectBase}/git/commits/${next}`);
            if (
              !record(commit) ||
              commit["sha"] !== next ||
              !Array.isArray(commit["parents"]) ||
              commit["parents"].length > 16
            )
              fail("invalid-response");
            for (const parent of commit["parents"]) {
              if (!record(parent) || !objectId(parent["sha"])) fail("invalid-response");
              if (!seen.has(parent["sha"])) pending.push(parent["sha"]);
            }
            const author = commit["author"];
            const authorDigest =
              record(author) &&
              typeof author["name"] === "string" &&
              typeof author["email"] === "string"
                ? (digestGitIdentity(author["name"], author["email"]) ?? null)
                : null;
            commits.push(
              Object.freeze({
                revision: next,
                authorDigest,
                parentCount: commit["parents"].length,
              }),
            );
          }
        }
      }
      if (validateMetadata(await get(base), selection) !== repositoryId) fail("not-authorized");
      observations.push(
        Object.freeze({
          repositoryRef: selection.repositoryRef,
          visibility: selection.visibility,
          fork: metadata["fork"] === true,
          archived: metadata["archived"] === true,
          revision,
          files: Object.freeze(files),
          commits: Object.freeze(commits),
          skippedEntries,
          coverage: operation === "discover" ? "metadata-only" : "bounded-sample",
        }),
      );
    }
    await identity();
    await authorize();
    return Object.freeze({
      ok: true,
      observations: Object.freeze(observations),
      counts: Object.freeze({
        requests,
        responseBytes: bytes,
        repositories: observations.length,
        files: observations.reduce((sum, item) => sum + item.files.length, 0),
        commits: observations.reduce((sum, item) => sum + item.commits.length, 0),
      }),
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        category: error instanceof SourceFailure ? error.category : "unavailable",
      }),
      requests,
    });
  }
}

class SourceFailure extends Error {
  readonly category:
    "invalid-input" | "not-authorized" | "unavailable" | "invalid-response" | "limit-exceeded";
  constructor(category: SourceFailure["category"]) {
    super(category);
    this.category = category;
  }
}
function fail(category: SourceFailure["category"]): never {
  throw new SourceFailure(category);
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
function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}
function objectId(value: unknown): value is string {
  return typeof value === "string" && sha.test(value);
}
function digest(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
function safePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 512 &&
    value.isWellFormed() &&
    !/[\\:]/u.test(value) &&
    ![...value].some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) &&
    value.split("/").length <= 24 &&
    value.split("/").every((part) => part.length > 0 && part !== "." && part !== "..")
  );
}
function sourceLanguage(value: string): string | null {
  if (
    /(?:^|\/)(?:\.[^/]*|node_modules|vendor|dist|build|coverage|generated|fixtures|testdata|config|configuration|settings|secrets?)(?:\/|$)/iu.test(
      value,
    ) ||
    /(?:secret|credential|token|password|private[-_]?key|(?:^|[./_-])(?:config|configuration|settings)(?:[./_-]|$))/iu.test(
      value,
    )
  )
    return null;
  const extension = value.split(".").at(-1)?.toLowerCase() ?? "";
  return Object.hasOwn(languages, extension) ? (languages[extension] ?? null) : null;
}
function validateMetadata(value: unknown, selection: Selection): number {
  if (
    !record(value) ||
    !integer(value["id"], 1, Number.MAX_SAFE_INTEGER) ||
    typeof value["full_name"] !== "string" ||
    value["full_name"].toLowerCase() !== `${selection.owner}/${selection.name}`.toLowerCase() ||
    value["visibility"] !== selection.visibility ||
    value["private"] !== (selection.visibility === "private") ||
    typeof value["fork"] !== "boolean" ||
    typeof value["archived"] !== "boolean"
  )
    fail("not-authorized");
  return value["id"];
}
function configuration(json: string): Configuration {
  if (typeof json !== "string" || Buffer.byteLength(json) > 32768) fail("invalid-input");
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return fail("invalid-input");
  }
  if (
    !shape(value, [
      "version",
      "account",
      "subjectRef",
      "issuedAt",
      "expiresAt",
      "repositories",
      "limits",
    ]) ||
    value["version"] !== "0.1.0" ||
    typeof value["account"] !== "string" ||
    !owner.test(value["account"]) ||
    typeof value["subjectRef"] !== "string" ||
    !opaque.test(value["subjectRef"]) ||
    !timestamp(value["issuedAt"]) ||
    !timestamp(value["expiresAt"]) ||
    Date.parse(value["expiresAt"]) <= Date.parse(value["issuedAt"]) ||
    Date.parse(value["expiresAt"]) - Date.parse(value["issuedAt"]) > 86400000 ||
    !Array.isArray(value["repositories"]) ||
    !shape(value["limits"], Object.keys(selectedGitHubLimits))
  )
    fail("invalid-input");
  for (const key of Object.keys(selectedGitHubLimits) as (keyof Limits)[]) {
    if (!integer(value["limits"][key], 1, selectedGitHubLimits[key])) fail("invalid-input");
  }
  if (
    value["repositories"].length < 1 ||
    value["repositories"].length > Number(value["limits"]["repositories"])
  )
    fail("invalid-input");
  const refs = new Set<string>();
  const names = new Set<string>();
  for (const selection of value["repositories"]) {
    if (
      !shape(selection, [
        "repositoryRef",
        "owner",
        "name",
        "visibility",
        "metadata",
        "content",
        "history",
      ]) ||
      typeof selection["repositoryRef"] !== "string" ||
      !opaque.test(selection["repositoryRef"]) ||
      typeof selection["owner"] !== "string" ||
      !owner.test(selection["owner"]) ||
      typeof selection["name"] !== "string" ||
      !name.test(selection["name"]) ||
      !["public", "private"].includes(String(selection["visibility"])) ||
      typeof selection["metadata"] !== "boolean" ||
      typeof selection["content"] !== "boolean" ||
      typeof selection["history"] !== "boolean"
    )
      fail("invalid-input");
    const fullName = `${selection["owner"]}/${selection["name"]}`.toLowerCase();
    if (refs.has(selection["repositoryRef"]) || names.has(fullName)) fail("invalid-input");
    refs.add(selection["repositoryRef"]);
    names.add(fullName);
  }
  return value as unknown as Configuration;
}
