import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  deleteLocalProfileStore,
  disposeIncrementalRefreshSessions,
  loadLocalProfileStore,
  nodeLocalProfileStorePort,
  refreshLocalRepositories,
  runOwnerPortabilityOperation,
  writeLocalProfileStore,
} from "@fork-me-up/community-provider";
import { isPortableProfileExport } from "@fork-me-up/protocol";
import {
  portabilityFixture,
  deleteRequest,
  importRequest,
} from "../helpers/owner-portability-fixture.mjs";
import { refreshRequest } from "../helpers/incremental-refresh-fixture.mjs";

test("portable projection removes private text and paths while preserving correction provenance and import behavior", async (context) => {
  const fixture = await portabilityFixture(context);
  const { source, value } = await fixture.exported();
  assert.equal(isPortableProfileExport(value), true);
  assert.doesNotMatch(
    source,
    /CANARY|main.ts|extra.ts|source_synthetic|storeSchemaVersion|directoryPath/u,
  );
  assert.equal(Object.hasOwn(value, "internalState"), false);
  assert.equal(value.profile.corrections.length, 1);
  assert.equal(value.profile.corrections[0].kind, "rejection");
  assert.ok(
    value.profile.claims.some(
      (/** @type {{claimId: string}} */ item) =>
        item.claimId === value.profile.corrections[0].targetClaimRef,
    ),
  );
  const destination = await fixture.destinationStore();
  const imported = await runOwnerPortabilityOperation(
    destination.configuration,
    importRequest(value),
  );
  assert.ok(imported.ok && imported.status === "imported" && imported.generation === 0);
  assert.doesNotMatch(JSON.stringify(imported), /CANARY|summary/u);
  const loaded = await loadLocalProfileStore(destination.configuration);
  assert.ok(loaded.ok && loaded.value);
  if (!loaded.ok || loaded.value === null) return;
  assert.equal(loaded.value.profile.corrections.length, 1);
  assert.equal(loaded.value.profile.claims.filter((item) => item.state === "disputed").length, 1);
  assert.ok(
    loaded.value.profile.evidence.every(
      (item) =>
        item.authorAssessment.subjectRef === null ||
        item.authorAssessment.subjectRef === destination.configuration.subjectRef,
    ),
  );
  assert.equal((await fixture.load()).profile.corrections[0]?.summary, "OWNER_NOTE_CANARY");
});

test("imports reject wrong envelopes, malformed graphs, subject/time mismatch and occupied destinations", async (context) => {
  const fixture = await portabilityFixture(context);
  const { value } = await fixture.exported();
  const destination = await fixture.destinationStore();
  for (const input of [
    fixture.initial,
    {},
    { ...value, schemaVersion: "1.0.0" },
    { ...value, subjectRef: "other" },
    { ...value, generatedAt: "2027-01-01T00:00:00Z" },
    { ...value, credentials: "FMU_SECRET_CANARY" },
    { ...value, profile: { ...value.profile, evidence: [] } },
  ]) {
    const result = await runOwnerPortabilityOperation(
      destination.configuration,
      importRequest(input),
    );
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /CANARY|stack/u);
  }
  assert.equal(
    (await runOwnerPortabilityOperation(fixture.configuration, importRequest(value))).ok,
    false,
  );
  const loaded = await loadLocalProfileStore(destination.configuration);
  assert.ok(loaded.ok && loaded.status === "absent");
});

test("sensitive semantic capabilities fail redaction before an artifact is created", async (context) => {
  const fixture = await portabilityFixture(context);
  const current = await fixture.load();
  const capability = "language.sk-abcdefghijklmnop";
  const candidate = {
    ...current,
    internalState: { ...current.internalState, generation: 2 },
    profile: {
      ...current.profile,
      claims: current.profile.claims.map((item) => ({ ...item, capability })),
      evidence: current.profile.evidence.map((item) => ({ ...item, capabilitySignal: capability })),
      corrections: current.profile.corrections.map((item) => ({ ...item, capability })),
    },
  };
  assert.equal(
    (
      await writeLocalProfileStore(fixture.configuration, JSON.stringify(candidate), {
        expectedGeneration: 1,
      })
    ).ok,
    true,
  );
  const result = await runOwnerPortabilityOperation(
    fixture.configuration,
    JSON.stringify({ ...fixture.exportRequest, expectedGeneration: 2 }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.category, "redaction-failed");
  assert.deepEqual(await readdir(fixture.destination), []);
});

test("export never overwrites an artifact and never acknowledges failed staging/final readback", async (context) => {
  const fixture = await portabilityFixture(context);
  const first = await fixture.exported();
  const conflict = await runOwnerPortabilityOperation(
    fixture.configuration,
    JSON.stringify(fixture.exportRequest),
  );
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.error.category, "conflict");
  assert.equal(
    await readFile(path.join(fixture.destination, first.result.fileName ?? ""), "utf8"),
    first.source,
  );
  for (const final of [false, true]) {
    const result = await runOwnerPortabilityOperation(
      fixture.configuration,
      JSON.stringify({ ...fixture.exportRequest, exportId: final ? "final_read" : "staged_read" }),
      {
        port: {
          ...nodeLocalProfileStorePort,
          async readEntry(...args) {
            if (
              args[0] === fixture.destination &&
              (final ? args[1].endsWith(".json") : args[1].endsWith(".tmp"))
            )
              return Buffer.from("{}");
            return nodeLocalProfileStorePort.readEntry(...args);
          },
        },
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok)
      assert.equal(result.error.category, final ? "export-outcome-unknown" : "persistence-failed");
  }
  assert.equal(
    (await readdir(fixture.destination)).some((name) => name.endsWith(".tmp")),
    false,
  );
});

test("deletion removes managed data, preserves source/unknown files and invalidates warmed source sessions", async (context) => {
  const fixture = await portabilityFixture(context);
  const original = await readFile(path.join(fixture.a, "main.ts"), "utf8");
  await writeFile(
    path.join(fixture.store.directoryPath, "owner-unrelated.txt"),
    "UNRELATED_CANARY",
  );
  await writeFile(
    path.join(fixture.store.directoryPath, ".community-profile-store.g-9.orphan.tmp"),
    "ORPHAN_CANARY",
  );
  let cleared = 0;
  const result = await runOwnerPortabilityOperation(fixture.configuration, deleteRequest, {
    clearAdapterCache: async () => {
      cleared += 1;
      return { ok: true };
    },
  });
  assert.ok(result.ok && result.status === "deleted" && result.disposedSessions >= 1);
  assert.equal(cleared, 1);
  assert.deepEqual((await readdir(fixture.store.directoryPath)).sort(), [
    ".community-profile-store.deleted",
    "owner-unrelated.txt",
  ]);
  assert.equal(await readFile(path.join(fixture.a, "main.ts"), "utf8"), original);
  assert.equal(
    await readFile(path.join(fixture.store.directoryPath, "owner-unrelated.txt"), "utf8"),
    "UNRELATED_CANARY",
  );
  const loaded = await loadLocalProfileStore(fixture.configuration);
  assert.ok(!loaded.ok && loaded.error.category === "profile-deleted");
  const written = await writeLocalProfileStore(
    fixture.configuration,
    JSON.stringify(fixture.initial),
    { expectedGeneration: null },
  );
  assert.ok(!written.ok && written.error.category === "profile-deleted");
  const refreshed = await refreshLocalRepositories(fixture.session, refreshRequest());
  assert.ok(!refreshed.ok && refreshed.error.category === "not-configured");
});

test("partial deletion retains its barrier and resumes without restoring old generations", async (context) => {
  const fixture = await portabilityFixture(context);
  const result = await deleteLocalProfileStore(fixture.configuration, {
    port: {
      ...nodeLocalProfileStorePort,
      async removeEntry(...args) {
        if (args[1].endsWith("g-1.json")) throw new Error("DELETE_CANARY");
        return nodeLocalProfileStorePort.removeEntry(...args);
      },
    },
  });
  assert.ok(!result.ok && result.error.category === "deletion-incomplete");
  assert.doesNotMatch(JSON.stringify(result), /CANARY/u);
  const loaded = await loadLocalProfileStore(fixture.configuration);
  assert.ok(!loaded.ok && loaded.error.category === "profile-deleted");
  assert.equal((await deleteLocalProfileStore(fixture.configuration)).ok, true);
  assert.deepEqual(await readdir(fixture.store.directoryPath), [
    ".community-profile-store.deleted",
  ]);
});

test("deletion and activation share an exclusive gate and an abandoned gate fails closed", async (context) => {
  const fixture = await portabilityFixture(context);
  /** @type {() => void} */ let release = () => {};
  /** @type {() => void} */ let started = () => {};
  const reached = new Promise((resolve) => {
    started = () => resolve(undefined);
  });
  const hold = new Promise((resolve) => {
    release = () => resolve(undefined);
  });
  const pending = fixture.correct("correct", 1, {
    port: {
      ...nodeLocalProfileStorePort,
      async linkEntryExclusive(...args) {
        started();
        await hold;
        return nodeLocalProfileStorePort.linkEntryExclusive(...args);
      },
    },
  });
  await reached;
  const deleting = await deleteLocalProfileStore(fixture.configuration);
  assert.ok(!deleting.ok && deleting.error.category === "conflict");
  release();
  assert.equal((await pending).ok, true);
  await writeFile(
    path.join(fixture.store.directoryPath, ".community-profile-store.mutation.lock"),
    "mutation\n",
  );
  const abandoned = await deleteLocalProfileStore(fixture.configuration);
  assert.ok(!abandoned.ok && abandoned.error.category === "conflict");
  assert.equal((await fixture.load()).internalState.generation, 2);
});

test("in-flight source refresh cannot publish cached data after owner disposal", async (context) => {
  const fixture = await portabilityFixture(context);
  /** @type {() => void} */ let release = () => {};
  /** @type {() => void} */ let started = () => {};
  const reached = new Promise((resolve) => {
    started = () => resolve(undefined);
  });
  const hold = new Promise((resolve) => {
    release = () => resolve(undefined);
  });
  const { nodeRepositoryFingerprintPort } = await import("@fork-me-up/community-provider");
  const session = fixture.session;
  const other = (await import("../helpers/incremental-refresh-fixture.mjs")).refreshFixture;
  const source = await other(context);
  const runningSession = source.session(
    {},
    {
      fingerprintPort: {
        ...nodeRepositoryFingerprintPort,
        async inspect(candidate) {
          started();
          await hold;
          return nodeRepositoryFingerprintPort.inspect(candidate);
        },
      },
    },
  );
  const pending = refreshLocalRepositories(runningSession, refreshRequest());
  await reached;
  assert.ok(disposeIncrementalRefreshSessions(fixture.configuration.subjectRef) >= 2);
  release();
  const result = await pending;
  assert.ok(!result.ok && result.error.category === "not-configured");
  assert.equal((await refreshLocalRepositories(session, refreshRequest())).ok, false);
});

test("invalid portability inputs and incomplete adapter cleanup never report deleted", async (context) => {
  const fixture = await portabilityFixture(context);
  for (const request of [
    "{",
    "x".repeat(4194305),
    "{}",
    JSON.stringify({ version: "0.1.0", operation: "delete" }),
  ])
    assert.equal((await runOwnerPortabilityOperation(fixture.configuration, request)).ok, false);
  assert.equal(
    (await runOwnerPortabilityOperation({ ...fixture.configuration }, deleteRequest)).ok,
    false,
  );
  const result = await runOwnerPortabilityOperation(fixture.configuration, deleteRequest, {
    clearAdapterCache: async () => ({ ok: false }),
  });
  assert.ok(!result.ok && result.error.category === "deletion-incomplete");
  assert.equal(
    (
      await runOwnerPortabilityOperation(fixture.configuration, deleteRequest, {
        clearAdapterCache: async () => ({ ok: true }),
      })
    ).ok,
    true,
  );
});

test("barrier directory sync precedes removal and failed synchronization leaves every generation intact", async (context) => {
  const fixture = await portabilityFixture(context);
  let removals = 0;
  const result = await deleteLocalProfileStore(fixture.configuration, {
    port: {
      ...nodeLocalProfileStorePort,
      async syncDirectory() {
        throw new Error("SYNC_CANARY");
      },
      async removeEntry(...args) {
        if (args[1].endsWith(".json")) removals += 1;
        return nodeLocalProfileStorePort.removeEntry(...args);
      },
    },
  });
  assert.ok(!result.ok && result.error.category === "deletion-incomplete");
  assert.equal(removals, 0);
  assert.equal(
    (await readdir(fixture.store.directoryPath)).filter((name) => name.endsWith(".json")).length,
    2,
  );
  assert.equal((await deleteLocalProfileStore(fixture.configuration)).ok, true);
});

test("verified export and Store writes expose cleanup debt and deletion does not hide an unreleased gate", async (context) => {
  const fixture = await portabilityFixture(context);
  const exported = await runOwnerPortabilityOperation(
    fixture.configuration,
    JSON.stringify(fixture.exportRequest),
    {
      port: {
        ...nodeLocalProfileStorePort,
        async removeEntry(...args) {
          if (args[1].startsWith(".portable-profile-export.")) throw new Error("CLEANUP_CANARY");
          return nodeLocalProfileStorePort.removeEntry(...args);
        },
      },
    },
  );
  assert.ok(exported.ok && exported.status === "exported" && exported.maintenanceRequired);
  const corrected = await fixture.correct("correct", 1, {
    port: {
      ...nodeLocalProfileStorePort,
      async removeEntry(...args) {
        if (args[1].endsWith("mutation.lock")) throw new Error("GATE_CANARY");
        return nodeLocalProfileStorePort.removeEntry(...args);
      },
    },
  });
  assert.ok(corrected.ok && corrected.maintenanceRequired);
  const { unlink } = await import("node:fs/promises");
  await unlink(path.join(fixture.store.directoryPath, ".community-profile-store.mutation.lock"));
  const deleted = await deleteLocalProfileStore(fixture.configuration, {
    port: {
      ...nodeLocalProfileStorePort,
      async removeEntry(...args) {
        if (args[1].endsWith("mutation.lock")) throw new Error("GATE_CANARY");
        return nodeLocalProfileStorePort.removeEntry(...args);
      },
    },
  });
  assert.ok(!deleted.ok && deleted.error.category === "deletion-incomplete");
});

test("live-session registry and export wrapper overhead have explicit hard ceilings", async (context) => {
  const fixture = await portabilityFixture(context);
  const { createIncrementalRefreshSession, incrementalRefreshHardLimits } =
    await import("@fork-me-up/community-provider");
  const { portableProfileArtifactMaximumBytes, ownerPortabilityMaximumInputBytes } =
    await import("../../packages/community-provider/src/owner-profile-portability.ts");
  assert.ok(portableProfileArtifactMaximumBytes + 4096 + 1024 <= ownerPortabilityMaximumInputBytes);
  disposeIncrementalRefreshSessions(fixture.configuration.subjectRef);
  const kept = [];
  for (let index = 0; index < incrementalRefreshHardLimits.maximumSessions; index += 1) {
    const result = createIncrementalRefreshSession(
      fixture.authorization,
      fixture.identity,
      fixture.risk,
      JSON.stringify(fixture.settings),
    );
    assert.equal(result.ok, true);
    kept.push(result);
  }
  assert.equal(
    createIncrementalRefreshSession(
      fixture.authorization,
      fixture.identity,
      fixture.risk,
      JSON.stringify(fixture.settings),
    ).ok,
    false,
  );
  assert.equal(disposeIncrementalRefreshSessions(fixture.configuration.subjectRef), kept.length);
});
