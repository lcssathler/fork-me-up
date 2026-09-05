import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadLocalProfileStore,
  resolveLocalProfileStoreConfig,
  writeLocalProfileStore,
} from "@fork-me-up/community-provider";

const fixture = JSON.parse(
  await readFile(
    new URL("../fixtures/internal/community-profile-store/0.1.0/valid/empty.json", import.meta.url),
    "utf8",
  ),
);

function source(generation, profileVersion) {
  const value = globalThis.structuredClone(fixture);
  value.profileVersion = profileVersion;
  value.internalState.generation = generation;
  value.internalState.updatedAt = `2026-09-05T10:00:0${String(generation)}Z`;
  value.internalState.lastValidatedAt = value.internalState.updatedAt;
  return `${JSON.stringify(value)}\n`;
}

test("FMU-E-011: write confirmation follows readback and failure preserves prior valid state", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "fork-me-up-e011-"));
  const directory = path.join(root, "store");
  await mkdir(directory);
  context.after(async () => rm(root, { recursive: true, force: true }));
  const config = await resolveLocalProfileStoreConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      directoryPath: directory,
      storeId: "store_synthetic_empty",
      subjectRef: "subject_synthetic_owner",
    }),
  );
  assert.equal(config.ok, true);
  if (!config.ok) return;

  const initial = await writeLocalProfileStore(config.value, source(0, "profile_prior"), {
    expectedGeneration: null,
    nonce: "initial",
  });
  assert.equal(initial.ok, true);
  const invalid = JSON.parse(source(1, "profile_invalid"));
  invalid.internalState.createdAt = "2026-09-05T10:00:02Z";
  const failed = await writeLocalProfileStore(config.value, JSON.stringify(invalid), {
    expectedGeneration: 0,
    nonce: "failed",
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.ok && failed.status === "committed", false);
  const afterFailure = await loadLocalProfileStore(config.value);
  assert.equal(afterFailure.ok, true);
  if (!afterFailure.ok || afterFailure.status === "absent") return;
  assert.equal(afterFailure.value.profileVersion, "profile_prior");
  assert.equal(afterFailure.value.internalState.generation, 0);

  const succeeded = await writeLocalProfileStore(config.value, source(1, "profile_confirmed"), {
    expectedGeneration: 0,
    nonce: "success",
  });
  assert.equal(succeeded.ok, true);
  if (!succeeded.ok) return;
  assert.equal(succeeded.status, "committed");
  const confirmed = await loadLocalProfileStore(config.value);
  assert.equal(confirmed.ok, true);
  if (!confirmed.ok || confirmed.status === "absent") return;
  assert.equal(confirmed.value.profileVersion, "profile_confirmed");
  assert.equal(confirmed.value.internalState.generation, 1);
});
