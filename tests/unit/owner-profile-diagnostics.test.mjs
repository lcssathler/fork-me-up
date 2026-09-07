import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  runOwnerDiagnostics,
  nodeLocalProfileStorePort,
  deleteLocalProfileStore,
  writeLocalProfileStore,
} from "@fork-me-up/community-provider";
import { isProfileProviderResponse } from "@fork-me-up/protocol";
import { ownerFixture } from "../helpers/owner-profile-fixture.mjs";

const doctor = {
  version: "0.1.0",
  operation: "doctor",
  at: "2026-09-07T12:00:02Z",
  packet: null,
  maxContextBytes: 32768,
  maxContextTokens: 8192,
};
const evidence = {
  version: "0.1.0",
  operation: "get-capability-evidence",
  capability: "language.typescript",
  limit: 8,
};
/** @param {unknown} configuration @param {unknown} request @param {import('@fork-me-up/community-provider').OwnerDiagnosticsOptions} [options] */
const invoke = (configuration, request, options) =>
  runOwnerDiagnostics(/** @type {never} */ (configuration), JSON.stringify(request), options);

test("owner evidence lookup preserves typed history, limits and validated metadata without private text", async (context) => {
  const fixture = await ownerFixture(context);
  assert.ok((await fixture.correct("reject", 0)).ok);
  const firstClaim = fixture.initial.profile.claims[0];
  assert.ok(firstClaim);
  const capability = firstClaim.capability;
  const result = await invoke(fixture.configuration, { ...evidence, capability });
  assert.ok(result.ok && result.status === "evidence", JSON.stringify(result));
  if (!result.ok) return;
  const view = /** @type {any} */ (result.view);
  assert.ok(view.claims.some((/** @type {any} */ claim) => claim.state === "disputed"));
  assert.ok(view.claims.some((/** @type {any} */ claim) => claim.historical));
  for (const claim of view.claims) {
    assert.ok(
      isProfileProviderResponse({
        schemaVersion: "0.1.0",
        kind: "profile-provider-response",
        requestId: "test",
        operation: "get-capability-evidence",
        outcome: "success",
        error: null,
        data: claim.evidence,
      }),
    );
    assert.ok(claim.evidence.evidence.length <= 8);
  }
  assert.doesNotMatch(
    JSON.stringify(result),
    /CANARY|main.ts|directoryPath|sourceRelativeRef|subject_synthetic|OWNER_NOTE/u,
  );
  assert.ok(Object.isFrozen(result.view));
  const limited = await invoke(fixture.configuration, { ...evidence, capability, limit: 1 });
  assert.ok(limited.ok);
  if (limited.ok) {
    const limitedView = /** @type {any} */ (limited.view);
    assert.equal(limitedView.claims.length, 1);
    assert.equal(limitedView.truncated, true);
  }
  const absent = await invoke(fixture.configuration, {
    ...evidence,
    capability: "language.nonexistent",
  });
  assert.ok(absent.ok);
  if (absent.ok) assert.equal(/** @type {any} */ (absent.view).totalClaims, 0);
});

test("diagnostic requests reject forged authority, malformed versions/shapes/selectors and bounds", async (context) => {
  const fixture = await ownerFixture(context);
  for (const request of [
    {},
    { ...doctor, version: "1.0.0" },
    { ...doctor, source: "CANARY" },
    { ...doctor, at: "invalid" },
    { ...doctor, maxContextTokens: 8193 },
    { ...evidence, limit: 9 },
    { ...evidence, capability: "C:/Users/CANARY" },
  ]) {
    assert.equal((await invoke(fixture.configuration, request)).ok, false);
  }
  assert.equal((await invoke({ ...fixture.configuration }, doctor)).ok, false);
  assert.equal((await invoke(null, evidence)).ok, false);
  assert.equal((await runOwnerDiagnostics(fixture.configuration, "x".repeat(65537))).ok, false);
  assert.equal((await runOwnerDiagnostics(fixture.configuration, "\ud800")).ok, false);
});

test("doctor reads actual Store state without mutation or exposing injected cache errors", async (context) => {
  const fixture = await ownerFixture(context);
  const names = await readdir(fixture.store.directoryPath);
  const before = await Promise.all(
    names.map((name) => readFile(path.join(fixture.store.directoryPath, name))),
  );
  let mutations = 0;
  const denied = async () => {
    mutations += 1;
    throw new Error("MUTATION_CANARY");
  };
  const result = await invoke(fixture.configuration, doctor, {
    port: {
      ...nodeLocalProfileStorePort,
      writeEntryExclusive: denied,
      linkEntryExclusive: denied,
      removeEntry: denied,
      syncDirectory: denied,
    },
    inspectAdapterCache: async () => {
      throw new Error("C:/Users/CANARY private token");
    },
  });
  assert.ok(result.ok);
  if (!result.ok) return;
  const view = /** @type {any} */ (result.view);
  assert.equal(view.store.state, "active");
  assert.equal(view.store.schema, "valid");
  assert.equal(view.installation.modules, "not-checked");
  assert.equal(view.adapter.cache.status, "unavailable");
  assert.equal(mutations, 0);
  assert.deepEqual(await readdir(fixture.store.directoryPath), names);
  assert.deepEqual(
    await Promise.all(names.map((name) => readFile(path.join(fixture.store.directoryPath, name)))),
    before,
  );
  assert.doesNotMatch(
    JSON.stringify(result),
    /CANARY|sourceRelativeRef|directoryPath|subject_synthetic/u,
  );
});

test("doctor validates cache probe results and reports independent component states", async () => {
  for (const status of ["absent", "deleted", "busy", "invalid", "unavailable", "limit-exceeded"]) {
    const result = await invoke(null, doctor, {
      inspectAdapterCache: async () => ({ status, entries: 0, fresh: 0, stale: 0 }),
    });
    assert.ok(result.ok);
    if (result.ok) {
      const view = /** @type {any} */ (result.view);
      assert.equal(view.store.state, "not-configured");
      assert.equal(view.adapter.cache.status, status);
    }
  }
  for (const value of [
    { status: "CANARY", entries: 0, fresh: 0, stale: 0 },
    { status: "ready", entries: 3, fresh: 1, stale: 1 },
    { status: "ready", entries: 0, fresh: 0, stale: 0, path: "CANARY" },
  ]) {
    const result = await invoke(null, doctor, { inspectAdapterCache: async () => value });
    assert.ok(result.ok);
    if (result.ok)
      assert.equal(/** @type {any} */ (result.view).adapter.cache.status, "unavailable");
    assert.doesNotMatch(JSON.stringify(result), /CANARY/u);
  }
});

test("doctor distinguishes deleted, corrupt and recovery Stores without automatic migration or repair", async (context) => {
  const fixture = await ownerFixture(context);
  const corrupt = path.join(fixture.store.directoryPath, "community-profile-store.g-9.json");
  await writeFile(corrupt, "CORRUPT_CANARY");
  const recovered = await invoke(fixture.configuration, doctor);
  assert.ok(recovered.ok);
  if (recovered.ok) assert.equal(/** @type {any} */ (recovered.view).store.state, "recovered");
  assert.ok((await deleteLocalProfileStore(fixture.configuration)).ok);
  const deleted = await invoke(fixture.configuration, doctor);
  assert.ok(deleted.ok);
  if (deleted.ok) assert.equal(/** @type {any} */ (deleted.view).store.state, "deleted");
  assert.equal((await invoke(fixture.configuration, evidence)).ok, false);
  const corrupted = await invoke(fixture.configuration, doctor, {
    port: {
      ...nodeLocalProfileStorePort,
      readEntry: async () => {
        throw new Error("CORRUPT_CANARY");
      },
    },
  });
  assert.ok(corrupted.ok);
  if (corrupted.ok) assert.equal(/** @type {any} */ (corrupted.view).store.state, "unavailable");
  assert.doesNotMatch(JSON.stringify(corrupted), /CANARY/u);
});

test("doctor measures canonical context bytes and conservative token bound without echoing packets", async () => {
  const packet = JSON.parse(
    await readFile("fixtures/dcp/0.1.0/valid/insufficient-evidence.json", "utf8"),
  );
  const bytes = Buffer.byteLength(JSON.stringify(packet), "utf8");
  const current = { ...doctor, at: packet.generatedAt, packet };
  for (const [request, expected] of [
    [current, "within-budget"],
    [{ ...current, maxContextTokens: bytes - 1 }, "over-budget"],
    [{ ...current, maxContextBytes: bytes - 1 }, "over-budget"],
    [{ ...current, at: packet.expiresAt }, "expired"],
    [{ ...current, at: "2000-01-01T00:00:00Z" }, "future"],
    [{ ...current, packet: { ...packet, schemaVersion: "1.0.0" } }, "invalid"],
  ]) {
    const result = await invoke(null, request);
    assert.ok(result.ok);
    if (result.ok) {
      const view = /** @type {any} */ (result.view);
      assert.equal(view.context.state, expected);
      if (expected !== "invalid") {
        assert.equal(view.context.bytes, bytes);
        assert.equal(view.context.tokenUpperBound, bytes);
      }
    }
    assert.doesNotMatch(JSON.stringify(result), /packetId|task|claims|purpose|limitations/u);
  }
});

test("evidence diagnostics hash opaque fields and omit arbitrary private limitations", async (context) => {
  const fixture = await ownerFixture(context);
  const value = fixture.initial;
  const firstClaim = value.profile.claims[0];
  assert.ok(firstClaim);
  const oldId = firstClaim.claimId;
  const modified = {
    ...value,
    internalState: { ...value.internalState, generation: 1 },
    profile: {
      ...value.profile,
      claims: value.profile.claims.map((claim) => ({
        ...claim,
        claimId: claim.claimId === oldId ? "FMU_SECRET_CANARY" : claim.claimId,
        limitations: ["C:/Users/CANARY private source"],
      })),
      evidence: value.profile.evidence.map((item) => ({
        ...item,
        limitations: ["password=CANARY"],
      })),
    },
  };
  assert.ok(
    (
      await writeLocalProfileStore(fixture.configuration, JSON.stringify(modified), {
        expectedGeneration: 0,
      })
    ).ok,
  );
  const result = await invoke(fixture.configuration, {
    ...evidence,
    capability: firstClaim.capability,
  });
  assert.ok(result.ok);
  assert.match(JSON.stringify(result), /private-limitations-omitted/u);
  assert.doesNotMatch(JSON.stringify(result), /CANARY|password|Users/u);
});

test("doctor exposes abandoned mutation gates without removing them", async (context) => {
  const fixture = await ownerFixture(context);
  const gate = path.join(fixture.store.directoryPath, ".community-profile-store.mutation.lock");
  await writeFile(gate, "GATE_CANARY");
  const result = await invoke(fixture.configuration, doctor);
  assert.ok(result.ok);
  if (result.ok) assert.equal(/** @type {any} */ (result.view).store.mutationGate, "blocked");
  assert.equal(await readFile(gate, "utf8"), "GATE_CANARY");
  assert.doesNotMatch(JSON.stringify(result), /CANARY|mutation.lock/u);
});

test("evidence counts repeated correction history and preserves legacy self-targeted effective disputes", async (context) => {
  const fixture = await ownerFixture(context);
  assert.ok((await fixture.correct("reject", 0)).ok);
  assert.ok((await fixture.correct("correct", 1)).ok);
  const current = await fixture.load();
  const effective = current.profile.claims.find((claim) => claim.state === "disputed");
  assert.ok(effective);
  const query = { ...evidence, capability: effective.capability };
  const history = await invoke(fixture.configuration, query);
  assert.ok(history.ok);
  if (history.ok)
    assert.equal(
      /** @type {any} */ (history.view).claims.find(
        (/** @type {any} */ claim) => claim.state === "disputed",
      ).correctionCount,
      2,
    );
  const selfTargeted = {
    ...current,
    internalState: { ...current.internalState, generation: 3 },
    profile: {
      ...current.profile,
      corrections: current.profile.corrections.map((item) => ({
        ...item,
        targetClaimRef: effective.claimId,
      })),
    },
  };
  assert.ok(
    (
      await writeLocalProfileStore(fixture.configuration, JSON.stringify(selfTargeted), {
        expectedGeneration: 2,
      })
    ).ok,
  );
  const result = await invoke(fixture.configuration, query);
  assert.ok(result.ok);
  if (result.ok)
    assert.equal(
      /** @type {any} */ (result.view).claims.find(
        (/** @type {any} */ claim) => claim.state === "disputed",
      ).historical,
      false,
    );
});
