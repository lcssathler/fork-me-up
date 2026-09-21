import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { isDeveloperContextPacket } from "@fork-me-up/protocol";
import {
  communityFixture,
  communityTask,
  ownerRefresh,
} from "../tests/helpers/local-community-fixture.mjs";

/** @param {Awaited<ReturnType<typeof communityFixture>>} fixture @param {unknown[]} requests @param {'owner'|'mcp'} mode */
function launch(fixture, requests, mode) {
  const processResult = spawnSync(
    process.execPath,
    [
      "--import",
      pathToFileURL(fixture.clockPath).href,
      "scripts/community.mjs",
      "--config",
      fixture.configPath,
      "--mode",
      mode,
    ],
    {
      input: requests.map((request) => JSON.stringify(request)).join("\n") + "\n",
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 1048576,
      env: {
        ...process.env,
        TEMP: fixture.temporary,
        TMP: fixture.temporary,
        TMPDIR: fixture.temporary,
      },
    },
  );
  assert.equal(processResult.error, undefined);
  assert.equal(processResult.stderr, "");
  assert.doesNotMatch(
    processResult.stdout,
    /CANARY|Unit Person|unit@example|sourceRelativeRef|directoryPath/u,
  );
  return {
    code: processResult.status,
    results: processResult.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line)),
  };
}

function handshake() {
  return [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "synthetic-guided-pilot", version: "0.1.0" },
      },
    },
    { jsonrpc: "2.0", method: "notifications/initialized" },
  ];
}

test("FMU-E-019 synthetic: guided owner edits survive restart and are consumed only through read-only MCP", async (context) => {
  const fixture = await communityFixture(context);
  const setup = launch(
    fixture,
    [ownerRefresh(null, 0), { version: "0.1.0", operation: "inspect", claimId: null }],
    "owner",
  );
  assert.equal(setup.code, 0);
  assert.equal(setup.results[0].status, "refreshed");
  assert.equal(setup.results[0].work.networkRequests, 0);
  const target = setup.results[1].view.find(
    (/** @type {any} */ item) => item.projectRef === "project_a",
  );
  assert.ok(target);
  const edits = launch(
    fixture,
    [
      {
        version: "0.1.0",
        operation: "reject",
        claimId: target.claimId,
        expectedGeneration: 0,
        at: "2026-09-07T12:00:01Z",
        summary: "OWNER_NOTE_CANARY",
      },
      {
        version: "0.1.0",
        operation: "declare",
        capability: "language.rust",
        projectRef: null,
        expectedGeneration: 1,
        at: "2026-09-07T12:00:02Z",
        summary: "OWNER_NOTE_CANARY",
      },
    ],
    "owner",
  );
  assert.equal(edits.code, 0);
  assert.deepEqual(
    edits.results.map((result) => result.status),
    ["saved", "saved"],
  );
  const conflict = launch(
    fixture,
    [
      {
        version: "0.1.0",
        operation: "reject",
        claimId: target.claimId,
        expectedGeneration: 0,
        at: "2026-09-07T12:00:03Z",
        summary: "OWNER_NOTE_CANARY",
      },
    ],
    "owner",
  );
  assert.equal(conflict.code, 1);
  assert.equal(conflict.results[0].ok, false);
  const refreshed = launch(fixture, [ownerRefresh(2, 4)], "owner");
  assert.equal(refreshed.code, 0);
  assert.equal(refreshed.results[0].status, "refreshed");
  const request = {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "get_task_context",
      arguments: {
        ...communityTask.input,
        requestedCapabilities: ["language.typescript", "language.rust"],
      },
    },
  };
  for (let restart = 0; restart < 2; restart += 1) {
    const served = launch(
      fixture,
      [
        ...handshake(),
        request,
        { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "declare", arguments: {} } },
        { jsonrpc: "2.0", id: 5, method: "ping" },
      ],
      "mcp",
    );
    assert.equal(served.code, 0);
    const packet = served.results[1].result.structuredContent.data;
    assert.ok(isDeveloperContextPacket(packet));
    assert.equal(
      packet.claims.find((/** @type {any} */ c) => c.capability === "language.typescript").state,
      "disputed",
    );
    assert.equal(
      packet.claims.find((/** @type {any} */ c) => c.capability === "language.rust").state,
      "self-declared",
    );
    assert.equal(served.results[2].error.code, -32602);
    assert.deepEqual(served.results[3].result, {});
  }
});

test("FMU-E-019 synthetic: absent profile returns unavailable without preventing the next MCP request", async (context) => {
  const fixture = await communityFixture(context);
  const result = launch(
    fixture,
    [
      ...handshake(),
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "get_task_context", arguments: communityTask.input },
      },
      { jsonrpc: "2.0", id: 3, method: "ping" },
    ],
    "mcp",
  );
  assert.equal(result.code, 0);
  assert.equal(result.results[1].result.isError, true);
  assert.equal(result.results[1].result.structuredContent.outcome, "error");
  assert.deepEqual(result.results[2].result, {});
});
