import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  loadDeveloperProfileFromPortableExport,
  resolveClaimResponsePolicy,
} from "../packages/core/src/index.ts";

const fixtureRoot = new URL("../fixtures/developer-profile/0.1.0/", import.meta.url);

/** @param {string} name */
async function loadProfile(name) {
  const source = JSON.parse(await readFile(new URL(name, fixtureRoot), "utf8"));
  const result = loadDeveloperProfileFromPortableExport(source);
  assert.equal(result.ok, true);
  return result.value.profile;
}

test("FMU-E-001: demonstrated Java selects concise peer-level intent", async () => {
  const profile = await loadProfile("demonstrated.json");
  const result = resolveClaimResponsePolicy(profile.claims, profile.preferences);

  assert.equal(result.responsePolicy.mode, "concise");
  assert.deepEqual(result.responsePolicy.analogyCapabilities, []);
  assert.equal(result.claims[0]?.capability, "language.java");
  assert.equal(result.claims[0]?.state, "demonstrated");
  assert.equal(result.claims[0]?.observedDepth, "practical-use");
});

test("FMU-E-002: insufficient CI evidence selects teach-while-doing safeguards", async () => {
  const profile = await loadProfile("insufficient-evidence.json");
  const result = resolveClaimResponsePolicy(profile.claims, profile.preferences);

  assert.deepEqual(result.responsePolicy, {
    mode: "teach-while-doing",
    explainPurposeBeforeCommands: true,
    includeExpectedResult: true,
    includeRiskAndRollback: true,
    analogyCapabilities: [],
    questionBudget: 1,
  });
  assert.equal(result.claims[0]?.capability, "delivery.ci.github-actions");
});

test("FMU-E-003: Angular evidence supports only a bounded React analogy", async () => {
  const profile = await loadProfile("adjacent.json");
  const reactClaim = profile.claims.find((claim) => claim.capability === "framework.react");
  assert.ok(reactClaim);

  const result = resolveClaimResponsePolicy([reactClaim], profile.preferences);

  assert.equal(result.responsePolicy.mode, "analogy");
  assert.deepEqual(result.responsePolicy.analogyCapabilities, ["framework.angular"]);
  assert.equal(result.claims[0]?.state, "adjacent");
  assert.match(result.claims[0]?.basis.rationale ?? "", /not established/u);
  assert.equal(
    result.claims.some(
      (claim) => claim.capability === "framework.react" && claim.state === "demonstrated",
    ),
    false,
  );
});

test("FMU-E-004: absent evidence remains insufficient-evidence, never ignorance", async () => {
  const profile = await loadProfile("insufficient-evidence.json");
  const result = resolveClaimResponsePolicy(profile.claims, profile.preferences);

  assert.equal(result.claims[0]?.state, "insufficient-evidence");
  assert.doesNotMatch(JSON.stringify(result), /does-not-know|ignor(?:e|ance|ant)/iu);
  assert.equal(result.responsePolicy.mode, "teach-while-doing");
});
