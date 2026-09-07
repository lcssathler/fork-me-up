import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";
import test from "node:test";
import { ownerFixture } from "../helpers/owner-profile-fixture.mjs";

/** @param {string | Buffer} input @param {string[]} [args] */
function invoke(input, args = []) {
  return spawnSync(process.execPath, ["scripts/owner-profile.mjs", ...args], {
    input,
    encoding: "utf8",
    shell: false,
    timeout: 10_000,
    maxBuffer: 300_000,
  });
}

test("owner CLI inspects and corrects a real Store across process restarts without LLM or source output", async (context) => {
  const fixture = await ownerFixture(context);
  const inspect = { version: "0.1.0", operation: "inspect", claimId: fixture.claimId };
  const before = invoke(JSON.stringify({ store: fixture.store, request: inspect }));
  assert.equal(before.status, 0, before.stderr);
  assert.equal(JSON.parse(before.stdout).generation, 0);
  const request = {
    version: "0.1.0",
    operation: "reject",
    claimId: fixture.claimId,
    expectedGeneration: 0,
    at: "2026-09-07T12:00:01Z",
    summary: "CLI_PRIVATE_NOTE_CANARY",
  };
  const saved = invoke(JSON.stringify({ store: fixture.store, request }));
  assert.equal(saved.status, 0, saved.stderr);
  assert.equal(JSON.parse(saved.stdout).status, "saved");
  const after = invoke(JSON.stringify({ store: fixture.store, request: inspect }));
  assert.equal(after.status, 0, after.stderr);
  assert.equal(JSON.parse(after.stdout).view[0].state, "disputed");
  const repeated = invoke(JSON.stringify({ store: fixture.store, request }));
  assert.equal(repeated.status, 1);
  assert.equal(JSON.parse(repeated.stdout).error.category, "conflict");
  for (const result of [before, saved, after, repeated]) {
    assert.equal(result.stderr, "");
    assert.doesNotMatch(result.stdout, /CANARY|main.ts|extra.ts|directoryPath|sourceRelativeRef/u);
  }
  assert.equal((await fixture.load()).profile.corrections[0]?.summary, "CLI_PRIVATE_NOTE_CANARY");
});

test("owner CLI rejects oversized, malformed, invalid UTF-8 and authority-bearing extra input", () => {
  for (const input of [
    "{PRIVATE_CANARY",
    "x".repeat(32769),
    Buffer.from([0xc3, 0x28]),
    JSON.stringify({ store: {}, request: {}, extra: "PRIVATE_CANARY" }),
    JSON.stringify({ store: { directoryPath: "../../PRIVATE_CANARY" }, request: {} }),
  ]) {
    const result = invoke(input);
    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    assert.equal(JSON.parse(result.stdout).ok, false);
    assert.doesNotMatch(result.stdout, /CANARY|stack|directoryPath/u);
  }
  const args = invoke("", ["PRIVATE_CANARY"]);
  assert.equal(args.status, 1);
  assert.doesNotMatch(args.stdout + args.stderr, /CANARY/u);
});

test("owner CLI can inspect an absent Store and persist an explicit declaration", async (context) => {
  const fixture = await ownerFixture(context);
  const { mkdir } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const store = { ...fixture.store, directoryPath: join(fixture.root, "empty-store") };
  await mkdir(store.directoryPath);
  const absent = invoke(
    JSON.stringify({ store, request: { version: "0.1.0", operation: "inspect", claimId: null } }),
  );
  assert.equal(JSON.parse(absent.stdout).status, "absent");
  const saved = invoke(
    JSON.stringify({
      store,
      request: {
        version: "0.1.0",
        operation: "declare",
        capability: "language.rust",
        projectRef: null,
        summary: "OWNER_DECLARATION_CANARY",
        expectedGeneration: null,
        at: "2026-09-07T12:00:00Z",
      },
    }),
  );
  assert.equal(saved.status, 0, saved.stderr);
  assert.equal(JSON.parse(saved.stdout).generation, 0);
  assert.doesNotMatch(saved.stdout, /CANARY/u);
});
