import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  clearFileCodexSessionState,
  createFileCodexSessionState,
} from "../../adapters/codex/src/index.ts";

const scope = { scope: /** @type {const} */ ("all-adapter-cache") };
const key = createHash("sha256").update("synthetic-session").digest("hex");
const guidance = {
  cacheVersion: /** @type {const} */ (1),
  expiresAt: "2026-09-07T12:30:00Z",
  claims: [],
  responsePolicy: {
    mode: /** @type {const} */ ("teach-while-doing"),
    explainPurposeBeforeCommands: true,
    includeExpectedResult: true,
    includeRiskAndRollback: true,
    analogyCapabilities: [],
    questionBudget: /** @type {const} */ (1),
  },
};
/** @param {import('node:test').TestContext} context */
async function fixture(context) {
  const canonicalTemporaryRoot = await realpath(tmpdir());
  const parent = await realpath(await mkdtemp(join(canonicalTemporaryRoot, "fmu-codex-deletion-")));
  context.after(async () => {
    const target = resolve(parent);
    assert.ok(
      target.startsWith(resolve(canonicalTemporaryRoot) + "\\") ||
        target.startsWith(resolve(canonicalTemporaryRoot) + "/"),
    );
    assert.match(target, /fmu-codex-deletion-[^\\/]+$/u);
    await rm(target, { recursive: true, force: true });
  });
  const root = join(parent, "cache");
  return { parent, root, state: createFileCodexSessionState({ root }) };
}

test("adapter deletion clears recognized payloads and orphan staging while retaining unknown files and a durable barrier", async (context) => {
  const { root, state } = await fixture(context);
  await state.save("synthetic-session", guidance);
  assert.deepEqual(await state.load("synthetic-session"), guidance);
  await writeFile(
    join(root, `${key}.json.123.12345678-1234-1234-1234-123456789abc.tmp`),
    "CACHE_CANARY",
  );
  await writeFile(join(root, "source.ts"), "SOURCE_CANARY");
  const deleted = await clearFileCodexSessionState(scope, { root });
  assert.deepEqual(deleted, { ok: true, status: "deleted", removedEntries: 2 });
  assert.doesNotMatch(JSON.stringify(deleted), /CANARY|source.ts|cache\\|cache\//u);
  assert.deepEqual((await readdir(root)).sort(), [".deleted", "source.ts"]);
  assert.equal(await readFile(join(root, "source.ts"), "utf8"), "SOURCE_CANARY");
  assert.equal(await state.load("synthetic-session"), null);
  await assert.rejects(state.save("synthetic-session", guidance), /not-authorized/u);
  await state.clear("synthetic-session");
  assert.equal((await clearFileCodexSessionState(scope, { root })).ok, true);
  await assert.rejects(createFileCodexSessionState({ root }).save("another-session", guidance));
});

test("adapter deletion honors an occupied mutation gate without breaking it or deleting payloads", async (context) => {
  const { root, state } = await fixture(context);
  await state.save("synthetic-session", guidance);
  await writeFile(join(root, ".mutation.lock"), "");
  const result = await clearFileCodexSessionState(scope, { root });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.category, "conflict");
  await assert.rejects(state.save("synthetic-session", guidance), /conflict/u);
  await assert.rejects(state.clear("synthetic-session"), /conflict/u);
  assert.ok((await readdir(root)).includes(`${key}.json`));
  assert.ok((await readdir(root)).includes(".mutation.lock"));
  await unlink(join(root, ".mutation.lock"));
  assert.equal((await clearFileCodexSessionState(scope, { root })).ok, true);
});

test("adapter deletion rejects redirected roots and recognized directory entries without touching targets", async (context) => {
  const { root, parent, state } = await fixture(context);
  await state.save("synthetic-session", guidance);
  const redirected = join(parent, "redirected");
  await symlink(root, redirected, process.platform === "win32" ? "junction" : "dir");
  const rejected = await clearFileCodexSessionState(scope, { root: redirected });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.error.category, "not-authorized");
  assert.ok((await readdir(root)).includes(`${key}.json`));
  const bad = `${"b".repeat(64)}.json`;
  await mkdir(join(root, bad));
  const blocked = await clearFileCodexSessionState(scope, { root });
  assert.equal(blocked.ok, false);
  assert.ok((await readdir(root)).includes(".deleted"));
  assert.ok((await readdir(root)).includes(`${key}.json`));
  await assert.rejects(state.save("new-session", guidance));
});

test("adapter deletion is bounded and resumes after an owner resolves excess unknown entries", async (context) => {
  const { root, state } = await fixture(context);
  await state.save("synthetic-session", guidance);
  const names = Array.from({ length: 256 }, (_, index) => `unknown-${index}`);
  await Promise.all(names.map((name) => writeFile(join(root, name), "")));
  const result = await clearFileCodexSessionState(scope, { root });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.category, "deletion-incomplete");
  assert.ok((await readdir(root)).includes(".deleted"));
  await Promise.all(names.map((name) => unlink(join(root, name))));
  assert.equal((await clearFileCodexSessionState(scope, { root })).ok, true);
});

test("adapter cleanup rejects a recognized junction entry without traversing or removing its target", async (context) => {
  const { root, parent, state } = await fixture(context);
  await state.save("synthetic-session", guidance);
  const source = join(parent, "source");
  await mkdir(source);
  await writeFile(join(source, "keep.ts"), "SOURCE_CANARY");
  await symlink(
    source,
    join(root, `${"c".repeat(64)}.json`),
    process.platform === "win32" ? "junction" : "dir",
  );
  const result = await clearFileCodexSessionState(scope, { root });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.category, "not-authorized");
  assert.equal(await readFile(join(source, "keep.ts"), "utf8"), "SOURCE_CANARY");
  assert.ok((await readdir(root)).includes(`${key}.json`));
});

test("racing adapter save and deletion cannot resurrect a deleted cache", async (context) => {
  const { root, state } = await fixture(context);
  await state.save("synthetic-session", guidance);
  const [saved, deleted] = await Promise.allSettled([
    state.save("synthetic-session", guidance),
    clearFileCodexSessionState(scope, { root }),
  ]);
  assert.equal(deleted.status, "fulfilled");
  if (deleted.status !== "fulfilled") return;
  if (!deleted.value.ok) {
    assert.equal(deleted.value.error.category, "conflict");
    assert.equal(saved.status, "fulfilled");
    assert.equal((await clearFileCodexSessionState(scope, { root })).ok, true);
  }
  assert.equal(await state.load("synthetic-session"), null);
  assert.deepEqual(await readdir(root), [".deleted"]);
});

test("adapter cleanup requires explicit all-cache scope and rejects invalid roots", async (context) => {
  const { root } = await fixture(context);
  for (const request of [{}, { scope: "one" }, { ...scope, extra: "CANARY" }]) {
    const result = await clearFileCodexSessionState(/** @type {never} */ (request), { root });
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /CANARY/u);
  }
  assert.equal((await clearFileCodexSessionState(scope, { root: "../CANARY" })).ok, false);
  assert.equal((await clearFileCodexSessionState(scope, { root })).ok, true);
});

test("default adapter cache canonicalizes a redirected temporary parent", async (context) => {
  const { parent } = await fixture(context);
  const actualTemporary = join(parent, "actual-temporary");
  const aliasTemporary = join(parent, "temporary-alias");
  await mkdir(actualTemporary);
  await symlink(actualTemporary, aliasTemporary, process.platform === "win32" ? "junction" : "dir");
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import assert from "node:assert/strict";
    import { createFileCodexSessionState, clearFileCodexSessionState } from "./adapters/codex/src/index.ts";
    const state = createFileCodexSessionState();
    await state.save("synthetic-session", ${JSON.stringify(guidance)});
    assert.equal((await state.load("synthetic-session")).cacheVersion, 1);
    assert.equal((await clearFileCodexSessionState({ scope: "all-adapter-cache" })).ok, true);
  `,
    ],
    {
      encoding: "utf8",
      shell: false,
      timeout: 10_000,
      maxBuffer: 32_768,
      env: { ...process.env, TEMP: aliasTemporary, TMP: aliasTemporary, TMPDIR: aliasTemporary },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await readdir(join(actualTemporary, "fork-me-up-codex-adapter-v1")), [
    ".deleted",
  ]);
});
