import assert from "node:assert/strict";
import { readFile, readdir, writeFile, symlink } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { runSourceCatalog } from "@fork-me-up/community-provider";
import { catalogFixture } from "../helpers/source-catalog-fixture.mjs";
import { currentTime } from "../helpers/selected-github-fixture.mjs";

test("catalog rejects linked storage and cannot activate after a deletion barrier", async (context) => {
  const f = await catalogFixture(context);
  const linked = path.join(f.root, "linked");
  await symlink(f.directory, linked, process.platform === "win32" ? "junction" : "dir");
  const linkedJson = JSON.stringify({ ...f.config, directory: linked });
  const denied = await runSourceCatalog(
    linkedJson,
    { operation: "select", languages: ["typescript"], refresh: false },
    { readAuthority: async () => linkedJson, githubPort: f.github.port, clock: () => currentTime },
  );
  assert.equal(denied.ok, false);
  await f.run();
  const json = JSON.stringify(f.config);
  const interrupted = await runSourceCatalog(
    json,
    { operation: "select", languages: ["typescript"], refresh: false },
    {
      readAuthority: async () => json,
      githubPort: f.github.port,
      clock: () => currentTime,
      beforeActivate: async () => {
        await writeFile(path.join(f.directory, ".catalog.deleted"), "{}");
      },
    },
  );
  assert.equal(interrupted.ok, false);
  assert.ok(!(await readdir(f.directory)).includes("catalog.g-1.json"));
  assert.equal((await f.run()).ok, false);
  assert.ok((await f.run("delete")).ok);
  assert.deepEqual(await readdir(f.directory), [".catalog.deleted"]);
});

test("age expiring during activation never returns a successful cache hit", async (context) => {
  const f = await catalogFixture(context);
  await f.run();
  const json = JSON.stringify(f.config);
  let now = currentTime + 299000;
  const result = await runSourceCatalog(
    json,
    { operation: "select", languages: ["typescript"], refresh: false },
    {
      readAuthority: async () => json,
      clock: () => now,
      githubPort: f.github.port,
      beforeActivate: async () => {
        now = currentTime + 301000;
      },
    },
  );
  assert.equal(result.ok, false);
  assert.doesNotMatch(JSON.stringify(result), /persistent-cache/u);
});

test("disconnect and authority changes remove records from every recovery generation even on export", async (context) => {
  const f = await catalogFixture(context);
  await f.run();
  await f.run();
  f.config.sources = [];
  const result = await f.run("export");
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.inventory, []);
  assert.deepEqual(await readdir(f.directory), []);
});

test("corrupt or schema-poisoned cache recovers with live revalidation", async (context) => {
  const f = await catalogFixture(context);
  await f.run();
  await f.run();
  const newest = path.join(f.directory, "catalog.g-1.json");
  await writeFile(newest, "{CORRUPT_CANARY");
  const result = await f.run();
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.recovered, true);
    assert.equal(result.counts.cacheHits, 1);
  }
  for (const name of await readdir(f.directory)) {
    const file = path.join(f.directory, name);
    const body = JSON.parse(await readFile(file, "utf8"));
    body.version = "9.0.0";
    await writeFile(file, JSON.stringify(body));
  }
  const poisoned = await f.run();
  assert.ok(poisoned.ok);
  if (poisoned.ok) {
    assert.equal(poisoned.counts.cacheHits, 0);
    assert.equal(poisoned.counts.collections, 1);
  }
});

test("interrupted activation preserves committed generation and cleans staging on restart", async (context) => {
  const f = await catalogFixture(context);
  await f.run();
  const original = await readFile(path.join(f.directory, "catalog.g-0.json"));
  const json = JSON.stringify(f.config);
  const interrupted = await runSourceCatalog(
    json,
    { operation: "select", languages: ["typescript"], refresh: false },
    {
      readAuthority: async () => json,
      githubPort: f.github.port,
      clock: () => currentTime,
      beforeActivate: async () => {
        throw new Error("INTERRUPT_CANARY");
      },
    },
  );
  assert.equal(interrupted.ok, false);
  assert.deepEqual(await readFile(path.join(f.directory, "catalog.g-0.json")), original);
  const recovered = await f.run();
  assert.ok(recovered.ok);
  if (recovered.ok) assert.equal(recovered.counts.cacheHits, 1);
  assert.ok((await readdir(f.directory)).every((name) => /^catalog\.g-\d+\.json$/u.test(name)));
  await writeFile(path.join(f.directory, ".catalog.lock"), "{}");
  assert.equal((await f.run()).ok, false);
});

test("cache age is checked after a slow probe without renewing observation time", async (context) => {
  const f = await catalogFixture(context);
  await f.run();
  const json = JSON.stringify(f.config);
  let now = currentTime + 299000;
  const result = await runSourceCatalog(
    json,
    { operation: "select", languages: ["typescript"], refresh: false },
    {
      readAuthority: async () => json,
      clock: () => now,
      githubPort: {
        async get(input) {
          now = currentTime + 301000;
          return f.github.port.get(input);
        },
      },
    },
  );
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.counts.cacheHits, 0);
    assert.equal(result.counts.collections, 1);
  }
});

test("remote aggregate budget stops collection and reports omitted coverage", async (context) => {
  const f = await catalogFixture(context);
  f.config.limits.requests = 2;
  const result = await f.run();
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.counts.requests, 2);
    assert.equal(result.counts.failures, 1);
    assert.equal(result.counts.records, 0);
  }
});
