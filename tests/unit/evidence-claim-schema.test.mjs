import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateClaim, validateEvidence } from "../../scripts/evidence-claim-schema.mjs";
import {
  checkClaimFixtures,
  checkEvidenceFixtures,
} from "../../scripts/evidence-claim-fixtures.mjs";

const evidenceRoot = new URL("../../fixtures/evidence/0.1.0/valid/", import.meta.url);
const claimRoot = new URL("../../fixtures/claim/0.1.0/valid/", import.meta.url);
const [evidenceText, demonstratedText, adjacentText, declaredText, insufficientText, disputedText] =
  await Promise.all([
    readFile(new URL("minimal.json", evidenceRoot), "utf8"),
    readFile(new URL("demonstrated.json", claimRoot), "utf8"),
    readFile(new URL("adjacent.json", claimRoot), "utf8"),
    readFile(new URL("self-declared.json", claimRoot), "utf8"),
    readFile(new URL("insufficient-evidence.json", claimRoot), "utf8"),
    readFile(new URL("disputed.json", claimRoot), "utf8"),
  ]);
const evidence = () => JSON.parse(evidenceText);
const claims = () =>
  [demonstratedText, adjacentText, declaredText, insufficientText, disputedText].map((text) =>
    JSON.parse(text),
  );

test("the committed Evidence and Claim corpora have their expected outcomes", async () => {
  assert.deepEqual(await checkEvidenceFixtures(), { valid: 3, invalid: 6 });
  assert.deepEqual(await checkClaimFixtures(), { valid: 5, invalid: 9 });
});

test("Evidence remains an observation and validation does not mutate records", () => {
  const value = evidence();
  const before = JSON.stringify(value);
  assert.equal(validateEvidence(value), true);
  assert.equal(JSON.stringify(value), before);
  for (const kind of ["claim", "inference", "declaration", null]) {
    const changed = evidence();
    changed.kind = kind;
    assert.equal(validateEvidence(changed), false);
  }
  const claimField = evidence();
  claimField.state = "demonstrated";
  assert.equal(validateEvidence(claimField), false);
});

test("Evidence requires bounded provenance, visibility, authorship and invalidation", () => {
  for (const field of ["source", "authorAssessment", "freshness", "invalidation", "extractor"]) {
    const value = evidence();
    Reflect.deleteProperty(value, field);
    assert.equal(validateEvidence(value), false, `missing ${field}`);
  }
  for (const state of ["bot", "unknown", "not-applicable"]) {
    const value = evidence();
    value.authorAssessment = { state, subjectRef: null };
    assert.equal(validateEvidence(value), true);
  }
  for (const state of ["attributed", "coauthored"]) {
    const value = evidence();
    value.authorAssessment = { state, subjectRef: "subject_synthetic_owner" };
    assert.equal(validateEvidence(value), true);
    value.authorAssessment.subjectRef = null;
    assert.equal(validateEvidence(value), false);
  }
  const privateSource = evidence();
  privateSource.source.class = "selected-private-repository";
  privateSource.source.visibility = "private";
  assert.equal(validateEvidence(privateSource), true);
  privateSource.source.visibility = "public";
  assert.equal(validateEvidence(privateSource), false);
});

test("Evidence rejects absolute, traversal, backslash and personal source references", () => {
  for (const sourceRelativeRef of [
    "/synthetic/file.ts",
    "C:/synthetic/file.ts",
    "../synthetic/file.ts",
    "synthetic/../file.ts",
    "synthetic\\file.ts",
    "owner@example.invalid",
    "synthetic//file.ts",
    "synthetic/file.ts\n",
  ]) {
    const value = evidence();
    value.source.sourceRelativeRef = sourceRelativeRef;
    assert.equal(validateEvidence(value), false, sourceRelativeRef);
  }
});

test("Evidence timestamp validation is calendar-aware and collection cannot precede observation", () => {
  const value = evidence();
  value.freshness.observedAt = "2024-02-29T00:00:00Z";
  value.freshness.collectedAt = "2024-02-29T00:00:00Z";
  assert.equal(validateEvidence(value), true);
  value.freshness.observedAt = "2026-02-29T00:00:00Z";
  assert.equal(validateEvidence(value), false);
  value.freshness.observedAt = "2026-09-05T00:00:01Z";
  value.freshness.collectedAt = "2026-09-05T00:00:00Z";
  assert.equal(validateEvidence(value), false);
});

test("all five Claim states use distinct state-matched provenance without mutation", () => {
  const values = claims();
  for (const value of values) {
    const before = JSON.stringify(value);
    assert.equal(validateClaim(value), true, value.state);
    assert.equal(JSON.stringify(value), before);
  }
  assert.deepEqual(
    values.map((value) => value.basis.kind),
    ["evidence", "adjacency", "declaration", "insufficient-evidence", "dispute"],
  );
});

test("Claim state cannot be relabeled without matching its basis and depth", () => {
  for (const state of ["adjacent", "self-declared", "insufficient-evidence", "disputed"]) {
    const value = claims()[0];
    value.state = state;
    assert.equal(validateClaim(value), false, state);
  }
  for (const state of ["does-not-know", "expert", "senior", null]) {
    const value = claims()[3];
    value.state = state;
    assert.equal(validateClaim(value), false, String(state));
  }
});

test("automated, declaration and dispute provenance constraints fail closed", () => {
  const [demonstrated, adjacent, declared, insufficient, disputed] = claims();
  demonstrated.basis.evidenceRefs = [];
  assert.equal(validateClaim(demonstrated), false);
  adjacent.basis.rationale = null;
  assert.equal(validateClaim(adjacent), false);
  declared.basis.declarationRef = null;
  assert.equal(validateClaim(declared), false);
  insufficient.confidence = "high";
  assert.equal(validateClaim(insufficient), false);
  disputed.basis.correctionRef = null;
  assert.equal(validateClaim(disputed), false);
  const disputedWithoutObservation = claims()[4];
  disputedWithoutObservation.freshness.observedThrough = null;
  assert.equal(validateClaim(disputedWithoutObservation), false);
});

test("project scope requires an opaque project reference and global scope prohibits it", () => {
  const project = claims()[3];
  project.projectRef = null;
  assert.equal(validateClaim(project), false);
  const global = claims()[0];
  global.projectRef = "project_synthetic_a";
  assert.equal(validateClaim(global), false);
  global.scope = "project";
  assert.equal(validateClaim(global), true);
});

test("unknown, raw, policy-bearing and score-like Claim fields are rejected", () => {
  for (const field of ["rawEvidence", "instructions", "seniority", "score", "profile"]) {
    const value = claims()[0];
    value[field] = "FMU_SYNTHETIC_CANARY_DO_NOT_LOG";
    assert.equal(validateClaim(value), false);
  }
  const value = claims()[1];
  value.basis.instructions = "FMU_SYNTHETIC_CANARY_DO_NOT_LOG";
  assert.equal(validateClaim(value), false);
});

test("Evidence and Claim schemas are self-contained and use only local fragment references", async () => {
  const schemaUrls = [
    new URL("../../schemas/evidence/0.1.0.schema.json", import.meta.url),
    new URL("../../schemas/claim/0.1.0.schema.json", import.meta.url),
  ];
  /** @param {unknown} value */
  function visit(value) {
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref") assert.match(child, /^#\//u);
      visit(child);
    }
  }
  for (const url of schemaUrls) visit(JSON.parse(await readFile(url, "utf8")));
});
