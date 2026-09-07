import assert from "node:assert/strict";
import test from "node:test";
import {
  compileDeveloperContextPacket,
  intersectDemandProfileWithDeveloperProfile,
} from "@fork-me-up/core";
import { nodeLocalProfileStorePort } from "@fork-me-up/community-provider";
import { ownerFixture } from "../tests/helpers/owner-profile-fixture.mjs";

test("FMU-E-005: persisted owner rejection overrides automation without projecting historical knowledge", async (context) => {
  const fixture = await ownerFixture(context);
  await fixture.correct("reject", 0);
  const loaded = await fixture.load();
  const original = fixture.initial.profile.claims[0];
  assert.ok(original);
  const demand = {
    schemaVersion: "0.1.0",
    kind: "demand-profile",
    demandId: "demand_owner",
    project: {
      projectRef: original.projectRef,
      metadataStatus: "unavailable",
      metadataRevisionRef: null,
    },
    task: { summary: "Review a synthetic language task", purpose: "coding-assistance" },
    capabilities: [{ capability: original.capability, relevance: "required", basis: "task-input" }],
    generatedAt: "2026-09-07T12:00:02Z",
  };
  const intersected = intersectDemandProfileWithDeveloperProfile(demand, {
    profileVersion: loaded.profileVersion,
    profile: loaded.profile,
  });
  assert.ok(intersected.ok);
  if (!intersected.ok) return;
  assert.equal(intersected.value.claims.length, 1);
  assert.equal(intersected.value.claims[0]?.state, "disputed");
  assert.equal(intersected.value.responsePolicy.mode, "teach-while-doing");
  const compiled = compileDeveloperContextPacket(intersected.value, {
    packetId: "packet_owner",
    generatedAt: "2026-09-07T12:00:02Z",
    expiresAt: "2026-09-07T12:30:00Z",
    authorization: "allow",
    audience: { class: "local-assistant", consumerId: null },
    disclosureClass: "task-context",
    budget: { maxBytes: 32768, maxTokens: 8192 },
  });
  assert.ok(compiled.ok);
  if (!compiled.ok) return;
  assert.equal(compiled.value.packet.claims.length, 1);
  assert.equal(compiled.value.packet.claims[0]?.state, "disputed");
  assert.doesNotMatch(JSON.stringify(compiled.value.packet), /CANARY|owner_history_|main.ts/u);
  assert.ok(
    loaded.profile.claims.some(
      (item) => item.claimId.startsWith("owner_history_") && item.state === original.state,
    ),
  );
});

test("FMU-E-011: owner success follows verified persistence and failed staging retains the prior correction", async (context) => {
  const fixture = await ownerFixture(context);
  const saved = await fixture.correct("correct", 0);
  assert.ok(saved.ok && saved.status === "saved");
  const before = await fixture.load();
  const failed = await fixture.correct("reject", 1, {
    port: {
      ...nodeLocalProfileStorePort,
      async writeEntryExclusive() {
        throw new Error("PERSISTENCE_CANARY");
      },
    },
  });
  assert.equal(failed.ok, false);
  assert.doesNotMatch(JSON.stringify(failed), /CANARY|saved/u);
  assert.deepEqual(await fixture.load(), before);
});
