import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import test from "node:test";
import { inspectFileCodexSessionState } from "../../adapters/codex/src/index.ts";

const at = "2026-09-07T12:00:00Z";
const guidance = {
  cacheVersion: 1,
  expiresAt: "2026-09-07T12:30:00Z",
  claims: [],
  responsePolicy: {
    mode: "teach-while-doing",
    explainPurposeBeforeCommands: true,
    includeExpectedResult: true,
    includeRiskAndRollback: true,
    analogyCapabilities: [],
    questionBudget: 1,
  },
};
/** @param {string} value */
const nameFor = (value) => `${createHash("sha256").update(value).digest("hex")}.json`;
/** @param {import('node:test').TestContext} context */
async function fixture(context) {
  const temporary = await realpath(tmpdir());
  const parent = await realpath(await mkdtemp(join(temporary, "fmu-cache-doctor-")));
  context.after(async () => {
    assert.ok(resolve(parent).startsWith(resolve(temporary) + sep));
    assert.match(parent, /fmu-cache-doctor-[^\\/]+$/u);
    await rm(parent, { recursive: true, force: true });
  });
  const root = join(parent, "cache");
  return { parent, root };
}

test("adapter diagnostics do not create an absent cache root and reject malformed requests", async (context) => {
  const { root, parent } = await fixture(context);
  assert.deepEqual(await inspectFileCodexSessionState({ at }, { root }), {
    status: "absent",
    entries: 0,
    fresh: 0,
    stale: 0,
  });
  assert.deepEqual(await readdir(parent), []);
  for (const request of [{}, { at: "2026-02-30T12:00:00Z" }, { at, extra: "FMU_SECRET_CANARY" }]) {
    const result = await inspectFileCodexSessionState(/** @type {never} */ (request), { root });
    assert.equal(result.status, "invalid");
    assert.doesNotMatch(JSON.stringify(result), /CANARY/u);
  }
  assert.equal(
    (await inspectFileCodexSessionState({ at }, { root: "../CANARY" })).status,
    "invalid",
  );
  assert.deepEqual(await readdir(parent), []);
});

test("adapter diagnostics count fresh and expired validated caches without changing contents, modes or directory metadata", async (context) => {
  const { root } = await fixture(context);
  await mkdir(root);
  const fresh = nameFor("private-fresh");
  const stale = nameFor("private-stale");
  await writeFile(join(root, fresh), JSON.stringify(guidance));
  await writeFile(join(root, stale), JSON.stringify({ ...guidance, expiresAt: at }));
  await writeFile(join(root, "unknown.txt"), "FMU_PRIVATE_CANARY");
  const before = await lstat(root, { bigint: true });
  const files = await Promise.all(
    [fresh, stale, "unknown.txt"].map((name) => readFile(join(root, name))),
  );
  const result = await inspectFileCodexSessionState({ at }, { root });
  assert.deepEqual(result, { status: "ready", entries: 2, fresh: 1, stale: 1 });
  assert.equal(Object.isFrozen(result), true);
  assert.doesNotMatch(JSON.stringify(result), /CANARY|private|json|cache/u);
  const after = await lstat(root, { bigint: true });
  assert.deepEqual(
    [after.mode, after.mtimeNs, after.ctimeNs],
    [before.mode, before.mtimeNs, before.ctimeNs],
  );
  assert.deepEqual(
    await Promise.all([fresh, stale, "unknown.txt"].map((name) => readFile(join(root, name)))),
    files,
  );
  assert.deepEqual((await readdir(root)).sort(), [fresh, stale, "unknown.txt"].sort());
});

test("adapter diagnostics distinguish busy, deleted and incomplete-deletion states without cleanup", async (context) => {
  const { root } = await fixture(context);
  await mkdir(root);
  await writeFile(join(root, ".mutation.lock"), "");
  await writeFile(join(root, ".deleted"), "");
  assert.equal((await inspectFileCodexSessionState({ at }, { root })).status, "busy");
  const { unlink } = await import("node:fs/promises");
  await unlink(join(root, ".mutation.lock"));
  assert.equal((await inspectFileCodexSessionState({ at }, { root })).status, "deleted");
  await writeFile(join(root, nameFor("remaining")), JSON.stringify(guidance));
  assert.equal((await inspectFileCodexSessionState({ at }, { root })).status, "invalid");
  assert.equal((await readdir(root)).length, 2);
});

test("adapter diagnostics reject malformed, unknown-field, invalid UTF-8 and oversized cache entries without echoing payloads", async (context) => {
  const { root } = await fixture(context);
  await mkdir(root);
  for (const [source, status] of /** @type {Array<[string | Buffer, string]>} */ ([
    ["{FMU_PRIVATE_CANARY", "invalid"],
    [JSON.stringify({ ...guidance, extra: "FMU_PRIVATE_CANARY" }), "invalid"],
    [Buffer.from([0xc3, 0x28]), "invalid"],
    ["x".repeat(8193), "limit-exceeded"],
  ])) {
    await writeFile(join(root, nameFor("invalid")), source);
    const result = await inspectFileCodexSessionState({ at }, { root });
    assert.equal(result.status, status);
    assert.deepEqual([result.entries, result.fresh, result.stale], [0, 0, 0]);
    assert.doesNotMatch(JSON.stringify(result), /CANARY|invalid\.json/u);
  }
});

test("adapter diagnostics reject cache and root junctions without following their contents", async (context) => {
  const { root, parent } = await fixture(context);
  await mkdir(root);
  await writeFile(join(root, nameFor("inside")), JSON.stringify(guidance));
  const linked = join(parent, "linked");
  await symlink(root, linked, process.platform === "win32" ? "junction" : "dir");
  assert.equal((await inspectFileCodexSessionState({ at }, { root: linked })).status, "invalid");
  const outside = join(parent, "outside");
  await mkdir(outside);
  await writeFile(join(outside, "source.ts"), "SOURCE_CANARY");
  await symlink(
    outside,
    join(root, nameFor("junction")),
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.equal((await inspectFileCodexSessionState({ at }, { root })).status, "invalid");
  assert.equal(await readFile(join(outside, "source.ts"), "utf8"), "SOURCE_CANARY");
});

test("adapter diagnostics accept the exact 2 MiB cache ceiling without writes", async (context) => {
  const { root } = await fixture(context);
  await mkdir(root);
  const source = JSON.stringify(guidance).padEnd(8192, " ");
  await Promise.all(
    Array.from({ length: 256 }, (_, index) =>
      writeFile(join(root, nameFor(String(index))), source),
    ),
  );
  assert.deepEqual(await inspectFileCodexSessionState({ at }, { root }), {
    status: "ready",
    entries: 256,
    fresh: 256,
    stale: 0,
  });
  assert.equal((await readdir(root)).length, 256);
});

test("adapter diagnostics bound all enumerated entries and treat orphan staging as invalid", async (context) => {
  const { root } = await fixture(context);
  await mkdir(root);
  const staging = `${nameFor("staging")}.123.12345678-1234-1234-1234-123456789abc.tmp`;
  await writeFile(join(root, staging), "FMU_PRIVATE_CANARY");
  assert.equal((await inspectFileCodexSessionState({ at }, { root })).status, "invalid");
  await Promise.all(
    Array.from({ length: 256 }, (_, index) => writeFile(join(root, `unknown-${index}`), "")),
  );
  assert.equal((await inspectFileCodexSessionState({ at }, { root })).status, "limit-exceeded");
  assert.equal((await readdir(root)).length, 257);
});
