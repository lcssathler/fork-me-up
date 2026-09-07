import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  nodeLocalProfileStorePort,
  runOwnerProfileOperation,
  saveOwnerDerivation,
  refreshLocalRepositories,
  writeLocalProfileStore,
} from "@fork-me-up/community-provider";
import { ownerFixture, saveRequest } from "../helpers/owner-profile-fixture.mjs";
import { refreshRequest, refreshValue } from "../helpers/incremental-refresh-fixture.mjs";

test("owner edits preserve the original Claim/Evidence and append same-second correction history", async (context) => {
  const fixture = await ownerFixture(context);
  for (const [index, operation] of /** @type {const} */ ([
    "correct",
    "dispute",
    "reject",
  ]).entries()) {
    const result = await fixture.correct(operation, index);
    assert.ok(result.ok && result.status === "saved");
    assert.doesNotMatch(JSON.stringify(result), /CANARY|main.ts|SOURCE|directoryPath/u);
  }
  const saved = await fixture.load();
  assert.equal(saved.profile.corrections.length, 3);
  assert.deepEqual(
    saved.profile.corrections.map((item) => item.kind),
    ["adjustment", "adjustment", "rejection"],
  );
  const effective = saved.profile.claims.find((item) => item.claimId === fixture.claimId);
  assert.equal(effective?.state, "disputed");
  assert.equal(effective?.basis.correctionRef, saved.profile.corrections[2]?.correctionId);
  const original = saved.profile.claims.find(
    (item) => item.claimId === saved.profile.corrections[0]?.targetClaimRef,
  );
  assert.equal(original?.state, fixture.initial.profile.claims[0]?.state);
  assert.equal(original?.observedDepth, fixture.initial.profile.claims[0]?.observedDepth);
  assert.ok(original?.basis.evidenceRefs.every((id) => id.startsWith("owner_evidence_")));
  assert.equal(Object.isFrozen(saved.profile.corrections), true);
});

test("inspection returns minimized structured provenance and history without owner notes or source paths", async (context) => {
  const fixture = await ownerFixture(context);
  await fixture.correct("reject", 0);
  for (const claimId of [null, fixture.claimId]) {
    const result = await runOwnerProfileOperation(
      fixture.configuration,
      JSON.stringify({ version: "0.1.0", operation: "inspect", claimId }),
    );
    assert.ok(result.ok && result.status === "inspected" && result.generation === 1);
    assert.doesNotMatch(
      JSON.stringify(result),
      /CANARY|main.ts|extra.ts|sourceRelativeRef|directoryPath/u,
    );
    assert.equal(Object.isFrozen(result), true);
  }
  assert.equal(
    (
      await runOwnerProfileOperation(
        fixture.configuration,
        JSON.stringify({ version: "0.1.0", operation: "inspect", claimId: "missing" }),
      )
    ).ok,
    false,
  );
});

test("refresh and source removal retain corrected scope and immutable historical fingerprints", async (context) => {
  const fixture = await ownerFixture(context);
  await fixture.correct("reject", 0);
  const corrected = await fixture.load();
  const history = corrected.profile.evidence.filter((item) =>
    item.evidenceId.startsWith("owner_evidence_"),
  );
  await writeFile(path.join(fixture.a, "main.ts"), "export const CHANGED_SOURCE = 3;\n");
  const next = refreshValue(
    await refreshLocalRepositories(fixture.session, refreshRequest("2026-09-07T12:00:02Z")),
  ).derivation;
  assert.ok(next);
  assert.equal(
    (await saveOwnerDerivation(fixture.configuration, next, saveRequest(1, "2026-09-07T12:00:02Z")))
      .ok,
    true,
  );
  await unlink(path.join(fixture.a, "main.ts"));
  await unlink(path.join(fixture.a, "extra.ts"));
  const removed = refreshValue(
    await refreshLocalRepositories(fixture.session, refreshRequest("2026-09-07T12:00:03Z")),
  ).derivation;
  assert.ok(removed);
  assert.equal(
    (
      await saveOwnerDerivation(
        fixture.configuration,
        removed,
        saveRequest(2, "2026-09-07T12:00:03Z"),
      )
    ).ok,
    true,
  );
  const saved = await fixture.load();
  assert.deepEqual(saved.profile.corrections, corrected.profile.corrections);
  assert.deepEqual(
    saved.profile.evidence.filter((item) => item.evidenceId.startsWith("owner_evidence_")),
    history,
  );
  assert.equal(
    saved.profile.claims.find((item) => item.claimId === fixture.claimId)?.state,
    "disputed",
  );
  assert.equal(
    saved.profile.claims.find((item) => item.claimId === fixture.claimId)?.freshness.stale,
    true,
  );
});

test("an old authentic derivation cannot roll back a newer persisted observation", async (context) => {
  const fixture = await ownerFixture(context);
  await writeFile(path.join(fixture.b, "main.ts"), "export const NEWER = 123;\n");
  const newer = refreshValue(
    await refreshLocalRepositories(fixture.session, refreshRequest("2026-09-07T12:00:03Z")),
  ).derivation;
  assert.ok(newer);
  assert.equal(
    (
      await saveOwnerDerivation(
        fixture.configuration,
        newer,
        saveRequest(0, "2026-09-07T12:00:03Z"),
      )
    ).ok,
    true,
  );
  assert.equal(
    (
      await saveOwnerDerivation(
        fixture.configuration,
        fixture.derived,
        saveRequest(1, "2026-09-07T12:00:04Z"),
      )
    ).ok,
    false,
  );
  assert.equal((await fixture.load()).internalState.generation, 1);
});

test("correction cannot predate target observation or edit the preserved historical target", async (context) => {
  const fixture = await ownerFixture(context);
  const source = {
    ...fixture.initial,
    internalState: { ...fixture.initial.internalState, generation: 1 },
    profile: {
      ...fixture.initial.profile,
      claims: fixture.initial.profile.claims.map((item) => ({
        ...item,
        freshness: { ...item.freshness, observedThrough: "2026-09-07T13:00:00Z" },
      })),
    },
  };
  assert.equal(
    (
      await writeLocalProfileStore(fixture.configuration, JSON.stringify(source), {
        expectedGeneration: 0,
      })
    ).ok,
    true,
  );
  assert.equal((await fixture.correct("reject", 1)).ok, false);
  const request = {
    version: "0.1.0",
    operation: "correct",
    claimId: fixture.claimId,
    expectedGeneration: 1,
    at: "2026-09-07T13:00:01Z",
    summary: "note",
  };
  assert.equal(
    (await runOwnerProfileOperation(fixture.configuration, JSON.stringify(request))).ok,
    true,
  );
  const archived = (await fixture.load()).profile.corrections[0]?.targetClaimRef;
  assert.equal(
    (
      await runOwnerProfileOperation(
        fixture.configuration,
        JSON.stringify({ ...request, expectedGeneration: 2, claimId: archived }),
      )
    ).ok,
    false,
  );
});

test("declarations remain unobserved assertions and survive refresh without promotion", async (context) => {
  const fixture = await ownerFixture(context);
  const result = await runOwnerProfileOperation(
    fixture.configuration,
    JSON.stringify({
      version: "0.1.0",
      operation: "declare",
      capability: "language.rust",
      projectRef: null,
      summary: "DECLARATION_CANARY",
      expectedGeneration: 0,
      at: "2026-09-07T12:00:01Z",
    }),
  );
  assert.equal(result.ok, true);
  const profile = (await fixture.load()).profile;
  const declared = profile.claims.find((item) => item.state === "self-declared");
  assert.ok(declared);
  assert.equal(declared.observedDepth, null);
  assert.equal(declared.freshness.observedThrough, null);
  assert.deepEqual(declared.basis.evidenceRefs, []);
  assert.equal(
    (
      await runOwnerProfileOperation(
        fixture.configuration,
        JSON.stringify({
          version: "0.1.0",
          operation: "reject",
          claimId: declared.claimId,
          summary: "note",
          expectedGeneration: 1,
          at: "2026-09-07T12:00:02Z",
        }),
      )
    ).ok,
    false,
  );
  const refreshed = refreshValue(
    await refreshLocalRepositories(fixture.session, refreshRequest("2026-09-07T12:00:03Z")),
  ).derivation;
  assert.ok(refreshed);
  assert.equal(
    (
      await saveOwnerDerivation(
        fixture.configuration,
        refreshed,
        saveRequest(1, "2026-09-07T12:00:03Z"),
      )
    ).ok,
    true,
  );
  assert.deepEqual((await fixture.load()).profile.declarations, profile.declarations);
});

test("owner requests reject forged authority, unknown fields, invalid times, targets, notes and generations", async (context) => {
  const fixture = await ownerFixture(context);
  const request = {
    version: "0.1.0",
    operation: "correct",
    claimId: fixture.claimId,
    summary: "note",
    expectedGeneration: 0,
    at: "2026-09-07T12:00:01Z",
  };
  for (const patch of [
    { version: "1.0.0" },
    { extra: "CANARY" },
    { operation: "delete" },
    { expectedGeneration: -1 },
    { expectedGeneration: 1 },
    { at: "2026-02-30T00:00:00Z" },
    { at: "2026-09-07T11:00:00Z" },
    { summary: "\u0000CANARY" },
    { summary: "x".repeat(257) },
    { claimId: "missing" },
  ]) {
    const result = await runOwnerProfileOperation(
      fixture.configuration,
      JSON.stringify({ ...request, ...patch }),
    );
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /CANARY|stack|directoryPath/u);
  }
  for (const text of ["{", "x".repeat(32769), JSON.stringify({ ...request, summary: "\ud800" })])
    assert.equal((await runOwnerProfileOperation(fixture.configuration, text)).ok, false);
  assert.equal(
    (await runOwnerProfileOperation({ ...fixture.configuration }, JSON.stringify(request))).ok,
    false,
  );
  assert.equal(
    (await saveOwnerDerivation(fixture.configuration, { ...fixture.derived }, saveRequest(0))).ok,
    false,
  );
  assert.equal((await fixture.load()).internalState.generation, 0);
});

test("interrupted staging and failed final read never acknowledge owner success", async (context) => {
  const fixture = await ownerFixture(context);
  const failed = await fixture.correct("reject", 0, {
    port: {
      ...nodeLocalProfileStorePort,
      async writeEntryExclusive() {
        throw new Error("WRITE_CANARY");
      },
    },
  });
  assert.equal(failed.ok, false);
  assert.equal((await fixture.load()).internalState.generation, 0);
  let linked = false;
  const unknown = await fixture.correct("reject", 0, {
    port: {
      ...nodeLocalProfileStorePort,
      async linkEntryExclusive(...args) {
        const result = await nodeLocalProfileStorePort.linkEntryExclusive(...args);
        linked = result === "linked";
        return result;
      },
      async readEntry(...args) {
        if (linked && args[1].endsWith("g-1.json")) throw new Error("READ_CANARY");
        return nodeLocalProfileStorePort.readEntry(...args);
      },
    },
  });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.error.category, "commit-outcome-unknown");
  assert.doesNotMatch(JSON.stringify([failed, unknown]), /CANARY/u);
  assert.equal((await fixture.load()).profile.corrections.length, 1);
});

test("concurrent corrections cannot overwrite each other and recovery uses next unused generation", async (context) => {
  const fixture = await ownerFixture(context);
  const results = await Promise.all([fixture.correct("reject", 0), fixture.correct("correct", 0)]);
  assert.equal(results.filter((item) => item.ok).length, 1);
  await writeFile(path.join(fixture.store.directoryPath, "community-profile-store.g-5.json"), "{");
  const result = await fixture.correct("dispute", 1);
  assert.ok(result.ok && result.generation === 6 && result.recovered);
  assert.equal((await fixture.load()).profile.corrections.length, 2);
});

test("history exhaustion rejects the entire mutation without pruning corrections", async (context) => {
  const fixture = await ownerFixture(context);
  await fixture.correct("correct", 0);
  const saved = await fixture.load();
  const correction = saved.profile.corrections[0];
  assert.ok(correction);
  const full = {
    ...saved,
    profile: {
      ...saved.profile,
      corrections: Array.from({ length: 256 }, (_, index) => ({
        ...correction,
        correctionId: index === 0 ? correction.correctionId : `correction_${index}`,
      })),
    },
    internalState: { ...saved.internalState, generation: 2 },
  };
  assert.equal(
    (
      await writeLocalProfileStore(fixture.configuration, JSON.stringify(full), {
        expectedGeneration: 1,
      })
    ).ok,
    true,
  );
  assert.equal((await fixture.correct("reject", 2)).ok, false);
  assert.equal((await fixture.load()).profile.corrections.length, 256);
  assert.equal((await fixture.load()).internalState.generation, 2);
});

test("owner service has no model, network, source reads, arbitrary subprocess or logging authority", async () => {
  const source = await readFile(
    new URL("../../packages/community-provider/src/owner-profile-workflow.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /node:(?:fs|http|https|net|child_process)|fetch\(|console\.|eval\(|spawn\(/u,
  );
});
