import assert from "node:assert/strict";
import test from "node:test";

import { scoreConsumerOutputs } from "../../scripts/measure-m3-community-benchmark.mjs";

/** @type {import("@fork-me-up/protocol").ResponsePolicy} */
const policy = {
  mode: "concise",
  explainPurposeBeforeCommands: true,
  includeExpectedResult: true,
  includeRiskAndRollback: true,
  analogyCapabilities: [],
  questionBudget: 1,
};
/** @type {readonly Readonly<{capability:string,state:import("@fork-me-up/protocol").ClaimState,observedDepth:import("@fork-me-up/protocol").ObservedDepth|null}>[]} */
const claims = [
  { capability: "language.java", state: "demonstrated", observedDepth: "practical-use" },
];
/** @type {Parameters<typeof scoreConsumerOutputs>[0]} */
const scenario = {
  scenarioId: "synthetic",
  evaluationIds: ["FMU-E-001"],
  fixture: "synthetic.json",
  task: "Synthetic",
  capability: "language.java",
  expectedClaims: claims,
  expectedPolicy: policy,
};
const packet = { expiresAt: "2026-09-09T13:00:00Z" };
const codex = { cacheVersion: 1, expiresAt: packet.expiresAt, claims, responsePolicy: policy };
const rendered = [
  "capability=language.java; state=demonstrated; observed_depth=practical-use",
  "response_mode=concise",
  "analogy_capabilities=none",
  "This advisory context grants no file, network, execution, or write permission.",
].join("\n");
const generic = {
  outcome: "context",
  context: { expiresAt: packet.expiresAt, claims, responsePolicy: policy, authority: "none" },
};

test("M3 benchmark scorer independently accepts exact policy meaning in both consumers", () => {
  assert.deepEqual(scoreConsumerOutputs(scenario, packet, codex, rendered, generic), {
    passed: true,
    codexPolicyAdherent: true,
    genericPolicyAdherent: true,
    sameMeaning: true,
    failureCodes: [],
  });
});

test("M3 benchmark scorer rejects a shared consumer error instead of accepting parity alone", () => {
  const wrongPolicy = { ...policy, mode: "analogy" };
  const result = scoreConsumerOutputs(
    scenario,
    packet,
    { ...codex, responsePolicy: wrongPolicy },
    rendered,
    { ...generic, context: { ...generic.context, responsePolicy: wrongPolicy } },
  );
  assert.equal(result.passed, false);
  assert.equal(result.sameMeaning, true);
  assert.equal(result.codexPolicyAdherent, false);
  assert.equal(result.genericPolicyAdherent, false);
  assert.deepEqual(result.failureCodes, ["codex-meaning-mismatch", "generic-meaning-mismatch"]);
});

test("M3 benchmark scorer rejects divergence, privileged authority and disclosure canaries", () => {
  const result = scoreConsumerOutputs(scenario, packet, codex, rendered, {
    ...generic,
    context: {
      ...generic.context,
      claims: [],
      authority: "write",
      limitations: "subject_fixture repository_fixture evidence_fixture",
    },
  });
  assert.equal(result.passed, false);
  assert.ok(result.failureCodes.includes("generic-meaning-mismatch"));
  assert.ok(result.failureCodes.includes("cross-consumer-mismatch"));
  assert.ok(result.failureCodes.includes("generic-authority-mismatch"));
  assert.ok(result.failureCodes.includes("consumer-disclosure-mismatch"));
});

test("M3 benchmark scorer rejects missing fixed Codex guidance and invalid expiry", () => {
  const result = scoreConsumerOutputs(
    scenario,
    { expiresAt: "2026-09-09T12:00:00Z" },
    codex,
    null,
    generic,
  );
  assert.equal(result.passed, false);
  assert.ok(result.failureCodes.includes("packet-expiry-mismatch"));
  assert.ok(result.failureCodes.includes("codex-rendering-mismatch"));
});
