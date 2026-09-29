import assert from "node:assert/strict";
import test from "node:test";
import { runOwnerInterpretationOperation } from "@fork-me-up/community-provider";
import { intersectDemandProfileWithDeveloperProfile } from "@fork-me-up/core";
import { ownerFixture } from "../tests/helpers/owner-profile-fixture.mjs";

test("FMU-E-022 and FMU-E-023 synthetic: transfer has references, scope and an explicit analogy limit", async (context) => {
  const fixture = await ownerFixture(context);
  const source = fixture.initial.profile.claims[0];
  assert.ok(source.projectRef);
  const select = {
    version: "0.1.0",
    operation: "view",
    disclosure: {
      mode: "existing-agent",
      approved: true,
      approvedAt: "2026-09-07T12:00:00Z",
      expiresAt: "2026-09-07T12:05:00Z",
    },
    targetProjectRef: "project_new",
    sourceProjectRefs: [source.projectRef],
    capabilities: [source.capability],
  };
  const options = {
    clock: () => new Date("2026-09-07T12:00:02Z"),
    authorizedProjectRefs: fixture.initial.profile.projectRefs,
    maxObservationAgeMs: 300_000,
  };
  const view = await runOwnerInterpretationOperation(
    fixture.configuration,
    JSON.stringify(select),
    options,
  );
  assert.ok(view.ok && view.status === "view");
  const claim = view.view.claims[0];
  assert.ok(claim);
  const proposal = await runOwnerInterpretationOperation(
    fixture.configuration,
    JSON.stringify({
      ...select,
      operation: "admit",
      expectedGeneration: view.generation,
      viewId: view.viewId,
      proposals: [
        {
          kind: "transfer",
          capability: "concept.new",
          sourceClaimId: claim.claimId,
          evidenceRefs: claim.evidenceRefs,
          relation: "shared-concept",
          transferLimit: "unverified",
        },
      ],
    }),
    options,
  );
  assert.ok(proposal.ok && proposal.status === "admitted");
  assert.equal(proposal.proposals[0].sourceProjectRef, source.projectRef);
  assert.equal(proposal.proposals[0].sourceDepth, source.observedDepth);
  assert.equal(proposal.proposals[0].status, "provisional-owner-review");
  assert.equal(proposal.proposals[0].transferLimit, "unverified");
  const demand = {
    schemaVersion: "0.1.0",
    kind: "demand-profile",
    demandId: "demand_new",
    project: {
      projectRef: "project_new",
      metadataStatus: "unavailable",
      metadataRevisionRef: null,
    },
    task: { summary: "Work in a new project", purpose: "coding-assistance" },
    capabilities: [{ capability: "concept.new", relevance: "required", basis: "task-input" }],
    generatedAt: "2026-09-07T12:00:02Z",
  };
  const intersection = intersectDemandProfileWithDeveloperProfile(demand, {
    profileVersion: fixture.initial.profileVersion,
    profile: fixture.initial.profile,
  });
  assert.equal(intersection.ok, true);
  assert.equal(intersection.value.claims.length, 0);
  assert.equal(intersection.value.unmatchedCapabilities[0].capability, "concept.new");
  assert.doesNotMatch(JSON.stringify(proposal), /main\.ts|sourceRelativeRef|responsePolicy/u);
});
