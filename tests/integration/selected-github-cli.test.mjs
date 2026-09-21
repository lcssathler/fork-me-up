import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import test from "node:test";
import { createLocalCommunityRuntime } from "@fork-me-up/community-provider";
import { communityFixture, ownerRefresh } from "../helpers/local-community-fixture.mjs";
import { readConfiguration } from "../../scripts/read-owner-configuration.mjs";
import { selectedConfig } from "../helpers/selected-github-fixture.mjs";

test("offline Community refresh never invokes the optional HTTPS transport", async (context) => {
  let requests = 0;
  context.mock.method(https, "request", () => {
    requests++;
    throw new Error("unexpected-network");
  });
  syncBuiltinESMExports();
  context.after(() => {
    context.mock.restoreAll();
    syncBuiltinESMExports();
  });
  const fixture = await communityFixture(context);
  const runtime = await createLocalCommunityRuntime(JSON.stringify(fixture.config), {
    clock: () => new Date("2026-09-07T12:00:10Z"),
  });
  assert.equal(runtime.ok, true);
  if (!runtime.ok) return;
  const result = await runtime.value.run(JSON.stringify(ownerRefresh(null, 0)));
  assert.equal(/** @type {{ok:boolean}} */ (result).ok, true);
  assert.equal(requests, 0);
});

test("owner CLI fails closed before network for absent, malformed, oversized and expired authority", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "fmu-selected-cli-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const configPath = path.join(directory, "owner.json");
  for (const content of [
    "SECRET_CANARY",
    " ".repeat(131073),
    JSON.stringify({
      ...selectedConfig(),
      issuedAt: "2000-01-01T00:00:00.000Z",
      expiresAt: "2000-01-01T01:00:00.000Z",
    }),
  ]) {
    await writeFile(configPath, content);
    const result = spawnSync(
      process.execPath,
      ["scripts/github-source.mjs", "--config", configPath, "--operation", "collect"],
      {
        encoding: "utf8",
        timeout: 10000,
        maxBuffer: 32768,
        env: { ...process.env, GH_TOKEN: "UNUSED_CANARY" },
      },
    );
    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    assert.equal(JSON.parse(result.stdout).ok, false);
    assert.doesNotMatch(result.stdout, /CANARY|owner\.json|fmu-selected-cli/u);
  }
  await rm(configPath);
  await assert.rejects(readConfiguration(configPath));
  await mkdir(configPath);
  await assert.rejects(readConfiguration(configPath));
});

test("owner authority reader observes changed and removed grants without caching", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "fmu-authority-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const configPath = path.join(directory, "owner.json");
  const first = JSON.stringify(selectedConfig());
  await writeFile(configPath, first);
  assert.equal(await readConfiguration(configPath), first);
  await writeFile(configPath, "{}");
  assert.equal(await readConfiguration(configPath), "{}");
  await rm(configPath);
  await assert.rejects(readConfiguration(configPath));
});
