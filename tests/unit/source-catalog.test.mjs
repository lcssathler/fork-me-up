import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { runSourceCatalog } from "@fork-me-up/community-provider";
import { catalogFixture } from "../helpers/source-catalog-fixture.mjs";
import { currentTime, objectBase, head } from "../helpers/selected-github-fixture.mjs";

test("catalog persists minimized observations and revalidates restart hits without renewing age", async (context) => {
  const f = await catalogFixture(context);
  const first = await f.run();
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.counts.collections, 1);
  assert.equal(first.counts.failures, 0);
  f.github.calls.length = 0;
  const second = await f.run();
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.counts.collections, 0);
  assert.equal(second.counts.cacheHits, 1);
  assert.equal(second.sources[0]?.observedAt, first.sources[0]?.observedAt);
  assert.ok(f.github.calls.every((value) => !/blobs|trees|\/git\/commits\//u.test(value)));
  for (const entry of await readdir(f.directory))
    assert.doesNotMatch(
      await readFile(path.join(f.directory, entry), "utf8"),
      /CANARY|example-owner|src\/|owner@example|main\.ts|source_remote/u,
    );
});

test("changed revision and expired grant prevent cache reuse", async (context) => {
  const f = await catalogFixture(context);
  await f.run();
  f.github.replies[`${objectBase}/git/ref/heads/main`] = {
    ref: "refs/heads/main",
    object: { sha: "d".repeat(40), type: "commit" },
  };
  const changed = await f.run();
  assert.equal(changed.ok, true);
  if (changed.ok) {
    assert.equal(changed.counts.cacheHits, 0);
    assert.equal(changed.counts.failures, 1);
    assert.equal(changed.counts.records, 0);
  }
  f.github.replies[`${objectBase}/git/ref/heads/main`] = {
    ref: "refs/heads/main",
    object: { sha: head, type: "commit" },
  };
  await f.run();
  const json = JSON.stringify(f.config);
  f.github.calls.length = 0;
  const expired = await runSourceCatalog(
    json,
    { operation: "select", languages: ["typescript"], refresh: false },
    {
      readAuthority: async () => json,
      githubPort: f.github.port,
      clock: () => currentTime + 86400000,
    },
  );
  assert.equal(expired.ok, true);
  if (expired.ok) {
    assert.equal(expired.counts.cacheHits, 0);
    assert.equal(expired.counts.records, 0);
  }
  assert.equal(f.github.calls.length, 0);
});

test("identity and authority changes invalidate persisted observations", async (context) => {
  const f = await catalogFixture(context);
  await f.run();
  assert.ok(f.config.identity.identities[0]);
  f.config.identity.identities[0].email = "changed@example.test";
  const changed = await f.run();
  assert.equal(changed.ok, true);
  if (changed.ok) assert.equal(changed.counts.cacheHits, 0);
  const source = f.config.sources[0];
  assert.ok(source);
  const repository = source.configuration.repositories[0];
  assert.ok(repository);
  repository.content = false;
  const narrower = await f.run();
  assert.equal(narrower.ok, true);
  if (narrower.ok) assert.equal(narrower.counts.cacheHits, 0);
});

test("catalog revocation during revalidation aborts without saved acknowledgment", async (context) => {
  const f = await catalogFixture(context);
  await f.run();
  f.github.calls.length = 0;
  const json = JSON.stringify(f.config);
  const result = await runSourceCatalog(
    json,
    { operation: "select", languages: ["typescript"], refresh: false },
    {
      readAuthority: async () => (f.github.calls.length > 0 ? null : json),
      githubPort: f.github.port,
      clock: () => currentTime,
    },
  );
  assert.equal(result.ok, false);
  assert.equal("saved" in result && result.saved, false);
});

test("catalog covers at most the configured batch and exposes incomplete selection", async (context) => {
  const f = await catalogFixture(context);
  const source = f.config.sources[0];
  assert.ok(source);
  f.config.sources = Array.from({ length: 10 }, (_, index) => ({
    ...source,
    sourceRef: `candidate_${index}`,
  }));
  Object.assign(f.config.limits, { collections: 1, candidates: 2 });
  const result = await f.run();
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.counts.selected, 2);
    assert.equal(result.counts.unexamined, 8);
    assert.equal(result.counts.collections, 1);
    assert.equal(result.counts.failures, 1);
  }
});

test("cache export is minimized and deletion blocks subsequent restart reuse", async (context) => {
  const f = await catalogFixture(context);
  await f.run();
  const exported = await f.run("export");
  assert.equal(exported.ok, true);
  assert.doesNotMatch(
    JSON.stringify(exported),
    /CANARY|owner@example|example-source|source_remote/u,
  );
  await writeFile(path.join(f.directory, "keep.txt"), "keep");
  assert.equal((await f.run("delete")).ok, true);
  assert.equal((await f.run()).ok, false);
  assert.deepEqual((await readdir(f.directory)).sort(), [".catalog.deleted", "keep.txt"]);
  assert.equal((await f.run("delete")).ok, true);
});

test("invalid catalog configuration and source/storage overlap fail before mutation", async (context) => {
  const f = await catalogFixture(context);
  for (const config of [
    { ...f.config, token: "SECRET_CANARY" },
    { ...f.config, limits: { ...f.config.limits, candidates: 9 } },
    {
      ...f.config,
      directory: f.local,
      sources: [
        {
          sourceRef: "local",
          kind: "local",
          languages: ["typescript"],
          configuration: f.localConfig,
        },
      ],
    },
  ]) {
    const json = JSON.stringify(config);
    const result = await runSourceCatalog(
      json,
      { operation: "select", languages: ["typescript"], refresh: false },
      { readAuthority: async () => json, githubPort: f.github.port, clock: () => currentTime },
    );
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /CANARY|owner@example/u);
  }
  assert.deepEqual(await readdir(f.directory), []);
});
