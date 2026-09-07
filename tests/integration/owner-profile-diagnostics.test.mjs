import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { ownerFixture } from "../helpers/owner-profile-fixture.mjs";

const doctor = {
  version: "0.1.0",
  operation: "doctor",
  at: "2026-09-07T12:00:02Z",
  packet: null,
  maxContextBytes: 32768,
  maxContextTokens: 8192,
};
/** @param {unknown} input @param {string} temporary @param {string} [script] */
function invoke(input, temporary, script = "scripts/owner-profile.mjs") {
  return spawnSync(process.execPath, [script], {
    input: JSON.stringify(input),
    encoding: "utf8",
    shell: false,
    timeout: 10000,
    maxBuffer: 65536,
    env: { ...process.env, TEMP: temporary, TMP: temporary, TMPDIR: temporary },
  });
}

test("owner CLI diagnoses actual installed modules, Store schema and isolated cache without modifying data", async (context) => {
  const fixture = await ownerFixture(context);
  const temporary = path.join(fixture.root, "temporary");
  const cache = path.join(temporary, "fork-me-up-codex-adapter-v1");
  await mkdir(cache, { recursive: true });
  await writeFile(path.join(cache, `${"a".repeat(64)}.json`), "CACHE_CANARY");
  const names = await readdir(fixture.store.directoryPath);
  const before = await Promise.all(
    names.map((name) => readFile(path.join(fixture.store.directoryPath, name))),
  );
  const result = invoke({ store: fixture.store, request: doctor }, temporary);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const value = JSON.parse(result.stdout);
  assert.equal(value.view.installation.modules, "available");
  assert.equal(value.view.installation.runtime, "supported");
  assert.equal(value.view.store.schema, "valid");
  assert.equal(value.view.adapter.cache.status, "invalid");
  assert.doesNotMatch(
    result.stdout,
    /CANARY|subject_synthetic|directoryPath|sourceRelativeRef|main.ts/u,
  );
  assert.deepEqual(await readdir(fixture.store.directoryPath), names);
  assert.deepEqual(
    await Promise.all(names.map((name) => readFile(path.join(fixture.store.directoryPath, name)))),
    before,
  );
  assert.equal(await readFile(path.join(cache, `${"a".repeat(64)}.json`), "utf8"), "CACHE_CANARY");
});

test("owner CLI bounds evidence results and missing-store diagnostics without creating cache roots", async (context) => {
  const fixture = await ownerFixture(context);
  const temporary = path.join(fixture.root, "empty-temporary");
  await mkdir(temporary);
  const firstClaim = fixture.initial.profile.claims[0];
  assert.ok(firstClaim);
  const result = invoke(
    {
      store: fixture.store,
      request: {
        version: "0.1.0",
        operation: "get-capability-evidence",
        capability: firstClaim.capability,
        limit: 1,
      },
    },
    temporary,
  );
  assert.equal(result.status, 0, result.stdout);
  assert.equal(JSON.parse(result.stdout).view.claims.length, 1);
  assert.doesNotMatch(result.stdout, /CANARY|main.ts|sourceRelativeRef/u);
  const diagnosed = invoke({ store: null, request: doctor }, temporary);
  assert.equal(diagnosed.status, 0, diagnosed.stderr);
  assert.equal(JSON.parse(diagnosed.stdout).view.store.state, "not-configured");
  assert.equal(JSON.parse(diagnosed.stdout).view.adapter.cache.status, "absent");
  assert.deepEqual(await readdir(temporary), []);
  const oversized = invoke(
    { store: fixture.store, request: { ...doctor, packet: "x".repeat(65536) } },
    temporary,
  );
  assert.equal(oversized.status, 1);
  assert.doesNotMatch(oversized.stdout, /CANARY|xxx/u);
});

test("an uninstalled owner CLI reports dependency failure without import stacks or personal paths", async (context) => {
  const fixture = await ownerFixture(context);
  const script = path.join(fixture.root, "owner-profile.mjs");
  await copyFile("scripts/owner-profile.mjs", script);
  const result = invoke({ store: null, request: doctor }, fixture.root, script);
  assert.equal(result.status, 1);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: false,
    error: { category: "installation-unavailable", retryable: false },
  });
});
