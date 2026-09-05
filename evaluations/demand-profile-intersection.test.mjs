import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  intersectDemandProfileWithDeveloperProfile,
  loadDeveloperProfileFromPortableExport,
} from "../packages/core/src/index.ts";

const fixtureRoot = new URL("../fixtures/developer-profile/0.1.0/", import.meta.url);

/** @param {string} name */
async function readProfile(name) {
  return JSON.parse(await readFile(new URL(name, fixtureRoot), "utf8"));
}

test("FMU-E-006: irrelevant expertise is omitted from the task projection", async () => {
  const [java, web] = await Promise.all([
    readProfile("demonstrated.json"),
    readProfile("adjacent.json"),
  ]);
  java.profile.evidence.push(...web.profile.evidence);
  java.profile.claims.push(...web.profile.claims);
  const loaded = loadDeveloperProfileFromPortableExport(java);
  assert.equal(loaded.ok, true);

  const result = intersectDemandProfileWithDeveloperProfile(
    {
      schemaVersion: "0.1.0",
      kind: "demand-profile",
      demandId: "demand_fixture_java_refactoring",
      project: {
        projectRef: "project_fixture_java_refactoring",
        metadataStatus: "unavailable",
        metadataRevisionRef: null,
      },
      task: {
        summary: "Refactor a synthetic Java class",
        purpose: "coding-assistance",
      },
      capabilities: [{ capability: "language.java", relevance: "required", basis: "task-input" }],
      generatedAt: "2026-09-05T13:00:00Z",
    },
    loaded.value,
  );

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.value.claims.map((claim) => claim.capability),
    ["language.java"],
  );
  assert.equal(result.value.responsePolicy.mode, "concise");
  assert.doesNotMatch(
    JSON.stringify(result),
    /framework\.(?:angular|react)|evidence_fixture_angular/u,
  );
  assert.equal("profile" in result.value, false);
});
