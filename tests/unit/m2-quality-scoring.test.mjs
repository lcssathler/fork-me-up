import assert from "node:assert/strict";
import test from "node:test";

import { scoreQualityCase } from "../../scripts/m2-quality-scoring.mjs";

/** @template Value @param {Value[]} values @param {number} index @returns {Value} */
function at(values, index) {
  const value = values[index];
  assert.notEqual(value, undefined);
  if (value === undefined) throw new Error("Missing synthetic fixture record.");
  return value;
}

const fixed = {
  subjectRef: "subject_quality",
  repositoryId: "repo_primary",
  projectRef: "project_primary",
  peerRepositoryId: "repo_peer",
  peerProjectRef: "project_peer",
  observedAt: "2026-09-07T12:00:00Z",
};

/** @param {Partial<import("../../scripts/m2-quality-scoring.mjs").QualityCaseDefinition>} [overrides] */
function oracle(overrides = {}) {
  return {
    caseId: "typescript-direct-single",
    scenario: "direct-single",
    capability: "language.typescript",
    files: [{ path: "main.ts" }],
    duplicatePeer: false,
    expected: {
      state: "demonstrated",
      maximumDepth: "exposure",
      maximumConfidence: "medium",
      authorship: "attributed",
      evidenceCount: 1,
    },
    ...overrides,
  };
}

/** Hand-constructed outputs test the scorer; no collector, assessor or deriver is invoked.
 * @param {ReturnType<typeof oracle>} [definition] */
function output(definition = oracle()) {
  const repositories = definition.duplicatePeer
    ? [fixed.repositoryId, fixed.peerRepositoryId]
    : [fixed.repositoryId];
  const projects = definition.duplicatePeer
    ? [fixed.projectRef, fixed.peerProjectRef]
    : [fixed.projectRef];
  const evidence = repositories.flatMap((repository, index) =>
    definition.files.map((file, fileIndex) => ({
      schemaVersion: "0.1.0",
      evidenceId: `evidence_${index}_${fileIndex}`,
      kind: "observation",
      capabilitySignal: definition.capability,
      source: {
        class: "selected-local-repository",
        sourceRelativeRef: file.path,
        repositoryRef: repository,
        revisionRef: "revision_test",
        visibility: "local-only",
      },
      authorAssessment: {
        state: definition.expected.authorship,
        subjectRef: ["attributed", "coauthored"].includes(definition.expected.authorship)
          ? fixed.subjectRef
          : null,
      },
      freshness: { observedAt: fixed.observedAt, collectedAt: fixed.observedAt },
      strength: "moderate",
      limitations: ["Synthetic private limitation."],
      extractor: { name: "community.language-signal", version: "0.1.0" },
      invalidation: { rule: "source-changed", fingerprint: `fingerprint_${index}_${fileIndex}` },
    })),
  );
  const claims = projects.map((project, index) => ({
    schemaVersion: "0.1.0",
    claimId: `claim_${index}`,
    capability: definition.capability,
    state: definition.expected.state,
    observedDepth: definition.expected.maximumDepth,
    confidence: definition.expected.maximumConfidence,
    scope: "project",
    projectRef: project,
    basis: {
      kind: definition.expected.state === "demonstrated" ? "evidence" : "insufficient-evidence",
      evidenceRefs: evidence
        .filter((item) => item.source.repositoryRef === repositories[index])
        .map((item) => item.evidenceId),
      adjacentFrom: [],
      rationale: null,
      declarationRef: null,
      correctionRef: null,
      correctionSummary: null,
    },
    limitations: ["Synthetic private limitation."],
    freshness: { observedThrough: fixed.observedAt, stale: false },
  }));
  return {
    kind: "evidence-claim-derivation-snapshot",
    derivationVersion: "0.1.0",
    subjectRef: fixed.subjectRef,
    sourceObservedAt: fixed.observedAt,
    derivedAt: fixed.observedAt,
    projectRefs: projects,
    evidence,
    claims,
    claimFingerprints: [],
    invalidation: { previousDerivationVersion: null, evidence: [], claims: [] },
  };
}

function unknownOracle() {
  return oracle({
    caseId: "typescript-unknown",
    scenario: "unknown",
    expected: {
      state: "insufficient-evidence",
      maximumDepth: null,
      maximumConfidence: "low",
      authorship: "unknown",
      evidenceCount: 1,
    },
  });
}

test("quality scorer accepts only complete oracle observations and conservatively lower ceilings", () => {
  const snapshot = output();
  const result = scoreQualityCase(oracle(), fixed, snapshot);
  assert.equal(result.outcome, "accepted");
  assert.equal(result.attributionCorrect, true);
  assert.equal(result.matchedEvidenceCount, 1);
  assert.deepEqual(result.failureCodes, []);
  assert.deepEqual(result.actual, {
    state: "demonstrated",
    observedDepth: "exposure",
    confidence: "medium",
    scope: "project",
    authorship: ["attributed"],
  });
  at(snapshot.claims, 0).confidence = "low";
  assert.equal(scoreQualityCase(oracle(), fixed, snapshot).outcome, "accepted");
  const unknown = unknownOracle();
  const unknownResult = scoreQualityCase(unknown, fixed, output(unknown));
  assert.equal(unknownResult.outcome, "accepted");
  assert.equal(unknownResult.unknownEvidenceCount, 1);
  assert.equal(unknownResult.unexpectedUnknownCount, 0);
  const unexpectedUnknown = output(unknown);
  unexpectedUnknown.evidence.push({
    ...globalThis.structuredClone(at(unexpectedUnknown.evidence, 0)),
    evidenceId: "evidence_extra_unknown",
    source: { ...at(unexpectedUnknown.evidence, 0).source, sourceRelativeRef: "extra.ts" },
  });
  assert.equal(scoreQualityCase(unknown, fixed, unexpectedUnknown).unexpectedUnknownCount, 1);
});

test("quality scorer retains null, empty and malformed outputs as failures", () => {
  const empty = output();
  empty.claims = [];
  empty.evidence = [];
  for (const snapshot of [
    null,
    undefined,
    {},
    empty,
    { evidence: [null], claims: [] },
    { evidence: [], claims: [null] },
    { evidence: [], claims: [], projectRefs: [null] },
  ]) {
    const result = scoreQualityCase(oracle(), fixed, snapshot);
    assert.notEqual(result.outcome, "accepted");
    assert.equal(result.attributionCorrect, false);
    assert.equal(result.expectedEvidenceCount, 1);
    assert.equal(result.matchedEvidenceCount, 0);
    assert.equal(result.missingEvidenceCount, 1);
    assert.ok(result.failureCodes.length > 0);
  }
});

test("quality scorer rejects false demonstrated without hiding its actual state", () => {
  const definition = unknownOracle();
  const snapshot = output(definition);
  at(snapshot.claims, 0).state = "demonstrated";
  at(snapshot.claims, 0).observedDepth = "exposure";
  at(snapshot.claims, 0).basis.kind = "evidence";
  const result = scoreQualityCase(definition, fixed, snapshot);
  assert.equal(result.outcome, "rejected");
  assert.equal(result.falseDemonstrated, true);
  assert.equal(result.actual?.state, "demonstrated");
  assert.equal(result.ceilingViolations, 1);
});

test("quality scorer distinguishes missing, extra and duplicated source Evidence", () => {
  const missing = output();
  missing.evidence = [];
  at(missing.claims, 0).basis.evidenceRefs = [];
  assert.equal(scoreQualityCase(oracle(), fixed, missing).missingEvidenceCount, 1);
  const extra = output();
  extra.evidence.push({
    ...globalThis.structuredClone(at(extra.evidence, 0)),
    evidenceId: "evidence_extra",
    source: { ...at(extra.evidence, 0).source, sourceRelativeRef: "extra.ts" },
  });
  const extraResult = scoreQualityCase(oracle(), fixed, extra);
  assert.equal(extraResult.extraEvidenceCount, 1);
  assert.equal(extraResult.actualEvidenceCount, 2);
  assert.equal(extraResult.attributionCorrect, false);
  for (const sameId of [true, false]) {
    const duplicate = output();
    duplicate.evidence.push({
      ...globalThis.structuredClone(at(duplicate.evidence, 0)),
      evidenceId: sameId ? at(duplicate.evidence, 0).evidenceId : "evidence_duplicate",
    });
    const result = scoreQualityCase(oracle(), fixed, duplicate);
    assert.equal(result.extraEvidenceCount, 1);
    assert.equal(result.matchedEvidenceCount, 0);
    assert.equal(result.attributionCorrect, false);
    assert.notEqual(result.outcome, "accepted");
  }
});

test("quality scorer requires source path, capability, authorship and subject association", () => {
  const path = output();
  at(path.evidence, 0).source.sourceRelativeRef = "different.ts";
  const pathResult = scoreQualityCase(oracle(), fixed, path);
  assert.equal(pathResult.missingEvidenceCount, 1);
  assert.equal(pathResult.extraEvidenceCount, 1);
  const capability = output();
  at(capability.evidence, 0).capabilitySignal = "language.python";
  assert.equal(scoreQualityCase(oracle(), fixed, capability).outcome, "rejected");
  const author = output();
  at(author.evidence, 0).authorAssessment.state = "unknown";
  at(author.evidence, 0).authorAssessment.subjectRef = null;
  const authorResult = scoreQualityCase(oracle(), fixed, author);
  assert.equal(authorResult.attributionCorrect, false);
  assert.equal(authorResult.unexpectedUnknownCount, 1);
  const subject = output();
  at(subject.evidence, 0).authorAssessment.subjectRef = "subject_wrong";
  assert.equal(scoreQualityCase(oracle(), fixed, subject).matchedEvidenceCount, 0);
});

test("quality scorer requires one Claim, exact state, schema validity and project scope", () => {
  const duplicate = output();
  duplicate.claims.push({
    ...globalThis.structuredClone(at(duplicate.claims, 0)),
    claimId: "claim_duplicate",
  });
  assert.ok(
    scoreQualityCase(oracle(), fixed, duplicate).failureCodes.includes("claim-count-mismatch"),
  );
  const state = output();
  at(state.claims, 0).state = "insufficient-evidence";
  at(state.claims, 0).observedDepth = null;
  at(state.claims, 0).basis.kind = "insufficient-evidence";
  assert.ok(scoreQualityCase(oracle(), fixed, state).failureCodes.includes("claim-state-mismatch"));
  const scope = output();
  at(scope.claims, 0).scope = "global";
  assert.ok(scoreQualityCase(oracle(), fixed, scope).failureCodes.includes("claim-scope-mismatch"));
  const schema = output();
  at(schema.evidence, 0).schemaVersion = "999.0.0";
  assert.ok(
    scoreQualityCase(oracle(), fixed, schema).failureCodes.includes("invalid-profile-schema"),
  );
  const metadata = output();
  metadata.subjectRef = "subject_different";
  assert.ok(
    scoreQualityCase(oracle(), fixed, metadata).failureCodes.includes("snapshot-metadata-mismatch"),
  );
});

test("quality scorer counts each ceiling-violating Claim once", () => {
  const snapshot = output();
  at(snapshot.claims, 0).confidence = "high";
  at(snapshot.claims, 0).observedDepth = "demonstrated-depth";
  const result = scoreQualityCase(oracle(), fixed, snapshot);
  assert.equal(result.ceilingViolations, 1);
  assert.notEqual(result.outcome, "accepted");
});

test("quality scorer accepts complete auxiliary peer output outside primary denominators", () => {
  const definition = oracle({
    caseId: "typescript-duplicated",
    scenario: "duplicated",
    duplicatePeer: true,
    expected: { ...oracle().expected, maximumConfidence: "low" },
  });
  const snapshot = output(definition);
  const result = scoreQualityCase(definition, fixed, snapshot);
  assert.equal(result.outcome, "accepted");
  assert.equal(result.actualEvidenceCount, 1);
  assert.equal(result.matchedEvidenceCount, 1);
  at(snapshot.claims, 1).confidence = "high";
  assert.equal(scoreQualityCase(definition, fixed, snapshot).ceilingViolations, 1);
  at(snapshot.claims, 1).confidence = "low";
  snapshot.evidence.pop();
  const missingPeer = scoreQualityCase(definition, fixed, snapshot);
  assert.ok(missingPeer.failureCodes.includes("peer-evidence-mismatch"));
  assert.equal(missingPeer.attributionCorrect, true);
  assert.notEqual(missingPeer.outcome, "accepted");
});

test("quality scorer rejects unexpected projects and cross-project Claim support", () => {
  const extra = output();
  extra.projectRefs.push("project_unexpected");
  assert.equal(scoreQualityCase(oracle(), fixed, extra).outcome, "rejected");
  const repository = output();
  at(repository.evidence, 0).source.repositoryRef = "repo_unexpected";
  assert.equal(scoreQualityCase(oracle(), fixed, repository).outcome, "rejected");
  const capability = output();
  at(capability.claims, 0).capability = "language.python";
  assert.equal(scoreQualityCase(oracle(), fixed, capability).outcome, "rejected");
  const definition = oracle({
    caseId: "typescript-duplicated",
    scenario: "duplicated",
    duplicatePeer: true,
  });
  const snapshot = output(definition);
  at(snapshot.claims, 0).basis.evidenceRefs = at(snapshot.claims, 1).basis.evidenceRefs;
  const result = scoreQualityCase(definition, fixed, snapshot);
  assert.ok(result.failureCodes.includes("claim-evidence-reference-mismatch"));
  assert.notEqual(result.outcome, "accepted");
});

test("quality scorer preserves the two-record denominator when one observation is lost", () => {
  const definition = oracle({
    caseId: "typescript-direct-repeated",
    scenario: "direct-repeated",
    files: [{ path: "main.ts" }, { path: "second.ts" }],
    expected: { ...oracle().expected, maximumDepth: "practical-use", evidenceCount: 2 },
  });
  const snapshot = output(definition);
  snapshot.evidence.pop();
  at(snapshot.claims, 0).basis.evidenceRefs.pop();
  const result = scoreQualityCase(definition, fixed, snapshot);
  assert.equal(result.expectedEvidenceCount, 2);
  assert.equal(result.matchedEvidenceCount, 1);
  assert.equal(result.missingEvidenceCount, 1);
  assert.equal(result.attributionCorrect, false);
});

test("quality scorer serializes only allowlisted observations and fixed failure codes", () => {
  const canary = "PRIVATE_CANARY_source_path_identity";
  const snapshot = output();
  at(snapshot.claims, 0).claimId = canary;
  at(snapshot.claims, 0).limitations = [canary];
  at(snapshot.evidence, 0).limitations = [canary];
  at(snapshot.claims, 0).state = canary;
  at(snapshot.claims, 0).confidence = canary;
  at(snapshot.claims, 0).scope = canary;
  at(snapshot.claims, 0).observedDepth = canary;
  at(snapshot.evidence, 0).authorAssessment.state = canary;
  at(snapshot.evidence, 0).source.sourceRelativeRef = canary;
  const result = scoreQualityCase(oracle(), fixed, snapshot);
  assert.notEqual(result.outcome, "accepted");
  assert.equal(JSON.stringify(result).includes(canary), false);
  assert.deepEqual(result.actual, {
    state: null,
    observedDepth: null,
    confidence: null,
    scope: null,
    authorship: [],
  });
  const hostile = {
    get evidence() {
      throw new Error(canary);
    },
  };
  assert.equal(JSON.stringify(scoreQualityCase(oracle(), fixed, hostile)).includes(canary), false);
  const invalidOracle = oracle({ caseId: canary });
  assert.equal(
    JSON.stringify(scoreQualityCase(invalidOracle, fixed, snapshot)).includes(canary),
    false,
  );
});
