import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { communityFixture, ownerRefresh } from "../helpers/local-community-fixture.mjs";

/** @param {Awaited<ReturnType<typeof communityFixture>>} fixture @param {unknown[]} requests @param {"owner" | "mcp"} [mode] */
function invoke(fixture, requests, mode = "owner") {
  const result = spawnSync(
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
      timeout: 30_000,
      maxBuffer: 300_000,
    },
  );
  assert.equal(result.stderr, "");
  assert.doesNotMatch(
    result.stdout,
    /SOURCE_CANARY|OTHER_CANARY|MESSAGE_CANARY|directoryPath|sourceRelativeRef/u,
  );
  return result;
}

test("owner interpretation survives process restart as a fresh read without persisting proposals or widening MCP", async (context) => {
  const fixture = await communityFixture(context);
  assert.equal(invoke(fixture, [ownerRefresh(null, 0)]).status, 0);
  const request = {
    version: "0.1.0",
    operation: "view",
    disclosure: {
      mode: "existing-agent",
      approved: true,
      approvedAt: "2026-09-07T12:00:00Z",
      expiresAt: "2026-09-07T12:05:00Z",
    },
    targetProjectRef: "project_new",
    sourceProjectRefs: ["project_a"],
    capabilities: ["language.typescript"],
  };
  const before = await storeFiles(fixture.store);
  const viewRun = invoke(fixture, [request]);
  assert.equal(viewRun.status, 0, viewRun.stdout);
  const view = JSON.parse(viewRun.stdout);
  assert.equal(view.status, "view");
  assert.equal(view.view.claims.length, 1);
  const claim = view.view.claims[0];
  const proposal = {
    ...request,
    operation: "admit",
    expectedGeneration: view.generation,
    viewId: view.viewId,
    proposals: [
      {
        kind: "transfer",
        capability: "concept.new-tool",
        sourceClaimId: claim.claimId,
        evidenceRefs: claim.evidenceRefs,
        relation: "similar-workflow",
        transferLimit: "different-runtime",
      },
    ],
  };
  const admittedRun = invoke(fixture, [proposal]);
  assert.equal(admittedRun.status, 0, admittedRun.stdout);
  const admitted = JSON.parse(admittedRun.stdout);
  assert.equal(admitted.proposals[0].status, "provisional-owner-review");
  assert.equal(admitted.proposals[0].sourceProjectRef, "project_a");
  assert.deepEqual(await storeFiles(fixture.store), before);
  // Model-facing MCP has no interpretation operation.
  const mcp = invoke(fixture, [{ jsonrpc: "2.0", id: 1, method: "tools/list" }], "mcp");
  assert.equal(mcp.status, 0);
  assert.doesNotMatch(mcp.stdout, /owner.interpretation|"name":"view"|"name":"admit"/u);
});

/** @param {string} directory */
async function storeFiles(directory) {
  return Promise.all(
    (await readdir(directory))
      .sort()
      .map(async (name) => [name, await readFile(path.join(directory, name))]),
  );
}
