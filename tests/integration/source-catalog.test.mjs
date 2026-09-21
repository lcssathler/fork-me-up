import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, rename, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  runSourceCatalog,
  resolveLocalProfileStoreConfig,
  runOwnerProfileOperation,
} from "@fork-me-up/community-provider";
import { catalogFixture } from "../helpers/source-catalog-fixture.mjs";
import { currentTime } from "../helpers/selected-github-fixture.mjs";

test("real local catalog survives process restart and invalidates uncommitted same-size edits", async (context) => {
  const f = await catalogFixture(context);
  const config = {
    ...f.config,
    sources: [
      {
        sourceRef: "source_local",
        kind: "local",
        languages: ["typescript"],
        configuration: f.localConfig,
      },
    ],
  };
  const configPath = path.join(f.root, "config.json");
  await writeFile(configPath, JSON.stringify(config));
  function cli(operation = "select") {
    const result = spawnSync(
      process.execPath,
      [
        "scripts/source-catalog.mjs",
        "--config",
        configPath,
        "--operation",
        operation,
        "--languages",
        "typescript",
        ...(operation === "delete" ? ["--confirm-delete-catalog"] : []),
      ],
      { encoding: "utf8", windowsHide: true, timeout: 20000 },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return JSON.parse(result.stdout);
  }
  const first = cli();
  assert.equal(first.counts.collections, 1);
  assert.equal(first.counts.failures, 0);
  const second = cli();
  assert.equal(second.counts.cacheHits, 1);
  assert.equal(second.counts.collections, 0);
  const file = path.join(f.local, "main.ts");
  const before = await stat(file);
  await writeFile(file, (await readFile(file, "utf8")).replace("value = 1", "value = 2"));
  await utimes(file, before.atime, before.mtime);
  const changed = cli();
  assert.equal(changed.counts.cacheHits, 0);
  assert.equal(changed.counts.collections, 1);
  await rename(f.local, path.join(f.root, "moved-source"));
  assert.equal(cli("delete").status, "deleted");
});

test("profile-first selection honors owner declaration and leaves Store byte-identical", async (context) => {
  const f = await catalogFixture(context);
  const directoryPath = path.join(f.root, "profile");
  await mkdir(directoryPath);
  const profile = {
    configVersion: "0.1.0",
    directoryPath,
    subjectRef: f.config.subjectRef,
    storeId: "store_catalog",
  };
  const resolved = await resolveLocalProfileStoreConfig(JSON.stringify(profile));
  assert.ok(resolved.ok);
  if (!resolved.ok) return;
  const declaration = await runOwnerProfileOperation(
    resolved.value,
    JSON.stringify({
      version: "0.1.0",
      operation: "declare",
      capability: "language.typescript",
      projectRef: null,
      summary: "OWNER_DECLARATION_CANARY",
      expectedGeneration: null,
      at: new Date(currentTime).toISOString().replace(".000Z", "Z"),
    }),
  );
  assert.ok(declaration.ok);
  const snapshot = async () =>
    Promise.all(
      (await readdir(directoryPath))
        .sort()
        .map(async (name) => [
          name,
          (await readFile(path.join(directoryPath, name))).toString("hex"),
        ]),
    );
  const before = await snapshot();
  const json = JSON.stringify({ ...f.config, profile });
  const result = await runSourceCatalog(
    json,
    { operation: "select", languages: ["typescript"], refresh: false },
    { readAuthority: async () => json, githubPort: f.github.port, clock: () => currentTime },
  );
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.profile, "available");
  assert.equal(result.profileCoverage, 1);
  assert.equal(result.counts.selected, 0);
  assert.equal(f.github.calls.length, 0);
  assert.deepEqual(await snapshot(), before);
  assert.doesNotMatch(JSON.stringify(result), /CANARY/u);
  await rename(directoryPath, path.join(f.root, "moved-profile"));
  const deleted = await runSourceCatalog(
    json,
    { operation: "delete", languages: [], refresh: false },
    { readAuthority: async () => json, clock: () => currentTime },
  );
  assert.ok(deleted.ok);
});
