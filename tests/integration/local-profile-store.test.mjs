import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadLocalProfileStore,
  resolveLocalProfileStoreConfig,
  writeLocalProfileStore,
} from "@fork-me-up/community-provider";

const baseStore = JSON.parse(
  await readFile(
    new URL(
      "../../fixtures/internal/community-profile-store/0.1.0/valid/empty.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

/** @param {number} generation @param {string} profileVersion */
function currentSource(generation, profileVersion) {
  const value = globalThis.structuredClone(baseStore);
  value.profileVersion = profileVersion;
  value.internalState.generation = generation;
  value.internalState.updatedAt = `2026-09-05T10:00:${String(generation).padStart(2, "0")}Z`;
  value.internalState.lastValidatedAt = value.internalState.updatedAt;
  return `${JSON.stringify(value)}\n`;
}

/** @param {number} generation */
function legacySource(generation) {
  const value = JSON.parse(currentSource(generation, "profile_legacy"));
  value.storeSchemaVersion = "0.0.0";
  delete value.internalState.lastValidatedAt;
  delete value.internalState.migratedFromStoreSchemaVersion;
  return `${JSON.stringify(value)}\n`;
}

/** @param {import("node:test").TestContext} context @param {string} suffix */
async function sandbox(context, suffix) {
  const root = await mkdtemp(path.join(tmpdir(), `fork-me-up-m2-s06-${suffix}-`));
  const directory = path.join(root, "store");
  await mkdir(directory);
  context.after(async () => rm(root, { recursive: true, force: true }));
  const resolved = await resolveLocalProfileStoreConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      directoryPath: directory,
      storeId: "store_synthetic_empty",
      subjectRef: "subject_synthetic_owner",
    }),
  );
  assert.equal(resolved.ok, true);
  if (!resolved.ok) throw new Error("store configuration failed");
  return { root, directory, configuration: resolved.value };
}

test("real generation files activate exclusively, retain rollback state, and recover deterministically", async (context) => {
  const { directory, configuration } = await sandbox(context, "atomic");
  const created = await writeLocalProfileStore(configuration, currentSource(0, "profile_created"), {
    expectedGeneration: null,
    nonce: "create",
  });
  assert.equal(created.ok, true);
  const updated = await writeLocalProfileStore(configuration, currentSource(1, "profile_updated"), {
    expectedGeneration: 0,
    nonce: "update",
  });
  assert.equal(updated.ok, true);
  assert.deepEqual((await readdir(directory)).filter((name) => name.endsWith(".json")).sort(), [
    "community-profile-store.g-0.json",
    "community-profile-store.g-1.json",
  ]);

  const concurrent = await Promise.all([
    writeLocalProfileStore(configuration, currentSource(2, "profile_writer_a"), {
      expectedGeneration: 1,
      nonce: "writer_a",
    }),
    writeLocalProfileStore(configuration, currentSource(2, "profile_writer_b"), {
      expectedGeneration: 1,
      nonce: "writer_b",
    }),
  ]);
  assert.equal(concurrent.filter((result) => result.ok).length, 1);
  assert.equal(
    concurrent.filter((result) => !result.ok && result.error.category === "conflict").length,
    1,
  );
  const afterRace = await loadLocalProfileStore(configuration);
  assert.equal(afterRace.ok, true);
  if (!afterRace.ok || afterRace.status === "absent") return;
  assert.equal(afterRace.value.internalState.generation, 2);
  assert.match(afterRace.value.profileVersion, /^profile_writer_[ab]$/u);
  assert.equal(
    (await readdir(directory)).some((name) => name.endsWith(".tmp")),
    false,
  );

  await writeFile(path.join(directory, "community-profile-store.g-9.json"), "CORRUPT_CANARY");
  await writeFile(
    path.join(directory, ".community-profile-store.g-10.orphan.tmp"),
    currentSource(10, "profile_uncommitted"),
  );
  const recovered = await loadLocalProfileStore(configuration);
  assert.equal(recovered.ok, true);
  if (!recovered.ok || recovered.status === "absent") return;
  assert.equal(recovered.status, "recovered");
  assert.equal(recovered.value.internalState.generation, 2);
  assert.equal(recovered.nextGeneration, 10);
  assert.equal(recovered.invalidCandidateCount, 1);
  assert.equal(recovered.orphanTemporaryCount, 1);
});

test("real legacy migration is atomic and committed links reject filesystem redirection", async (context) => {
  const legacy = await sandbox(context, "migration");
  await writeFile(path.join(legacy.directory, "community-profile-store.g-0.json"), legacySource(0));
  const migrated = await loadLocalProfileStore(legacy.configuration, {
    migrationValidatedAt: "2026-09-05T10:00:01Z",
    nonce: "migration",
  });
  assert.equal(migrated.ok, true);
  if (!migrated.ok || migrated.status === "absent") return;
  assert.equal(migrated.status, "migrated");
  assert.equal(migrated.value.internalState.generation, 1);
  assert.equal(migrated.value.internalState.migratedFromStoreSchemaVersion, "0.0.0");
  assert.deepEqual(
    (await readdir(legacy.directory)).filter((name) => name.endsWith(".json")).sort(),
    ["community-profile-store.g-0.json", "community-profile-store.g-1.json"],
  );

  const redirected = await sandbox(context, "link");
  const outside = path.join(redirected.root, "outside.json");
  await writeFile(outside, currentSource(0, "profile_outside"));
  try {
    await symlink(
      outside,
      path.join(redirected.directory, "community-profile-store.g-0.json"),
      "file",
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "EPERM" || error.code === "EACCES" || error.code === "ENOSYS")
    ) {
      return;
    }
    throw error;
  }
  assert.deepEqual(await loadLocalProfileStore(redirected.configuration), {
    ok: false,
    error: { category: "not-authorized", retryable: false },
  });
});
