import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  communityProfileStoreMaximumBytes,
  loadLocalProfileStore,
  migrateCommunityProfileStore,
  parseCommunityProfileStore,
  resolveLocalProfileStoreConfig,
  serializeCommunityProfileStore,
  writeLocalProfileStore,
} from "@fork-me-up/community-provider";

const emptyStoreText = await readFile(
  new URL(
    "../../fixtures/internal/community-profile-store/0.1.0/valid/empty.json",
    import.meta.url,
  ),
  "utf8",
);
const syntheticDirectory = "/synthetic/profile-store";

/** @param {number} generation @param {string} [profileVersion] */
function currentSource(generation, profileVersion = `profile_generation_${String(generation)}`) {
  const value = JSON.parse(emptyStoreText);
  value.profileVersion = profileVersion;
  value.internalState.generation = generation;
  value.internalState.updatedAt = `2026-09-05T10:00:${String(generation).padStart(2, "0")}Z`;
  value.internalState.lastValidatedAt = value.internalState.updatedAt;
  return `${JSON.stringify(value)}\n`;
}

/** @param {number} generation */
function legacySource(generation) {
  const value = JSON.parse(currentSource(generation));
  value.storeSchemaVersion = "0.0.0";
  delete value.internalState.lastValidatedAt;
  delete value.internalState.migratedFromStoreSchemaVersion;
  return `${JSON.stringify(value)}\n`;
}

async function configuration() {
  const result = await resolveLocalProfileStoreConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      directoryPath: syntheticDirectory,
      storeId: "store_synthetic_empty",
      subjectRef: "subject_synthetic_owner",
    }),
    {
      platform: "posix",
      directoryPort: { canonicalizeDirectory: async () => syntheticDirectory },
    },
  );
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("configuration failed");
  return result.value;
}

/**
 * @returns {import("@fork-me-up/community-provider").LocalProfileStoreFilePort & {files: Map<string, Uint8Array>, failAt: string | null, linked: boolean}}
 */
function memoryPort() {
  return {
    files: new Map(),
    failAt: null,
    linked: false,
    async inspectDirectory(directoryPath) {
      return {
        canonicalPath: directoryPath,
        pathIdentity: directoryPath,
        kind: "directory",
      };
    },
    async listEntries() {
      return [...this.files.keys()].sort();
    },
    async readEntry(_directoryPath, entryName) {
      if (this.failAt === "staged-read" && entryName.endsWith(".tmp")) {
        return Buffer.from("{", "utf8");
      }
      if (this.failAt === "final-read" && this.linked && entryName.endsWith("g-1.json")) {
        return Buffer.from("{", "utf8");
      }
      const value = this.files.get(entryName);
      return value === undefined ? null : Uint8Array.from(value);
    },
    async writeEntryExclusive(_directoryPath, entryName, bytes) {
      if (this.failAt === "write") throw new Error("PRIVATE_WRITE_CANARY");
      if (this.files.has(entryName)) return "exists";
      this.files.set(entryName, Uint8Array.from(bytes));
      return "created";
    },
    async linkEntryExclusive(_directoryPath, sourceName, targetName) {
      if (this.failAt === "link-exists") return "exists";
      if (this.files.has(targetName)) return "exists";
      const source = this.files.get(sourceName);
      if (source === undefined) throw new Error("PRIVATE_LINK_CANARY");
      this.files.set(targetName, Uint8Array.from(source));
      this.linked = true;
      return "linked";
    },
    async removeEntry(_directoryPath, entryName) {
      if (this.failAt === "remove") throw new Error("PRIVATE_REMOVE_CANARY");
      return this.files.delete(entryName);
    },
    async syncDirectory() {
      if (this.failAt === "sync") throw new Error("PRIVATE_SYNC_CANARY");
    },
  };
}

test("current and synthetic legacy Store formats are closed, bounded, and migrated explicitly", () => {
  const current = parseCommunityProfileStore(currentSource(0));
  assert.equal(current.ok, true);
  if (!current.ok) return;
  assert.equal(current.value.storeSchemaVersion, "0.1.0");
  assert.equal(Object.isFrozen(current.value.profile), true);
  const serialized = serializeCommunityProfileStore(current.value);
  assert.equal(serialized.ok, true);

  const legacy = parseCommunityProfileStore(legacySource(0));
  assert.equal(legacy.ok, true);
  if (!legacy.ok || legacy.value.storeSchemaVersion !== "0.0.0") return;
  const migrated = migrateCommunityProfileStore(legacy.value, {
    generation: 1,
    validatedAt: "2026-09-05T10:00:01Z",
  });
  assert.equal(migrated.ok, true);
  if (!migrated.ok) return;
  assert.equal(migrated.value.storeSchemaVersion, "0.1.0");
  assert.equal(migrated.value.internalState.generation, 1);
  assert.equal(migrated.value.internalState.migratedFromStoreSchemaVersion, "0.0.0");
  assert.deepEqual(migrated.value.profile, legacy.value.profile);
  assert.deepEqual(
    migrateCommunityProfileStore(
      { ...legacy.value },
      {
        generation: 1,
        validatedAt: "2026-09-05T10:00:01Z",
      },
    ),
    { ok: false, error: { category: "invalid-input", retryable: false } },
  );

  for (const source of [
    "{",
    JSON.stringify({ ...JSON.parse(currentSource(0)), extra: true }),
    JSON.stringify({ ...JSON.parse(currentSource(0)), storeSchemaVersion: "9.0.0" }),
    JSON.stringify({
      ...JSON.parse(currentSource(0)),
      internalState: { ...JSON.parse(currentSource(0)).internalState, lastValidatedAt: "invalid" },
    }),
  ]) {
    const result = parseCommunityProfileStore(source);
    assert.equal(result.ok, false);
    assert.equal("value" in result, false);
  }
  assert.deepEqual(parseCommunityProfileStore(" ".repeat(communityProfileStoreMaximumBytes + 1)), {
    ok: false,
    error: { category: "limit-exceeded", retryable: false },
  });
});

test("location configuration is canonical, authentic, closed, and content-free on failure", async () => {
  const first = await configuration();
  assert.equal(first.directoryPath, syntheticDirectory);
  assert.equal(Object.isFrozen(first), true);
  const base = {
    configVersion: "0.1.0",
    directoryPath: "/PRIVATE_PATH_CANARY",
    storeId: "store_synthetic",
    subjectRef: "subject_synthetic",
  };
  for (const value of [
    { ...base, configVersion: "9.0.0" },
    { ...base, extra: true },
    { ...base, storeId: "bad/path" },
    { ...base, directoryPath: "relative/path" },
  ]) {
    const result = await resolveLocalProfileStoreConfig(JSON.stringify(value), {
      platform: "posix",
      directoryPort: { canonicalizeDirectory: async () => "/PRIVATE_PATH_CANARY" },
    });
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_PATH_CANARY/u);
  }
});

test("writes activate only after exact readback and retain the previous valid generation", async () => {
  const config = await configuration();
  const port = memoryPort();
  assert.deepEqual(await loadLocalProfileStore({ ...config }, { port }), {
    ok: false,
    error: { category: "not-configured", retryable: false },
  });
  // @ts-expect-error Exercise the runtime rejection of an unknown option.
  assert.deepEqual(await loadLocalProfileStore(config, { port, extra: true }), {
    ok: false,
    error: { category: "invalid-input", retryable: false },
  });
  assert.deepEqual(await loadLocalProfileStore(config, { port }), {
    ok: true,
    status: "absent",
    value: null,
    nextGeneration: 0,
    invalidCandidateCount: 0,
    orphanTemporaryCount: 0,
    maintenanceRequired: false,
  });
  const created = await writeLocalProfileStore(config, currentSource(0), {
    expectedGeneration: null,
    port,
    nonce: "create",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.previousGeneration, null);
  assert.equal(port.files.has("community-profile-store.g-0.json"), true);

  const updated = await writeLocalProfileStore(config, currentSource(1), {
    expectedGeneration: 0,
    port,
    nonce: "update",
  });
  assert.equal(updated.ok, true);
  if (!updated.ok) return;
  assert.equal(updated.previousGeneration, 0);
  assert.equal(port.files.has("community-profile-store.g-0.json"), true);
  assert.equal(port.files.has("community-profile-store.g-1.json"), true);
  const loaded = await loadLocalProfileStore(config, { port });
  assert.equal(loaded.ok, true);
  if (!loaded.ok || loaded.status === "absent") return;
  assert.equal(loaded.status, "active");
  assert.equal(loaded.value.internalState.generation, 1);
  assert.equal(Object.isFrozen(loaded.value), true);

  assert.deepEqual(
    await writeLocalProfileStore(config, currentSource(2), {
      expectedGeneration: 0,
      port,
      nonce: "stale",
    }),
    { ok: false, error: { category: "conflict", retryable: true } },
  );
});

test("a committed write reports cleanup debt without relabeling activation as failure", async () => {
  const config = await configuration();
  const port = memoryPort();
  assert.equal(
    (
      await writeLocalProfileStore(config, currentSource(0), {
        expectedGeneration: null,
        port,
        nonce: "initial",
      })
    ).ok,
    true,
  );
  port.failAt = "remove";
  const result = await writeLocalProfileStore(config, currentSource(1), {
    expectedGeneration: 0,
    port,
    nonce: "cleanup_debt",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.status, "committed");
  assert.equal(result.maintenanceRequired, true);
  assert.equal(port.files.has("community-profile-store.g-0.json"), true);
  assert.equal(port.files.has("community-profile-store.g-1.json"), true);
});

test("every pre-activation interruption leaves the prior generation active and content-free", async () => {
  const config = await configuration();
  for (const failAt of ["write", "staged-read", "link-exists"]) {
    const port = memoryPort();
    const initial = await writeLocalProfileStore(config, currentSource(0), {
      expectedGeneration: null,
      port,
      nonce: "initial",
    });
    assert.equal(initial.ok, true);
    port.failAt = failAt;
    const failed = await writeLocalProfileStore(config, currentSource(1), {
      expectedGeneration: 0,
      port,
      nonce: `failure_${failAt.replace("-", "_")}`,
    });
    assert.equal(failed.ok, false);
    assert.doesNotMatch(JSON.stringify(failed), /PRIVATE_|synthetic_empty|profile_generation/u);
    port.failAt = null;
    const loaded = await loadLocalProfileStore(config, { port });
    assert.equal(loaded.ok, true);
    if (!loaded.ok || loaded.status === "absent") continue;
    assert.equal(loaded.value.internalState.generation, 0);
    assert.equal(port.files.has("community-profile-store.g-0.json"), true);
  }
});

test("post-activation uncertainty is explicit while the prior valid generation remains", async () => {
  const config = await configuration();
  for (const failAt of ["sync", "final-read"]) {
    const port = memoryPort();
    assert.equal(
      (
        await writeLocalProfileStore(config, currentSource(0), {
          expectedGeneration: null,
          port,
          nonce: "initial",
        })
      ).ok,
      true,
    );
    port.failAt = failAt;
    const failed = await writeLocalProfileStore(config, currentSource(1), {
      expectedGeneration: 0,
      port,
      nonce: `uncertain_${failAt.replace("-", "_")}`,
    });
    assert.deepEqual(failed, {
      ok: false,
      error: { category: "commit-outcome-unknown", retryable: true },
    });
    assert.equal(port.files.has("community-profile-store.g-0.json"), true);
    port.failAt = null;
    const recovered = await loadLocalProfileStore(config, { port });
    assert.equal(recovered.ok, true);
    if (!recovered.ok || recovered.status === "absent") continue;
    assert.equal(recovered.value.internalState.generation, 1);
  }
});

test("load recovers below corrupt generations, ignores orphan staging, and bounds scanning", async () => {
  const config = await configuration();
  const port = memoryPort();
  port.files.set("community-profile-store.g-0.json", Buffer.from(currentSource(0)));
  port.files.set("community-profile-store.g-2.json", Buffer.from("CORRUPT_PROFILE_CANARY"));
  port.files.set(".community-profile-store.g-3.orphan.tmp", Buffer.from(currentSource(3)));
  const loaded = await loadLocalProfileStore(config, { port });
  assert.equal(loaded.ok, true);
  if (!loaded.ok || loaded.status === "absent") return;
  assert.equal(loaded.status, "recovered");
  assert.equal(loaded.value.internalState.generation, 0);
  assert.equal(loaded.nextGeneration, 3);
  assert.equal(loaded.invalidCandidateCount, 1);
  assert.equal(loaded.orphanTemporaryCount, 1);
  assert.equal(loaded.maintenanceRequired, true);

  const crowded = memoryPort();
  for (let index = 0; index < 65; index += 1)
    crowded.files.set(`unknown-${String(index)}`, new Uint8Array());
  assert.deepEqual(await loadLocalProfileStore(config, { port: crowded }), {
    ok: false,
    error: { category: "limit-exceeded", retryable: false },
  });

  const unsupported = memoryPort();
  const unsupportedValue = JSON.parse(currentSource(0));
  unsupportedValue.storeSchemaVersion = "9.0.0";
  unsupported.files.set(
    "community-profile-store.g-0.json",
    Buffer.from(JSON.stringify(unsupportedValue)),
  );
  assert.deepEqual(await loadLocalProfileStore(config, { port: unsupported }), {
    ok: false,
    error: { category: "unsupported-version", retryable: false },
  });
});

test("load performs the explicit legacy migration through the same atomic activation", async () => {
  const config = await configuration();
  const port = memoryPort();
  port.files.set("community-profile-store.g-0.json", Buffer.from(legacySource(0)));
  assert.deepEqual(await loadLocalProfileStore(config, { port }), {
    ok: false,
    error: { category: "migration-required", retryable: false },
  });
  const migrated = await loadLocalProfileStore(config, {
    port,
    migrationValidatedAt: "2026-09-05T10:00:01Z",
    nonce: "migration",
  });
  assert.equal(migrated.ok, true);
  if (!migrated.ok || migrated.status === "absent") return;
  assert.equal(migrated.status, "migrated");
  assert.equal(migrated.value.internalState.generation, 1);
  assert.equal(migrated.value.internalState.migratedFromStoreSchemaVersion, "0.0.0");
  assert.equal(port.files.has("community-profile-store.g-0.json"), true);
  assert.equal(port.files.has("community-profile-store.g-1.json"), true);
});

test("persistence implementation has no network, subprocess, logging, or repository authority", async () => {
  const sources = await Promise.all(
    [
      "local-profile-store.ts",
      "local-profile-store-config.ts",
      "community-profile-store-format.ts",
    ].map((name) =>
      readFile(new URL(`../../packages/community-provider/src/${name}`, import.meta.url), "utf8"),
    ),
  );
  assert.doesNotMatch(
    sources.join("\n"),
    /node:(?:child_process|net|http|https)|\b(?:fetch|spawn|console\.)\b/u,
  );
});
