import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  loadLocalProfileStore,
  refreshLocalRepositories,
  resolveLocalProfileStoreConfig,
  runOwnerProfileOperation,
  saveOwnerDerivation,
} from "@fork-me-up/community-provider";
import { refreshFixture, refreshRequest, refreshValue } from "./incremental-refresh-fixture.mjs";

/** @param {import("node:test").TestContext} context */
export async function ownerFixture(context) {
  const source = await refreshFixture(context);
  const directory = path.join(source.root, "store");
  await mkdir(directory);
  const store = {
    configVersion: "0.1.0",
    directoryPath: directory,
    storeId: "store_synthetic",
    subjectRef: "subject_synthetic",
  };
  const resolved = await resolveLocalProfileStoreConfig(JSON.stringify(store));
  assert.equal(resolved.ok, true);
  if (!resolved.ok) throw new Error("configuration failed");
  const configuration = resolved.value;
  const session = source.session();
  const derived = refreshValue(
    await refreshLocalRepositories(session, refreshRequest()),
  ).derivation;
  assert.ok(derived);
  assert.equal((await saveOwnerDerivation(configuration, derived, saveRequest(null))).ok, true);
  async function load() {
    const result = await loadLocalProfileStore(configuration);
    assert.ok(result.ok && result.value);
    if (!result.ok || result.value === null) throw new Error("load failed");
    return result.value;
  }
  const initial = await load();
  const claimId = initial.profile.claims[0]?.claimId;
  assert.ok(claimId);
  /** @param {"correct" | "dispute" | "reject"} operation @param {number} expectedGeneration @param {import("@fork-me-up/community-provider").OwnerWorkflowOptions} [options] */
  function correct(operation, expectedGeneration, options = {}) {
    return runOwnerProfileOperation(
      configuration,
      JSON.stringify({
        version: "0.1.0",
        operation,
        claimId,
        expectedGeneration,
        at: "2026-09-07T12:00:01Z",
        summary: "OWNER_NOTE_CANARY",
      }),
      options,
    );
  }
  return { ...source, store, configuration, session, derived, initial, claimId, load, correct };
}
/** @param {number | null} expectedGeneration @param {string} [at] */
export function saveRequest(expectedGeneration, at = "2026-09-07T12:00:00Z") {
  return JSON.stringify({ version: "0.1.0", expectedGeneration, at });
}
