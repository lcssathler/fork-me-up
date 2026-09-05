export type EvidenceSourceClass =
  "selected-local-repository" | "selected-public-repository" | "selected-private-repository";

export type EvidenceVisibility = "local-only" | "public" | "private";
export type AuthorAssessmentState =
  "attributed" | "coauthored" | "bot" | "unknown" | "not-applicable";
export type EvidenceStrength = "weak" | "moderate" | "strong";
export type EvidenceInvalidationRule =
  | "source-changed"
  | "revision-unavailable"
  | "extractor-changed"
  | "authorization-revoked"
  | "manual-review";

export interface Evidence {
  readonly schemaVersion: "0.1.0";
  readonly evidenceId: string;
  readonly kind: "observation";
  readonly capabilitySignal: string;
  readonly source: {
    readonly class: EvidenceSourceClass;
    readonly sourceRelativeRef: string;
    readonly repositoryRef: string;
    readonly revisionRef: string;
    readonly visibility: EvidenceVisibility;
  };
  readonly authorAssessment: {
    readonly state: AuthorAssessmentState;
    readonly subjectRef: string | null;
  };
  readonly freshness: {
    readonly observedAt: string;
    readonly collectedAt: string;
  };
  readonly strength: EvidenceStrength;
  readonly limitations: readonly string[];
  readonly extractor: {
    readonly name: string;
    readonly version: string;
  };
  readonly invalidation: {
    readonly rule: EvidenceInvalidationRule;
    readonly fingerprint: string;
  };
}

export type ClaimState =
  "demonstrated" | "adjacent" | "self-declared" | "insufficient-evidence" | "disputed";
export type ObservedDepth = "exposure" | "practical-use" | "demonstrated-depth";
export type Confidence = "low" | "medium" | "high";
export type ClaimScope = "global" | "project";
export type ClaimBasisKind =
  "evidence" | "adjacency" | "declaration" | "insufficient-evidence" | "dispute";

export interface ClaimBasis {
  readonly kind: ClaimBasisKind;
  readonly evidenceRefs: readonly string[];
  readonly adjacentFrom: readonly string[];
  readonly rationale: string | null;
  readonly declarationRef: string | null;
  readonly correctionRef: string | null;
  readonly correctionSummary: string | null;
}

export interface Claim {
  readonly schemaVersion: "0.1.0";
  readonly claimId: string;
  readonly capability: string;
  readonly state: ClaimState;
  readonly observedDepth: ObservedDepth | null;
  readonly confidence: Confidence;
  readonly scope: ClaimScope;
  readonly projectRef: string | null;
  readonly basis: ClaimBasis;
  readonly limitations: readonly string[];
  readonly freshness: {
    readonly observedThrough: string | null;
    readonly stale: boolean;
  };
}

export interface Declaration {
  readonly declarationId: string;
  readonly capability: string;
  readonly summary: string;
  readonly declaredAt: string;
}

export interface Correction {
  readonly correctionId: string;
  readonly kind: "assertion" | "rejection" | "adjustment";
  readonly capability: string;
  readonly targetClaimRef: string | null;
  readonly summary: string;
  readonly createdAt: string;
}

export interface ProfilePreferences {
  readonly explanationMode: "concise" | "balanced" | "guided";
  readonly explainPurposeBeforeCommands: boolean;
  readonly includeExpectedResult: boolean;
  readonly includeRiskAndRollback: boolean;
  readonly questionBudget: 0 | 1;
}

export type ResponsePolicyMode = "concise" | "analogy" | "teach-while-doing";

export interface ResponsePolicy {
  readonly mode: ResponsePolicyMode;
  readonly explainPurposeBeforeCommands: boolean;
  readonly includeExpectedResult: boolean;
  readonly includeRiskAndRollback: boolean;
  readonly analogyCapabilities: readonly string[];
  readonly questionBudget: 0 | 1;
}

export type DemandPurpose = "coding-assistance" | "technical-learning" | "professional-preparation";
export type DemandMetadataStatus = "available" | "partial" | "unavailable";
export type DemandCapabilityRelevance = "required" | "supporting";
export type DemandCapabilityBasis = "task-input" | "project-metadata" | "task-and-project";

export interface DemandCapability {
  readonly capability: string;
  readonly relevance: DemandCapabilityRelevance;
  readonly basis: DemandCapabilityBasis;
}

export interface DemandProfile {
  readonly schemaVersion: "0.1.0";
  readonly kind: "demand-profile";
  readonly demandId: string;
  readonly project: {
    readonly projectRef: string;
    readonly metadataStatus: DemandMetadataStatus;
    readonly metadataRevisionRef: string | null;
  };
  readonly task: {
    readonly summary: string;
    readonly purpose: DemandPurpose;
  };
  readonly capabilities: readonly DemandCapability[];
  readonly generatedAt: string;
}

export interface ProfilePayload {
  readonly projectRefs: readonly string[];
  readonly evidence: readonly Evidence[];
  readonly claims: readonly Claim[];
  readonly declarations: readonly Declaration[];
  readonly corrections: readonly Correction[];
  readonly preferences: ProfilePreferences;
}

export interface PortableProfileExport {
  readonly schemaVersion: "0.1.0";
  readonly kind: "portable-profile-export";
  readonly exportId: string;
  readonly profileVersion: string;
  readonly subjectRef: string;
  readonly generatedAt: string;
  readonly profile: ProfilePayload;
  readonly exclusions: {
    readonly credentials: true;
    readonly rawSource: true;
    readonly sourceGrants: true;
    readonly sharingGrants: true;
    readonly internalState: true;
  };
}
