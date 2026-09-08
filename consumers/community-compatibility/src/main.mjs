import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  isDeveloperContextPacket,
  isPortableProfileExport,
  isProfileProviderResponse,
} from "@fork-me-up/protocol";
import { loadDeveloperProfileFromPortableExport } from "@fork-me-up/core";
import {
  createLocalFixtureProfileProvider,
  loadLocalProfileStore,
  parseCommunityProfileStore,
  resolveLocalProfileStoreConfig,
  runOwnerPortabilityOperation,
  writeLocalProfileStore,
} from "@fork-me-up/community-provider";

const dcpSpecifier = ["@fork-me-up/protocol/fixtures/dcp/0.1.0/valid", "minimal.json"].join("/");
const portableSpecifier = [
  "@fork-me-up/protocol/fixtures/portable-profile-export/0.1.0/valid",
  "complete.json",
].join("/");
const dcp = (await import(dcpSpecifier, { with: { type: "json" } })).default;
const portableFixture = (await import(portableSpecifier, { with: { type: "json" } })).default;

const root = await mkdtemp(path.join(os.tmpdir(), "fmu-community-compatibility-"));
try {
  const sourceDirectory = await directory("source");
  const exportDirectory = await directory("export");
  const importedDirectory = await directory("imported");
  const migrationDirectory = await directory("migration");
  const recoveryDirectory = await directory("recovery");
  const source = await configuration(sourceDirectory, "store_source");
  const imported = await configuration(importedDirectory, "store_imported");
  const migration = await configuration(migrationDirectory, "store_migration");
  const recovery = await configuration(recoveryDirectory, "store_recovery");

  const provider = createLocalFixtureProfileProvider({
    profile: portableFixture,
    clock: () => new Date("2026-09-08T12:00:00Z"),
    createId: (kind) => `${kind}_compatibility`,
  });
  const supportedProvider = provider.invoke(providerRequest("get-provider-capabilities", {}));
  const unsupportedOperation = provider.invoke(
    providerRequest("get-capability-evidence", { capability: "language.typescript" }),
  );
  const unsupportedVersion = provider.invoke(
    providerRequest("get-provider-capabilities", {}, { schemaVersion: "1.0.0" }),
  );
  assert.equal(isProfileProviderResponse(supportedProvider), true);
  assert.equal(supportedProvider.outcome, "success");
  assert.equal(unsupportedOperation.outcome, "error");
  assert.equal(unsupportedOperation.error?.category, "unsupported-operation");
  assert.equal(unsupportedVersion.outcome, "error");
  assert.equal(unsupportedVersion.error?.category, "unsupported-version");

  assert.equal(isDeveloperContextPacket(dcp), true);
  assert.equal(isDeveloperContextPacket({ ...dcp, schemaVersion: "1.0.0" }), false);
  assert.equal(isPortableProfileExport(portableFixture), true);
  assert.equal(loadDeveloperProfileFromPortableExport(portableFixture).ok, true);
  assert.equal(
    loadDeveloperProfileFromPortableExport({ ...portableFixture, schemaVersion: "1.0.0" }).ok,
    false,
  );

  const importedSource = await importPortable(source, portableFixture, "2026-09-08T12:00:01Z");
  assert.equal(importedSource.ok, true);
  const exported = await runOwnerPortabilityOperation(
    source,
    JSON.stringify({
      version: "0.1.0",
      operation: "export",
      at: "2026-09-08T12:00:02Z",
      expectedGeneration: 0,
      exportId: "compatibility_export",
      destinationDirectory: exportDirectory,
    }),
    { nonce: "compatibility_export" },
  );
  assert.equal(exported.ok, true);
  assert.ok(exported.ok && exported.fileName !== null);
  const portable = JSON.parse(
    await readFile(path.join(exportDirectory, exported.fileName), "utf8"),
  );
  assert.equal(isPortableProfileExport(portable), true);
  assert.equal(Object.hasOwn(portable, "internalState"), false);
  const importedRoundTrip = await importPortable(imported, portable, "2026-09-08T12:00:03Z");
  assert.equal(importedRoundTrip.ok, true);
  const roundTripStore = await activeStore(imported);
  assert.equal(roundTripStore.profile.claims.length, portable.profile.claims.length);
  assert.equal(roundTripStore.profile.corrections.length, portable.profile.corrections.length);
  const occupied = await importPortable(imported, portable, "2026-09-08T12:00:04Z");
  assert.equal(occupied.ok, false);
  assert.equal(occupied.error?.category, "conflict");

  const update = JSON.parse(JSON.stringify(roundTripStore));
  update.internalState.generation = 1;
  update.internalState.updatedAt = "2026-09-08T12:00:04Z";
  update.internalState.lastValidatedAt = "2026-09-08T12:00:04Z";
  assert.equal(
    (
      await writeLocalProfileStore(imported, JSON.stringify(update), {
        expectedGeneration: 0,
        nonce: "compatibility_update",
      })
    ).ok,
    true,
  );
  const staleUpdate = JSON.parse(JSON.stringify(update));
  staleUpdate.internalState.generation = 2;
  staleUpdate.internalState.updatedAt = "2026-09-08T12:00:05Z";
  staleUpdate.internalState.lastValidatedAt = "2026-09-08T12:00:05Z";
  const rejectedUpdate = await writeLocalProfileStore(imported, JSON.stringify(staleUpdate), {
    expectedGeneration: 0,
    nonce: "compatibility_stale",
  });
  assert.equal(rejectedUpdate.ok, false);
  assert.equal(rejectedUpdate.error?.category, "conflict");

  const legacy = JSON.parse(JSON.stringify(roundTripStore));
  legacy.storeId = migration.storeId;
  legacy.internalState.generation = 0;
  legacy.storeSchemaVersion = "0.0.0";
  delete legacy.internalState.lastValidatedAt;
  delete legacy.internalState.migratedFromStoreSchemaVersion;
  await writeFile(
    path.join(migrationDirectory, "community-profile-store.g-0.json"),
    `${JSON.stringify(legacy)}\n`,
    "utf8",
  );
  const migrationRequired = await loadLocalProfileStore(migration);
  assert.equal(migrationRequired.ok, false);
  assert.equal(migrationRequired.error?.category, "migration-required");
  const migrated = await loadLocalProfileStore(migration, {
    migrationValidatedAt: "2026-09-08T12:00:06Z",
    nonce: "compatibility_migration",
  });
  assert.equal(migrated.ok, true);
  assert.equal(migrated.status, "migrated");
  assert.equal(migrated.value?.internalState.migratedFromStoreSchemaVersion, "0.0.0");

  assert.equal((await importPortable(recovery, portableFixture, "2026-09-08T12:00:07Z")).ok, true);
  await writeFile(path.join(recoveryDirectory, "community-profile-store.g-9.json"), "invalid");
  const recovered = await loadLocalProfileStore(recovery);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.status, "recovered");
  assert.equal(recovered.value?.internalState.generation, 0);

  assert.equal(isPortableProfileExport(roundTripStore), false);
  assert.equal(isDeveloperContextPacket(roundTripStore), false);
  assert.equal(isDeveloperContextPacket(portable), false);
  assert.equal(parseCommunityProfileStore(JSON.stringify(portable)).ok, false);
  assert.equal(parseCommunityProfileStore(JSON.stringify(dcp)).ok, false);

  for (const name of ["protocol", "core", "community-provider"]) {
    const installedManifest = JSON.parse(
      await readFile(path.join("node_modules", "@fork-me-up", name, "package.json"), "utf8"),
    );
    assert.equal(installedManifest.private, true);
    assert.equal(Object.hasOwn(installedManifest, "scripts"), false);
    assert.equal(Object.hasOwn(installedManifest, "publishConfig"), false);
  }

  process.stdout.write(
    `${JSON.stringify({
      schemaVersion: 1,
      kind: "community-artifact-compatibility-results",
      cases: [
        { boundary: "provider", behavior: "supported-and-unsupported-operations", outcome: "pass" },
        {
          boundary: "dcp",
          behavior: "supported-version-and-unsupported-version-rejection",
          outcome: "pass",
        },
        { boundary: "export", behavior: "owner-export-import-round-trip", outcome: "pass" },
        { boundary: "store", behavior: "private-envelope-and-update-conflict", outcome: "pass" },
        { boundary: "store", behavior: "explicit-legacy-migration", outcome: "pass" },
        { boundary: "store", behavior: "newest-invalid-generation-recovery", outcome: "pass" },
        { boundary: "boundaries", behavior: "store-export-dcp-non-conflation", outcome: "pass" },
      ],
    })}\n`,
  );
} finally {
  await rm(root, { recursive: true, force: true });
}

/** @param {string} name */
async function directory(name) {
  const value = path.join(root, name);
  await mkdir(value);
  return value;
}

/** @param {string} directoryPath @param {string} storeId */
async function configuration(directoryPath, storeId) {
  const result = await resolveLocalProfileStoreConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      directoryPath,
      storeId,
      subjectRef: "subject_synthetic_owner",
    }),
  );
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("configuration");
  return result.value;
}

/**
 * @param {import("@fork-me-up/community-provider").ResolvedLocalProfileStoreConfig} configurationValue
 * @param {unknown} portableProfile
 * @param {string} at
 */
async function importPortable(configurationValue, portableProfile, at) {
  return runOwnerPortabilityOperation(
    configurationValue,
    JSON.stringify({ version: "0.1.0", operation: "import", at, portableProfile }),
    { nonce: `import_${at.slice(-3, -1)}` },
  );
}

/** @param {import("@fork-me-up/community-provider").ResolvedLocalProfileStoreConfig} configurationValue */
async function activeStore(configurationValue) {
  const result = await loadLocalProfileStore(configurationValue);
  assert.equal(result.ok, true);
  if (!result.ok || result.value === null) throw new Error("active-store");
  return result.value;
}

/**
 * @param {import("@fork-me-up/protocol").ProfileProviderOperation} operation
 * @param {unknown} input
 * @param {Record<string, unknown>} [overrides]
 */
function providerRequest(operation, input, overrides = {}) {
  return {
    schemaVersion: "0.1.0",
    kind: "profile-provider-request",
    requestId: "request_compatibility",
    operation,
    input,
    ...overrides,
  };
}
