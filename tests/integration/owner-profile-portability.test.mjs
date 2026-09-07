import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  deleteLocalProfileStore,
  runOwnerPortabilityOperation,
} from "@fork-me-up/community-provider";
import { portabilityFixture, deleteRequest } from "../helpers/owner-portability-fixture.mjs";

test("owner CLI exports, imports and deletes Store plus isolated adapter cache across real processes", async (context) => {
  const fixture = await portabilityFixture(context);
  const temporary = path.join(fixture.root, "cli-temporary");
  const cache = path.join(temporary, "fork-me-up-codex-adapter-v1");
  await mkdir(cache, { recursive: true });
  await writeFile(path.join(cache, `${"a".repeat(64)}.json`), "ADAPTER_CACHE_CANARY");
  /** @param {unknown} store @param {unknown} request */
  function invoke(store, request) {
    return spawnSync(process.execPath, ["scripts/owner-profile.mjs"], {
      input: JSON.stringify({ store, request }),
      encoding: "utf8",
      shell: false,
      timeout: 10000,
      maxBuffer: 300000,
      env: { ...process.env, TEMP: temporary, TMP: temporary, TMPDIR: temporary },
    });
  }
  const exported = invoke(fixture.store, fixture.exportRequest);
  assert.equal(exported.status, 0, exported.stderr);
  const exportedValue = JSON.parse(exported.stdout);
  const portableText = await readFile(
    path.join(fixture.destination, exportedValue.fileName),
    "utf8",
  );
  assert.doesNotMatch(portableText, /CANARY|main.ts|extra.ts/u);
  const destination = await fixture.destinationStore();
  const imported = invoke(destination.store, {
    version: "0.1.0",
    operation: "import",
    at: "2026-09-07T12:00:04Z",
    portableProfile: JSON.parse(portableText),
  });
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(JSON.parse(imported.stdout).status, "imported");
  const deleted = invoke(destination.store, JSON.parse(deleteRequest));
  assert.equal(deleted.status, 0, deleted.stderr);
  assert.equal(JSON.parse(deleted.stdout).status, "deleted");
  assert.deepEqual(await readdir(destination.store.directoryPath), [
    ".community-profile-store.deleted",
  ]);
  assert.deepEqual(await readdir(cache), [".deleted"]);
  const denied = invoke(destination.store, {
    version: "0.1.0",
    operation: "inspect",
    claimId: null,
  });
  assert.equal(denied.status, 1);
  for (const result of [exported, imported, deleted, denied]) {
    assert.equal(result.stderr, "");
    assert.doesNotMatch(result.stdout, /CANARY|directoryPath|sourceRelativeRef/u);
  }
  assert.equal(
    await readFile(path.join(fixture.destination, exportedValue.fileName), "utf8"),
    portableText,
  );
  assert.match(await readFile(path.join(fixture.a, "main.ts"), "utf8"), /SOURCE_CANARY/u);
});

test("Store deletion rejects a linked reserved file and preserves its external target", async (context) => {
  const fixture = await portabilityFixture(context);
  const outside = path.join(fixture.root, "outside.txt");
  await writeFile(outside, "OUTSIDE_CANARY");
  const redirected = path.join(
    fixture.store.directoryPath,
    ".community-profile-store.g-9.linked.tmp",
  );
  // Directory junctions are available without symlink privilege on supported Windows hosts.
  await symlink(fixture.a, redirected, process.platform === "win32" ? "junction" : "dir");
  const result = await deleteLocalProfileStore(fixture.configuration);
  assert.equal(result.ok, false);
  assert.equal(await readFile(outside, "utf8"), "OUTSIDE_CANARY");
  assert.equal((await fixture.load()).internalState.generation, 1);
  assert.match(await readFile(path.join(redirected, "main.ts"), "utf8"), /SOURCE_CANARY/u);
});

test("explicit export destination rejects replacement after canonical authorization", async (context) => {
  const fixture = await portabilityFixture(context);
  const { nodeLocalProfileStorePort } = await import("@fork-me-up/community-provider");
  const result = await runOwnerPortabilityOperation(
    fixture.configuration,
    JSON.stringify(fixture.exportRequest),
    {
      port: {
        ...nodeLocalProfileStorePort,
        async inspectDirectory(directory, platform) {
          const inspected = await nodeLocalProfileStorePort.inspectDirectory(directory, platform);
          return directory === fixture.destination
            ? { ...inspected, kind: "symbolic-link" }
            : inspected;
        },
      },
    },
  );
  assert.equal(result.ok, false);
  assert.deepEqual(await readdir(fixture.destination), []);
});
