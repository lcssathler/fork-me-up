import { isPortableProfileExport } from "@fork-me-up/protocol";

/** @typedef {import("@fork-me-up/protocol").Evidence} Evidence */
/** @typedef {import("@fork-me-up/protocol").Claim} Claim */
/** @typedef {import("@fork-me-up/community-provider").EvidenceClaimDerivationSnapshot} Snapshot */
/**
 * @typedef {{caseId: string, scenario: string, capability: string,
 * files: readonly {path: string}[], duplicatePeer: boolean,
 * expected: {state: string, maximumDepth: string | null, maximumConfidence: string,
 * authorship: string, evidenceCount: number}}} QualityCaseDefinition
 */
/** @typedef {{subjectRef: string, repositoryId: string, projectRef: string,
 * peerRepositoryId: string, peerProjectRef: string, observedAt: string}} QualityFixed */
/**
 * @typedef {{caseId: string, scenario: string, capability: string,
 * outcome: "accepted" | "corrected" | "rejected", falseDemonstrated: boolean,
 * attributionCorrect: boolean, expectedEvidenceCount: number, actualEvidenceCount: number,
 * matchedEvidenceCount: number, unknownEvidenceCount: number, unexpectedUnknownCount: number,
 * missingEvidenceCount: number, extraEvidenceCount: number, ceilingViolations: number,
 * actual: {state: string | null, observedDepth: string | null, confidence: string | null,
 * scope: string | null, authorship: string[]} | null, failureCodes: string[]}} QualityCaseScore
 */

const scenarios = new Set([
  "direct-single",
  "direct-repeated",
  "coauthor",
  "pair-work",
  "squash",
  "bot",
  "shared",
  "unknown",
  "uncommitted",
  "fork",
  "template",
  "generated",
  "vendored",
  "tutorial",
  "duplicated",
  "uncertain",
  "ai-assisted-single",
  "human-claimed-single",
  "ai-assisted-repeated",
  "ai-claimed-unknown",
  "committer-only",
  "bot-with-human",
  "human-with-bot",
  "human-bot-committer",
]);
const states = ["demonstrated", "adjacent", "self-declared", "insufficient-evidence", "disputed"];
const depths = [null, "exposure", "practical-use", "demonstrated-depth"];
const confidences = ["low", "medium", "high"];
const authorships = ["attributed", "coauthored", "bot", "unknown", "not-applicable"];

/**
 * Compare an output to the frozen oracle, without invoking a source pipeline or deriving labels.
 * Schema validation alone cannot satisfy the oracle: valid but wrong outputs fail independently.
 * @param {QualityCaseDefinition} definition
 * @param {QualityFixed} fixed
 * @param {unknown} snapshot
 * @returns {QualityCaseScore}
 */
export function scoreQualityCase(definition, fixed, snapshot) {
  const language =
    definition.capability === "language.typescript"
      ? "typescript"
      : definition.capability === "language.python"
        ? "python"
        : null;
  const validOracle =
    language !== null &&
    scenarios.has(definition.scenario) &&
    definition.caseId === `${language}-${definition.scenario}` &&
    definition.files.length === definition.expected.evidenceCount &&
    definition.files.length > 0 &&
    definition.files.length <= 2 &&
    new Set(definition.files.map((file) => file.path)).size === definition.files.length &&
    ["demonstrated", "insufficient-evidence"].includes(definition.expected.state) &&
    depths.includes(definition.expected.maximumDepth) &&
    confidences.includes(definition.expected.maximumConfidence) &&
    authorships.includes(definition.expected.authorship);
  /** @type {QualityCaseScore} */
  const report = {
    caseId: validOracle ? definition.caseId : "invalid-case",
    scenario: validOracle ? definition.scenario : "invalid",
    capability: validOracle ? definition.capability : "invalid",
    outcome: "corrected",
    falseDemonstrated: false,
    attributionCorrect: false,
    expectedEvidenceCount: validOracle ? definition.expected.evidenceCount : 0,
    actualEvidenceCount: 0,
    matchedEvidenceCount: 0,
    unknownEvidenceCount: 0,
    unexpectedUnknownCount: 0,
    missingEvidenceCount: validOracle ? definition.expected.evidenceCount : 0,
    extraEvidenceCount: 0,
    ceilingViolations: 0,
    actual: null,
    failureCodes: [],
  };
  if (!validOracle) return { ...report, failureCodes: ["invalid-oracle"] };
  try {
    return scoreSnapshot(definition, fixed, snapshot, report);
  } catch {
    // Native diagnostics and malformed getters/objects are never reflected into reports.
    return { ...report, failureCodes: ["malformed-snapshot"] };
  }
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @returns {value is Snapshot} */
function hasScorableRecords(value) {
  if (
    !isRecord(value) ||
    !Array.isArray(value["evidence"]) ||
    !Array.isArray(value["claims"]) ||
    value["evidence"].length > 100 ||
    value["claims"].length > 100 ||
    !Array.isArray(value["projectRefs"])
  )
    return false;
  return (
    value["evidence"].every(
      (item) =>
        isRecord(item) &&
        isRecord(item["source"]) &&
        isRecord(item["authorAssessment"]) &&
        typeof item["evidenceId"] === "string" &&
        typeof item["capabilitySignal"] === "string" &&
        typeof item["source"]["sourceRelativeRef"] === "string" &&
        typeof item["source"]["repositoryRef"] === "string" &&
        typeof item["authorAssessment"]["state"] === "string",
    ) &&
    value["claims"].every(
      (item) =>
        isRecord(item) &&
        typeof item["claimId"] === "string" &&
        typeof item["capability"] === "string" &&
        typeof item["state"] === "string" &&
        typeof item["confidence"] === "string" &&
        isRecord(item["basis"]) &&
        Array.isArray(item["basis"]["evidenceRefs"]),
    )
  );
}

/**
 * @param {QualityCaseDefinition} definition @param {QualityFixed} fixed
 * @param {unknown} input @param {QualityCaseScore} empty
 * @returns {QualityCaseScore}
 */
function scoreSnapshot(definition, fixed, input, empty) {
  if (input === null) return { ...empty, failureCodes: ["missing-snapshot"] };
  if (!hasScorableRecords(input)) return { ...empty, failureCodes: ["malformed-snapshot"] };
  const failureCodes = new Set();
  if (!validProfile(input)) failureCodes.add("invalid-profile-schema");
  if (
    input.kind !== "evidence-claim-derivation-snapshot" ||
    input.derivationVersion !== "0.1.0" ||
    input.subjectRef !== fixed.subjectRef ||
    input.sourceObservedAt !== fixed.observedAt ||
    input.derivedAt !== fixed.observedAt
  )
    failureCodes.add("snapshot-metadata-mismatch");
  const repositories = definition.duplicatePeer
    ? [fixed.repositoryId, fixed.peerRepositoryId]
    : [fixed.repositoryId];
  const projects = definition.duplicatePeer
    ? [fixed.projectRef, fixed.peerProjectRef]
    : [fixed.projectRef];
  let rejected =
    input.evidence.some(
      (item) =>
        !repositories.includes(item.source.repositoryRef) ||
        item.capabilitySignal !== definition.capability,
    ) ||
    input.claims.some(
      (item) =>
        !projects.includes(item.projectRef ?? "") || item.capability !== definition.capability,
    ) ||
    input.projectRefs.some((project) => !projects.includes(project));
  if (rejected) failureCodes.add("unexpected-capability-or-project");
  if (!sameMembers(input.projectRefs, projects)) failureCodes.add("project-set-mismatch");
  const duplicateEvidenceIds =
    new Set(input.evidence.map((item) => item.evidenceId)).size !== input.evidence.length;
  if (duplicateEvidenceIds) failureCodes.add("duplicate-evidence-id");
  if (new Set(input.claims.map((item) => item.claimId)).size !== input.claims.length)
    failureCodes.add("duplicate-claim-id");
  const primary = scoreEvidence(definition, fixed, input.evidence, fixed.repositoryId);
  if (!primary.correct) failureCodes.add("primary-evidence-mismatch");
  const primaryEvidence = input.evidence.filter(
    (item) => item.source.repositoryRef === fixed.repositoryId,
  );
  const attributionCorrect =
    primary.correct &&
    new Set(primaryEvidence.map((item) => item.evidenceId)).size === primaryEvidence.length;
  if (definition.duplicatePeer) {
    const peer = scoreEvidence(definition, fixed, input.evidence, fixed.peerRepositoryId);
    if (!peer.correct) failureCodes.add("peer-evidence-mismatch");
  }
  const primaryClaims = input.claims.filter(
    (item) => item.projectRef === fixed.projectRef && item.capability === definition.capability,
  );
  const falseDemonstrated =
    definition.expected.state !== "demonstrated" &&
    primaryClaims.some((claim) => claim.state === "demonstrated");
  if (falseDemonstrated) {
    failureCodes.add("false-demonstrated");
    rejected = true;
  }
  let ceilingViolations = 0;
  for (let index = 0; index < projects.length; index += 1) {
    const claims = input.claims.filter(
      (item) => item.projectRef === projects[index] && item.capability === definition.capability,
    );
    if (claims.length !== 1) failureCodes.add("claim-count-mismatch");
    for (const claim of claims) {
      if (claim.state !== definition.expected.state) failureCodes.add("claim-state-mismatch");
      if (claim.scope !== "project") failureCodes.add("claim-scope-mismatch");
      const expectedReferences = input.evidence
        .filter((item) => item.source.repositoryRef === repositories[index])
        .map((item) => item.evidenceId);
      if (!sameMembers(claim.basis.evidenceRefs, expectedReferences))
        failureCodes.add("claim-evidence-reference-mismatch");
    }
  }
  // Count violating Claims once, even if both depth and confidence exceed their ceilings.
  for (const claim of input.claims) {
    if (
      !depths.includes(claim.observedDepth) ||
      !confidences.includes(claim.confidence) ||
      depths.indexOf(claim.observedDepth) > depths.indexOf(definition.expected.maximumDepth) ||
      confidences.indexOf(claim.confidence) >
        confidences.indexOf(definition.expected.maximumConfidence)
    )
      ceilingViolations += 1;
  }
  if (ceilingViolations > 0) failureCodes.add("claim-ceiling-violation");
  const claim = primaryClaims.length === 1 ? primaryClaims[0] : undefined;
  return {
    ...empty,
    outcome: rejected ? "rejected" : failureCodes.size > 0 ? "corrected" : "accepted",
    falseDemonstrated,
    attributionCorrect,
    actualEvidenceCount: primary.actual,
    matchedEvidenceCount: primary.matched,
    unknownEvidenceCount: primary.unknown,
    unexpectedUnknownCount: primary.unexpectedUnknown,
    missingEvidenceCount: primary.missing,
    extraEvidenceCount: primary.extra,
    ceilingViolations,
    actual:
      claim === undefined
        ? null
        : {
            state: states.includes(claim.state) ? claim.state : null,
            observedDepth: depths.includes(claim.observedDepth) ? claim.observedDepth : null,
            confidence: confidences.includes(claim.confidence) ? claim.confidence : null,
            scope: ["project", "global"].includes(claim.scope) ? claim.scope : null,
            authorship: primary.authorship,
          },
    failureCodes: [...failureCodes].sort(),
  };
}

/** @param {readonly unknown[]} left @param {readonly unknown[]} right */
function sameMembers(left, right) {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((item) => right.includes(item))
  );
}

/** @param {QualityCaseDefinition} definition @param {QualityFixed} fixed
 * @param {readonly Evidence[]} evidence @param {string} repository */
function scoreEvidence(definition, fixed, evidence, repository) {
  const actual = evidence.filter((item) => item.source.repositoryRef === repository);
  const paths = new Set(definition.files.map((file) => file.path));
  const expectedSubject = ["attributed", "coauthored"].includes(definition.expected.authorship)
    ? fixed.subjectRef
    : null;
  let matched = 0;
  let missing = 0;
  let extra = actual.filter((item) => !paths.has(item.source.sourceRelativeRef)).length;
  for (const path of paths) {
    const records = actual.filter((item) => item.source.sourceRelativeRef === path);
    if (records.length === 0) missing += 1;
    if (records.length > 1) extra += records.length - 1;
    const item = records[0];
    if (
      records.length === 1 &&
      item !== undefined &&
      item.capabilitySignal === definition.capability &&
      item.authorAssessment.state === definition.expected.authorship &&
      item.authorAssessment.subjectRef === expectedSubject
    )
      matched += 1;
  }
  const unknown = actual.filter((item) => item.authorAssessment.state === "unknown").length;
  return {
    actual: actual.length,
    matched,
    missing,
    extra,
    unknown,
    unexpectedUnknown: definition.expected.authorship === "unknown" ? unknown - matched : unknown,
    correct: matched === definition.expected.evidenceCount && missing === 0 && extra === 0,
    authorship: actual
      .map((item) => item.authorAssessment.state)
      .filter((state) => authorships.includes(state))
      .sort(),
  };
}

/** @param {Snapshot} value */
function validProfile(value) {
  return isPortableProfileExport({
    schemaVersion: "0.1.0",
    kind: "portable-profile-export",
    exportId: "export_quality_scoring",
    profileVersion: "profile_quality_scoring",
    subjectRef: value.subjectRef,
    generatedAt: value.derivedAt,
    profile: {
      projectRefs: value.projectRefs,
      evidence: value.evidence,
      claims: value.claims,
      declarations: [],
      corrections: [],
      preferences: {
        explanationMode: "balanced",
        explainPurposeBeforeCommands: true,
        includeExpectedResult: true,
        includeRiskAndRollback: true,
        questionBudget: 1,
      },
    },
    exclusions: {
      credentials: true,
      rawSource: true,
      sourceGrants: true,
      sharingGrants: true,
      internalState: true,
    },
  });
}
