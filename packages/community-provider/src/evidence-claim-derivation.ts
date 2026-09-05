import { createHash } from "node:crypto";

import {
  isPortableProfileExport,
  type AuthorAssessmentState,
  type Claim,
  type Confidence,
  type Evidence,
  type ObservedDepth,
} from "@fork-me-up/protocol";

import {
  isIssuedEvidenceSourceRiskSnapshot,
  type EvidenceSourceRiskRecord,
  type EvidenceSourceRiskSnapshot,
} from "./evidence-source-risk-classifier.ts";

export const evidenceClaimDerivationVersion = "0.1.0" as const;
export const evidenceClaimDerivationHardLimits = Object.freeze({
  maximumEvidenceReferencesPerClaim: 32,
  maximumLimitations: 8,
});

export interface EvidenceClaimRepositoryProject {
  readonly repositoryId: string;
  readonly projectRef: string;
}

export interface EvidenceClaimDerivationRequest {
  readonly kind: "evidence-claim-derivation-request";
  readonly derivationVersion: typeof evidenceClaimDerivationVersion;
  readonly sourceObservedAt: string;
  readonly derivedAt: string;
  readonly staleBefore: string;
  readonly repositoryProjects: readonly EvidenceClaimRepositoryProject[];
}

export type EvidenceInvalidationReason = "fingerprint-changed" | "source-unavailable";
export type ClaimInvalidationReason =
  "evidence-invalidated" | "freshness-changed" | "no-longer-supported" | "support-changed";

export interface EvidenceClaimDerivationSnapshot {
  readonly kind: "evidence-claim-derivation-snapshot";
  readonly derivationVersion: typeof evidenceClaimDerivationVersion;
  readonly subjectRef: string;
  readonly sourceObservedAt: string;
  readonly derivedAt: string;
  readonly projectRefs: readonly string[];
  readonly evidence: readonly Evidence[];
  readonly claims: readonly Claim[];
  readonly claimFingerprints: readonly {
    readonly claimRef: string;
    readonly fingerprint: string;
  }[];
  readonly invalidation: {
    readonly previousDerivationVersion: typeof evidenceClaimDerivationVersion | null;
    readonly evidence: readonly {
      readonly evidenceRef: string;
      readonly reason: EvidenceInvalidationReason;
    }[];
    readonly claims: readonly {
      readonly claimRef: string;
      readonly reason: ClaimInvalidationReason;
    }[];
  };
}

export type EvidenceClaimDerivationErrorCategory =
  "invalid-input" | "mapping-mismatch" | "not-derived" | "previous-mismatch" | "validation-failed";

export type DeriveEvidenceClaimsResult =
  | { readonly ok: true; readonly value: EvidenceClaimDerivationSnapshot }
  | {
      readonly ok: false;
      readonly error: {
        readonly category: EvidenceClaimDerivationErrorCategory;
        readonly retryable: false;
      };
    };

interface DerivedEvidence {
  readonly value: Evidence;
  readonly projectRef: string;
  readonly authorshipDepthCeiling: ObservedDepth | null;
  readonly authorshipConfidenceCeiling: Confidence;
}

interface ClaimGroup {
  readonly projectRef: string;
  readonly capability: string;
  readonly evidence: DerivedEvidence[];
}

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;
const capabilityPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u;
const languagePattern = /^[a-z][a-z0-9-]{0,63}$/u;
const extractorName = "community.language-signal";
const extractorVersion = "0.1.0";
const issuedDerivations = new WeakSet<object>();

class DerivationFault extends Error {
  readonly category: EvidenceClaimDerivationErrorCategory;

  constructor(category: EvidenceClaimDerivationErrorCategory) {
    super(category);
    this.category = category;
  }
}

export function deriveEvidenceClaims(
  source: EvidenceSourceRiskSnapshot,
  requestInput: EvidenceClaimDerivationRequest,
  previous: EvidenceClaimDerivationSnapshot | null = null,
): DeriveEvidenceClaimsResult {
  if (!isIssuedEvidenceSourceRiskSnapshot(source)) return failure("not-derived");
  try {
    const request = validateRequest(requestInput, source);
    validatePrevious(previous, source, request);
    const projectByRepository = new Map(
      request.repositoryProjects.map((item) => [item.repositoryId, item.projectRef]),
    );
    const derivedEvidence = source.repositories
      .flatMap((repository) => {
        const projectRef = projectByRepository.get(repository.repositoryId);
        if (projectRef === undefined) throw new DerivationFault("mapping-mismatch");
        return repository.records
          .filter((record) => record.sourceCategory === "source" && record.sourceLanguage !== null)
          .map((record) =>
            deriveEvidence(source.subjectRef, repository, record, projectRef, request),
          );
      })
      .sort((left, right) => compareText(left.value.evidenceId, right.value.evidenceId));
    const claims = deriveClaims(source.subjectRef, derivedEvidence, request);
    const claimFingerprints = claims.map((claim) => ({
      claimRef: claim.claimId,
      fingerprint: fingerprintClaim(claim, derivedEvidence),
    }));
    const invalidation = deriveInvalidation(previous, derivedEvidence, claims, claimFingerprints);
    const value = deepFreeze({
      kind: "evidence-claim-derivation-snapshot" as const,
      derivationVersion: evidenceClaimDerivationVersion,
      subjectRef: source.subjectRef,
      sourceObservedAt: request.sourceObservedAt,
      derivedAt: request.derivedAt,
      projectRefs: uniqueSorted(request.repositoryProjects.map((item) => item.projectRef)),
      evidence: derivedEvidence.map((item) => item.value),
      claims,
      claimFingerprints,
      invalidation,
    });
    if (!validateOutput(value)) throw new DerivationFault("validation-failed");
    issuedDerivations.add(value);
    return deepFreeze({ ok: true as const, value });
  } catch (error) {
    return failure(error instanceof DerivationFault ? error.category : "invalid-input");
  }
}

export function isIssuedEvidenceClaimDerivation(value: EvidenceClaimDerivationSnapshot): boolean {
  return typeof value === "object" && value !== null && issuedDerivations.has(value);
}

function deriveEvidence(
  subjectRef: string,
  repository: EvidenceSourceRiskSnapshot["repositories"][number],
  record: EvidenceSourceRiskRecord,
  projectRef: string,
  request: EvidenceClaimDerivationRequest,
): DerivedEvidence {
  const language = record.sourceLanguage;
  if (language === null || !languagePattern.test(language)) {
    throw new DerivationFault("invalid-input");
  }
  const capability = `language.${language}`;
  if (!capabilityPattern.test(capability)) throw new DerivationFault("invalid-input");
  const authorAssessment = evidenceAuthorAssessment(record, subjectRef);
  const limitations = boundedLimitations([
    ...record.riskFlags.map((item) => `source-risk-${item}`),
    `authorship-depth-ceiling-${record.authorshipDepthCeiling ?? "none"}`,
    `authorship-confidence-ceiling-${record.authorshipConfidenceCeiling}`,
    ...record.sourceLimitations,
    ...record.authorshipLimitations,
    "automated-language-signal",
  ]);
  const evidenceId = stableIdentifier("evidence", [
    subjectRef,
    repository.repositoryId,
    record.sourceRelativeRef,
    capability,
  ]);
  const fingerprint = stableIdentifier("fingerprint", [
    evidenceClaimDerivationVersion,
    extractorName,
    extractorVersion,
    subjectRef,
    repository.repositoryId,
    record.sourceRelativeRef,
    capability,
    record.contentDigest.value,
    authorAssessment.state,
    record.strengthCeiling,
    record.authorshipDepthCeiling,
    record.authorshipConfidenceCeiling,
    limitations,
  ]);
  return deepFreeze({
    projectRef,
    authorshipDepthCeiling: record.authorshipDepthCeiling,
    authorshipConfidenceCeiling: record.authorshipConfidenceCeiling,
    value: {
      schemaVersion: "0.1.0" as const,
      evidenceId,
      kind: "observation" as const,
      capabilitySignal: capability,
      source: {
        class: "selected-local-repository" as const,
        sourceRelativeRef: record.sourceRelativeRef,
        repositoryRef: repository.repositoryId,
        revisionRef: repository.headRevisionRef,
        visibility: "local-only" as const,
      },
      authorAssessment,
      freshness: {
        observedAt: request.sourceObservedAt,
        collectedAt: request.derivedAt,
      },
      strength: record.strengthCeiling,
      limitations,
      extractor: { name: extractorName, version: extractorVersion },
      invalidation: { rule: "source-changed" as const, fingerprint },
    },
  });
}

function evidenceAuthorAssessment(
  record: EvidenceSourceRiskRecord,
  subjectRef: string,
): { readonly state: AuthorAssessmentState; readonly subjectRef: string | null } {
  const states = new Set(record.attributionStates);
  if (states.has("coauthored") || states.has("pair-work")) {
    return deepFreeze({ state: "coauthored" as const, subjectRef });
  }
  if (states.has("attributed")) {
    return deepFreeze({ state: "attributed" as const, subjectRef });
  }
  if (states.size > 0 && [...states].every((state) => state === "bot")) {
    return deepFreeze({ state: "bot" as const, subjectRef: null });
  }
  return deepFreeze({ state: "unknown" as const, subjectRef: null });
}

function deriveClaims(
  subjectRef: string,
  evidence: readonly DerivedEvidence[],
  request: EvidenceClaimDerivationRequest,
): readonly Claim[] {
  const groups = new Map<string, ClaimGroup>();
  for (const item of evidence) {
    const key = `${item.projectRef}\0${item.value.capabilitySignal}`;
    const group = groups.get(key) ?? {
      projectRef: item.projectRef,
      capability: item.value.capabilitySignal,
      evidence: [],
    };
    group.evidence.push(item);
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort(
      (left, right) =>
        compareText(left.projectRef, right.projectRef) ||
        compareText(left.capability, right.capability),
    )
    .map((group) => deriveClaim(subjectRef, group, request));
}

function deriveClaim(
  subjectRef: string,
  group: ClaimGroup,
  request: EvidenceClaimDerivationRequest,
): Claim {
  const attributable = group.evidence.filter((item) => isAttributable(item.value));
  const candidates = attributable.length > 0 ? attributable : group.evidence;
  const ranked = candidates.slice().sort(compareEvidenceSupport);
  const selected = ranked.slice(
    0,
    evidenceClaimDerivationHardLimits.maximumEvidenceReferencesPerClaim,
  );
  const practicalModerateCount = attributable.filter(
    (item) => item.value.strength === "moderate" && item.authorshipDepthCeiling === "practical-use",
  ).length;
  const state =
    attributable.length > 0 ? ("demonstrated" as const) : ("insufficient-evidence" as const);
  const stale = request.sourceObservedAt < request.staleBefore;
  const inheritedLimitations = selected.flatMap((item) => item.value.limitations);
  const limitations = boundedLimitations([
    ...inheritedLimitations.filter((item) => item.startsWith("source-risk-")),
    "automated-language-derivation",
    "project-scoped-source-evidence",
    ...(attributable.length === 0 ? ["no-attributable-evidence"] : []),
    ...(attributable.some((item) => item.value.strength === "weak")
      ? ["weak-source-evidence"]
      : []),
    ...(ranked.length > selected.length ? ["evidence-reference-limit-reached"] : []),
    ...(stale ? ["stale-evidence"] : []),
    ...inheritedLimitations,
  ]);
  const observedDepth: ObservedDepth | null =
    state === "demonstrated" ? (practicalModerateCount >= 2 ? "practical-use" : "exposure") : null;
  const confidence: Confidence =
    state === "demonstrated" &&
    attributable.some(
      (item) => item.value.strength === "moderate" && item.authorshipConfidenceCeiling === "medium",
    )
      ? "medium"
      : "low";
  return deepFreeze({
    schemaVersion: "0.1.0" as const,
    claimId: stableIdentifier("claim", [subjectRef, group.projectRef, group.capability]),
    capability: group.capability,
    state,
    observedDepth,
    confidence,
    scope: "project" as const,
    projectRef: group.projectRef,
    basis: {
      kind: state === "demonstrated" ? ("evidence" as const) : ("insufficient-evidence" as const),
      evidenceRefs: selected.map((item) => item.value.evidenceId),
      adjacentFrom: [],
      rationale: null,
      declarationRef: null,
      correctionRef: null,
      correctionSummary: null,
    },
    limitations,
    freshness: { observedThrough: request.sourceObservedAt, stale },
  });
}

function fingerprintClaim(claim: Claim, evidence: readonly DerivedEvidence[]): string {
  const fingerprints = new Map(
    evidence.map((item) => [item.value.evidenceId, item.value.invalidation.fingerprint]),
  );
  return stableIdentifier("fingerprint", [
    evidenceClaimDerivationVersion,
    claim.claimId,
    claim.state,
    claim.observedDepth,
    claim.confidence,
    claim.basis.evidenceRefs.map((reference) => fingerprints.get(reference)),
    claim.limitations,
    claim.freshness.stale,
  ]);
}

function deriveInvalidation(
  previous: EvidenceClaimDerivationSnapshot | null,
  evidence: readonly DerivedEvidence[],
  claims: readonly Claim[],
  claimFingerprints: readonly { readonly claimRef: string; readonly fingerprint: string }[],
): EvidenceClaimDerivationSnapshot["invalidation"] {
  if (previous === null) {
    return deepFreeze({
      previousDerivationVersion: null,
      evidence: [],
      claims: [],
    });
  }
  const currentEvidence = new Map(evidence.map((item) => [item.value.evidenceId, item.value]));
  const evidenceInvalidation: {
    evidenceRef: string;
    reason: EvidenceInvalidationReason;
  }[] = [];
  for (const oldEvidence of previous.evidence) {
    const current = currentEvidence.get(oldEvidence.evidenceId);
    if (current === undefined) {
      evidenceInvalidation.push({
        evidenceRef: oldEvidence.evidenceId,
        reason: "source-unavailable",
      });
    } else if (current.invalidation.fingerprint !== oldEvidence.invalidation.fingerprint) {
      evidenceInvalidation.push({
        evidenceRef: oldEvidence.evidenceId,
        reason: "fingerprint-changed",
      });
    }
  }
  evidenceInvalidation.sort((left, right) => compareText(left.evidenceRef, right.evidenceRef));
  const invalidatedEvidence = new Set(evidenceInvalidation.map((item) => item.evidenceRef));
  const currentClaims = new Map(claims.map((claim) => [claim.claimId, claim]));
  const currentFingerprints = new Map(
    claimFingerprints.map((item) => [item.claimRef, item.fingerprint]),
  );
  const previousFingerprints = new Map(
    previous.claimFingerprints.map((item) => [item.claimRef, item.fingerprint]),
  );
  const claimInvalidation: { claimRef: string; reason: ClaimInvalidationReason }[] = [];
  for (const oldClaim of previous.claims) {
    const current = currentClaims.get(oldClaim.claimId);
    if (current === undefined) {
      claimInvalidation.push({ claimRef: oldClaim.claimId, reason: "no-longer-supported" });
      continue;
    }
    if (currentFingerprints.get(current.claimId) === previousFingerprints.get(oldClaim.claimId)) {
      continue;
    }
    if (
      sameClaimSupport(oldClaim, current) &&
      oldClaim.freshness.stale !== current.freshness.stale
    ) {
      claimInvalidation.push({ claimRef: oldClaim.claimId, reason: "freshness-changed" });
      continue;
    }
    if (
      oldClaim.basis.evidenceRefs.some((reference) => invalidatedEvidence.has(reference)) ||
      current.basis.evidenceRefs.some((reference) => invalidatedEvidence.has(reference))
    ) {
      claimInvalidation.push({ claimRef: oldClaim.claimId, reason: "evidence-invalidated" });
      continue;
    }
    claimInvalidation.push({ claimRef: oldClaim.claimId, reason: "support-changed" });
  }
  claimInvalidation.sort((left, right) => compareText(left.claimRef, right.claimRef));
  return deepFreeze({
    previousDerivationVersion: previous.derivationVersion,
    evidence: evidenceInvalidation,
    claims: claimInvalidation,
  });
}

function sameClaimSupport(left: Claim, right: Claim): boolean {
  return (
    left.state === right.state &&
    left.observedDepth === right.observedDepth &&
    left.confidence === right.confidence &&
    JSON.stringify(left.basis.evidenceRefs) === JSON.stringify(right.basis.evidenceRefs) &&
    JSON.stringify(left.limitations.filter((item) => item !== "stale-evidence")) ===
      JSON.stringify(right.limitations.filter((item) => item !== "stale-evidence"))
  );
}

function validateRequest(
  value: EvidenceClaimDerivationRequest,
  source: EvidenceSourceRiskSnapshot,
): EvidenceClaimDerivationRequest {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "kind",
      "derivationVersion",
      "sourceObservedAt",
      "derivedAt",
      "staleBefore",
      "repositoryProjects",
    ]) ||
    value["kind"] !== "evidence-claim-derivation-request" ||
    value["derivationVersion"] !== evidenceClaimDerivationVersion ||
    !isCanonicalTimestamp(value["sourceObservedAt"]) ||
    !isCanonicalTimestamp(value["derivedAt"]) ||
    !isCanonicalTimestamp(value["staleBefore"]) ||
    value["sourceObservedAt"] > value["derivedAt"] ||
    value["staleBefore"] > value["derivedAt"] ||
    !Array.isArray(value["repositoryProjects"]) ||
    value["repositoryProjects"].length !== source.repositories.length
  ) {
    throw new DerivationFault("invalid-input");
  }
  const repositories = new Set<string>();
  for (const item of value["repositoryProjects"]) {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, ["repositoryId", "projectRef"]) ||
      !isIdentifier(item["repositoryId"]) ||
      !isIdentifier(item["projectRef"]) ||
      repositories.has(item["repositoryId"])
    ) {
      throw new DerivationFault("invalid-input");
    }
    repositories.add(item["repositoryId"]);
  }
  if (source.repositories.some((repository) => !repositories.has(repository.repositoryId))) {
    throw new DerivationFault("mapping-mismatch");
  }
  return value;
}

function validatePrevious(
  previous: EvidenceClaimDerivationSnapshot | null,
  source: EvidenceSourceRiskSnapshot,
  request: EvidenceClaimDerivationRequest,
): void {
  if (previous === null) return;
  if (!isIssuedEvidenceClaimDerivation(previous)) {
    throw new DerivationFault("previous-mismatch");
  }
  if (
    previous.subjectRef !== source.subjectRef ||
    previous.sourceObservedAt > request.sourceObservedAt ||
    previous.derivedAt > request.derivedAt
  ) {
    throw new DerivationFault("previous-mismatch");
  }
}

function validateOutput(value: EvidenceClaimDerivationSnapshot): boolean {
  return isPortableProfileExport({
    schemaVersion: "0.1.0",
    kind: "portable-profile-export",
    exportId: "export_derivation_validation",
    profileVersion: "profile_derivation_validation",
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

function compareEvidenceSupport(left: DerivedEvidence, right: DerivedEvidence): number {
  const rank = (item: DerivedEvidence): number => {
    const strength = item.value.strength === "moderate" ? 0 : 2;
    const authorship = item.value.authorAssessment.state === "attributed" ? 0 : 1;
    return strength + authorship;
  };
  return rank(left) - rank(right) || compareText(left.value.evidenceId, right.value.evidenceId);
}

function isAttributable(value: Evidence): boolean {
  return (
    value.authorAssessment.state === "attributed" || value.authorAssessment.state === "coauthored"
  );
}

function boundedLimitations(values: readonly string[]): readonly string[] {
  const unique = [...new Set(values)];
  if (unique.length <= evidenceClaimDerivationHardLimits.maximumLimitations) {
    return Object.freeze(unique);
  }
  return Object.freeze([
    ...unique.slice(0, evidenceClaimDerivationHardLimits.maximumLimitations - 1),
    "additional-limitations-omitted",
  ]);
}

function stableIdentifier(prefix: "claim" | "evidence" | "fingerprint", parts: unknown): string {
  const digest = createHash("sha256").update(JSON.stringify(parts)).digest("hex");
  return `${prefix}_${digest}`;
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]Z$/u.test(
      value,
    )
  ) {
    return false;
  }
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value.replace("Z", ".000Z")
  );
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && identifierPattern.test(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort(compareText);
  const expected = [...keys].sort(compareText);
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort(compareText));
}

function failure(category: EvidenceClaimDerivationErrorCategory): DeriveEvidenceClaimsResult {
  return Object.freeze({
    ok: false,
    error: Object.freeze({ category, retryable: false as const }),
  });
}

function deepFreeze<Value>(value: Value): Value {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
