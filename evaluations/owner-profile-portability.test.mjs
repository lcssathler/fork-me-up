import assert from "node:assert/strict";
import test from "node:test";
import { intersectDemandProfileWithDeveloperProfile } from "@fork-me-up/core";
import {
  loadLocalProfileStore,
  runOwnerPortabilityOperation,
} from "@fork-me-up/community-provider";
import { portabilityFixture, importRequest } from "../tests/helpers/owner-portability-fixture.mjs";

test("FMU-E-015: exported/imported owner correction stays effective while portable output omits private canaries", async (context) => {
  const fixture = await portabilityFixture(context);
  const exported = await fixture.exported();
  assert.doesNotMatch(
    exported.source + JSON.stringify(exported.result),
    /CANARY|main.ts|extra.ts|directoryPath/u,
  );
  const destination = await fixture.destinationStore();
  assert.equal(
    (await runOwnerPortabilityOperation(destination.configuration, importRequest(exported.value)))
      .ok,
    true,
  );
  const loaded = await loadLocalProfileStore(destination.configuration);
  assert.ok(loaded.ok && loaded.value);
  if (!loaded.ok || loaded.value === null) return;
  const disputed = loaded.value.profile.claims.find((item) => item.state === "disputed");
  assert.ok(disputed);
  const result = intersectDemandProfileWithDeveloperProfile(
    {
      schemaVersion: "0.1.0",
      kind: "demand-profile",
      demandId: "demand_portability",
      project: {
        projectRef: disputed.projectRef,
        metadataStatus: "unavailable",
        metadataRevisionRef: null,
      },
      task: { summary: "Synthetic portable profile task", purpose: "coding-assistance" },
      capabilities: [
        { capability: disputed.capability, relevance: "required", basis: "task-input" },
      ],
      generatedAt: "2026-09-07T12:00:05Z",
    },
    { profileVersion: loaded.value.profileVersion, profile: loaded.value.profile },
  );
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.value.claims.length, 1);
  assert.equal(result.value.claims[0]?.state, "disputed");
  assert.equal(result.value.responsePolicy.mode, "teach-while-doing");
  assert.doesNotMatch(JSON.stringify(result), /CANARY/u);
});
