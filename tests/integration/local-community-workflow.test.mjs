import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, readdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { isDeveloperContextPacket, isPortableProfileExport } from "@fork-me-up/protocol";
import {
  communityFixture,
  ownerRefresh,
  communityTask,
} from "../helpers/local-community-fixture.mjs";

/** @param {Awaited<ReturnType<typeof communityFixture>>} fixture @param {unknown[]} requests @param {'owner'|'mcp'} [mode] @param {string} [configuration] */
function invoke(fixture, requests, mode = "owner", configuration = fixture.configPath) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      pathToFileURL(fixture.clockPath).href,
      "scripts/community.mjs",
      "--config",
      configuration,
      "--mode",
      mode,
    ],
    {
      input: requests.map((request) => JSON.stringify(request)).join("\n") + "\n",
      encoding: "utf8",
      shell: false,
      timeout: 30000,
      maxBuffer: 2097152,
      env: {
        ...process.env,
        TEMP: fixture.temporary,
        TMP: fixture.temporary,
        TMPDIR: fixture.temporary,
      },
    },
  );
}
/** @param {ReturnType<typeof invoke>} result */
function values(result) {
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(result.stderr, "");
  assert.doesNotMatch(
    result.stdout,
    /SOURCE_CANARY|OTHER_CANARY|MESSAGE_CANARY|OWNER_NOTE_CANARY|TASK_CANARY|Unit Person|unit@example|directoryPath|sourceRelativeRef/u,
  );
  return result.stdout
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

test("complete local CLI and MCP workflow collects, reuses cache, corrects, refreshes, diagnoses, exports and deletes", async (context) => {
  const fixture = await communityFixture(context);
  const first = values(
    invoke(fixture, [
      ownerRefresh(null, 0),
      ownerRefresh(0, 1),
      { version: "0.1.0", operation: "inspect", claimId: null },
    ]),
  );
  assert.equal(first[0].status, "refreshed");
  assert.equal(first[0].work.collections, 2);
  assert.equal(first[1].work.collections, 0);
  assert.ok(
    first[1].repositories.every((/** @type {any} */ item) => item.origin === "memory-cache"),
  );
  const claim = first[2].view.find((/** @type {any} */ item) => item.projectRef === "project_a");
  assert.ok(claim);
  const corrected = values(
    invoke(fixture, [
      {
        version: "0.1.0",
        operation: "reject",
        claimId: claim.claimId,
        expectedGeneration: 1,
        at: "2026-09-07T12:00:02Z",
        summary: "OWNER_NOTE_CANARY",
      },
    ]),
  );
  assert.equal(corrected[0].status, "saved");
  await writeFile(path.join(fixture.a, "main.ts"), "export const SOURCE_CANARY = 9;\n");
  const next = values(
    invoke(fixture, [
      ownerRefresh(2, 3),
      { version: "0.1.0", operation: "provider", request: communityTask },
    ]),
  );
  const packet = next[1].response.data;
  assert.ok(isDeveloperContextPacket(packet));
  assert.equal(packet.claims.length, 1);
  assert.equal(packet.claims[0]?.state, "disputed");
  const rpc = values(
    invoke(
      fixture,
      [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-11-25",
            capabilities: {},
            clientInfo: { name: "synthetic-consumer", version: "0.1.0" },
          },
        },
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "get_task_context", arguments: communityTask.input },
        },
      ],
      "mcp",
    ),
  );
  assert.deepEqual(rpc[1].result.tools.map((/** @type {any} */ tool) => tool.name).sort(), [
    "get_profile_metadata",
    "get_task_context",
  ]);
  const served = rpc[2].result.structuredContent;
  assert.ok(isDeveloperContextPacket(served.data));
  assert.equal(served.data.claims[0].state, "disputed");
  const final = values(
    invoke(fixture, [
      {
        version: "0.1.0",
        operation: "doctor",
        at: "2026-09-07T12:00:10Z",
        packet,
        maxContextBytes: 32768,
        maxContextTokens: 8192,
      },
      {
        version: "0.1.0",
        operation: "export",
        at: "2026-09-07T12:00:11Z",
        expectedGeneration: 3,
        exportId: "export_workflow",
        destinationDirectory: fixture.exports,
      },
      {
        version: "0.1.0",
        operation: "delete",
        confirm: "delete-local-profile",
        cacheScope: "all-local-adapter-caches",
      },
    ]),
  );
  assert.equal(final[0].view.context.state, "within-budget");
  assert.equal(final[1].status, "exported");
  const exported = JSON.parse(
    await readFile(path.join(fixture.exports, final[1].fileName), "utf8"),
  );
  assert.ok(isPortableProfileExport(exported));
  assert.equal(final[2].status, "deleted");
  assert.deepEqual(await readdir(fixture.store), [".community-profile-store.deleted"]);
  assert.match(await readFile(path.join(fixture.a, "main.ts"), "utf8"), /SOURCE_CANARY/u);
  assert.equal(
    invoke(fixture, [{ version: "0.1.0", operation: "provider", request: communityTask }]).status,
    1,
  );
});

test("community launcher rejects oversized, malformed and redirected configuration without writes or diagnostics content", async (context) => {
  const fixture = await communityFixture(context);
  const invalid = path.join(fixture.root, "invalid.json");
  for (const source of [
    "{CONFIG_CANARY",
    "x".repeat(131073),
    JSON.stringify({ ...fixture.config, authority: "CONFIG_CANARY" }),
    JSON.stringify({
      ...fixture.config,
      identity: { ...fixture.config.identity, subjectRef: "other" },
    }),
  ]) {
    await writeFile(invalid, source);
    const result = invoke(fixture, [], "owner", invalid);
    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    assert.doesNotMatch(result.stdout, /CANARY|invalid.json|stack|directoryPath/u);
    assert.deepEqual(await readdir(fixture.store), []);
  }
  const linked = path.join(fixture.root, "linked.json");
  await symlink(fixture.a, linked, process.platform === "win32" ? "junction" : "dir");
  assert.equal(invoke(fixture, [], "owner", linked).status, 1);
});
