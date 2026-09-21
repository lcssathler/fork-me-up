import assert from "node:assert/strict";
import test from "node:test";
import { catalogFixture } from "../tests/helpers/source-catalog-fixture.mjs";
import { catalogHash } from "../packages/community-provider/src/source-catalog-store.ts";

test("FMU-E-021 selective persistent reuse keeps adjacent candidates bounded and never becomes expertise", async (context) => {
  const f = await catalogFixture(context);
  const source = f.config.sources[0];
  assert.ok(source);
  f.config.sources = [
    { ...source, sourceRef: "unrelated", languages: ["ruby"] },
    { ...source, sourceRef: "adjacent", languages: ["javascript"] },
    { ...source, sourceRef: "direct", languages: ["typescript"] },
  ];
  f.config.limits.candidates = 2;
  f.config.limits.collections = 2;
  const first = await f.run();
  assert.ok(first.ok);
  if (!first.ok) return;
  assert.deepEqual(
    first.sources.map((source) => source.key),
    [catalogHash("direct"), catalogHash("adjacent")],
  );
  assert.equal(first.counts.unexamined, 1);
  assert.equal(first.counts.collections, 2);
  const second = await f.run();
  assert.ok(second.ok);
  if (!second.ok) return;
  assert.equal(second.counts.cacheHits, 2);
  assert.equal(second.counts.collections, 0);
  assert.deepEqual(
    second.sources.map((source) => source.observedAt),
    first.sources.map((source) => source.observedAt),
  );
  assert.doesNotMatch(
    JSON.stringify(second),
    /CANARY|demonstrated|claims|responsePolicy|owner@example/u,
  );
  assert.ok((await f.run("delete")).ok);
  assert.equal((await f.run()).ok, false);
});
