import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  resolveLocalProfileStoreConfig,
  runOwnerPortabilityOperation,
} from "@fork-me-up/community-provider";
import { ownerFixture } from "./owner-profile-fixture.mjs";

/** @param {import("node:test").TestContext} context */
export async function portabilityFixture(context) {
  const fixture = await ownerFixture(context);
  await fixture.correct("reject", 0);
  const destination = path.join(fixture.root, "exports");
  await mkdir(destination);
  const exportRequest = {
    version: "0.1.0",
    operation: "export",
    at: "2026-09-07T12:00:03Z",
    expectedGeneration: 1,
    exportId: "export_synthetic",
    destinationDirectory: destination,
  };
  async function exported() {
    const result = await runOwnerPortabilityOperation(
      fixture.configuration,
      JSON.stringify(exportRequest),
    );
    assert.ok(result.ok && result.fileName);
    if (!result.ok || result.fileName === null) throw new Error("export failed");
    const source = await readFile(path.join(destination, result.fileName), "utf8");
    return { result, source, value: JSON.parse(source) };
  }
  async function destinationStore() {
    const directoryPath = path.join(fixture.root, "imported");
    await mkdir(directoryPath);
    const store = { ...fixture.store, directoryPath };
    const result = await resolveLocalProfileStoreConfig(JSON.stringify(store));
    assert.ok(result.ok);
    if (!result.ok) throw new Error("configuration failed");
    return { store, configuration: result.value };
  }
  return { ...fixture, destination, exportRequest, exported, destinationStore };
}

export const deleteRequest = JSON.stringify({
  version: "0.1.0",
  operation: "delete",
  confirm: "delete-local-profile",
  cacheScope: "all-local-adapter-caches",
});
/** @param {unknown} portableProfile */
export function importRequest(portableProfile) {
  return JSON.stringify({
    version: "0.1.0",
    operation: "import",
    at: "2026-09-07T12:00:04Z",
    portableProfile,
  });
}
