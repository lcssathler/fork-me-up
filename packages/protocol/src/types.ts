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

export type DcpAudienceClass = "local-assistant" | "external-consumer";
export type DcpDisclosureClass = "task-context" | "consumer-session";

export interface DcpClaimSummary {
  readonly claimId: string;
  readonly capability: string;
  readonly state: ClaimState;
  readonly observedDepth: ObservedDepth | null;
  readonly confidence: Confidence;
  readonly scope: ClaimScope;
  readonly adjacentFrom: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly limitations: readonly string[];
  readonly freshness: {
    readonly observedThrough: string | null;
    readonly stale: boolean;
  };
  readonly adjacentRationale?: string;
  readonly correctionRef?: string;
  readonly correctionSummary?: string;
}

export interface DeveloperContextPacket {
  readonly schemaVersion: "0.1.0";
  readonly packetId: string;
  readonly profileVersion: string;
  readonly purpose: DemandPurpose;
  readonly audience: {
    readonly class: DcpAudienceClass;
    readonly consumerId: string | null;
  };
  readonly task: {
    readonly summary: string;
    readonly requiredCapabilities: readonly string[];
  };
  readonly budget: {
    readonly maxBytes: number;
  };
  readonly claims: readonly DcpClaimSummary[];
  readonly uncertainties: readonly {
    readonly capability: string;
    readonly reason: string;
    readonly material: boolean;
  }[];
  readonly responsePolicy: ResponsePolicy;
  readonly provenanceSummary: {
    readonly evidenceCount: number;
    readonly sourceClasses: readonly string[];
  };
  readonly disclosure: {
    readonly class: DcpDisclosureClass;
    readonly redactionsApplied: readonly string[];
  };
  readonly generatedAt: string;
  readonly expiresAt: string;
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

export type ProfileProviderOperation =
  | "get-provider-capabilities"
  | "get-profile-metadata"
  | "get-task-context"
  | "get-capability-evidence";

export interface ProfileProviderCapabilities {
  readonly schemaVersion: "0.1.0";
  readonly kind: "profile-provider-capabilities";
  readonly providerId: string;
  readonly protocolVersions: readonly string[];
  readonly operations: readonly ProfileProviderOperation[];
  readonly sourceClasses: readonly EvidenceSourceClass[];
  readonly disclosureClasses: readonly DcpDisclosureClass[];
  readonly deployment: "local" | "remote-managed";
  readonly limits: {
    readonly maxTaskBytes: number;
    readonly maxOutputBytes: number;
    readonly maxOutputTokens: number;
    readonly maxRequestedCapabilities: number;
  };
  readonly freshnessSupport: {
    readonly partialResults: boolean;
    readonly staleResults: boolean;
  };
  readonly extensions?: Readonly<Record<string, boolean | number | string | readonly string[]>>;
}

export interface TaskContextInput {
  readonly task: string;
  readonly purpose: DemandPurpose;
  readonly maxTokens: number;
  readonly requestedCapabilities: readonly string[];
}

export type CapabilityEvidenceInput =
  | Readonly<{ capability: string; claimRef?: never }>
  | Readonly<{ capability?: never; claimRef: string }>;

type ProfileProviderRequestFor<
  Operation extends ProfileProviderOperation,
  Input extends object,
> = Readonly<{
  schemaVersion: "0.1.0";
  kind: "profile-provider-request";
  requestId: string;
  operation: Operation;
  input: Input;
  extensions?: Readonly<Record<string, boolean | number | string | readonly string[]>>;
}>;

export type ProfileProviderRequest =
  | ProfileProviderRequestFor<"get-provider-capabilities", Readonly<Record<string, never>>>
  | ProfileProviderRequestFor<"get-profile-metadata", Readonly<Record<string, never>>>
  | ProfileProviderRequestFor<"get-task-context", TaskContextInput>
  | ProfileProviderRequestFor<"get-capability-evidence", CapabilityEvidenceInput>;

export type ProfileFreshnessStatus = "fresh" | "stale" | "partial";

export interface ProfileMetadata {
  readonly profileVersion: string;
  readonly freshnessStatus: ProfileFreshnessStatus;
  readonly observedThrough: string | null;
  readonly claimCount: number;
  readonly evidenceCount: number;
}

export interface CapabilityEvidence {
  readonly capability: string;
  readonly claimRef: string | null;
  readonly evidence: readonly {
    readonly evidenceRef: string;
    readonly sourceClass: EvidenceSourceClass;
    readonly strength: EvidenceStrength;
    readonly observedAt: string;
    readonly limitations: readonly string[];
  }[];
  readonly limitations: readonly string[];
}

export type ProfileProviderErrorCategory =
  | "unsupported-version"
  | "unsupported-operation"
  | "invalid-input"
  | "profile-unavailable"
  | "partial-profile"
  | "stale-profile"
  | "budget-too-small"
  | "unauthorized"
  | "insufficient-scope"
  | "source-unavailable"
  | "persistence-failed"
  | "redaction-failed"
  | "internal-error";

export interface ProfileProviderError {
  readonly category: ProfileProviderErrorCategory;
  readonly retryable: boolean;
  readonly supportedVersions: readonly string[];
}

export type ProfileProviderResponse =
  | Readonly<{
      schemaVersion: "0.1.0";
      kind: "profile-provider-response";
      requestId: string;
      operation: ProfileProviderOperation;
      outcome: "success";
      data:
        ProfileProviderCapabilities | ProfileMetadata | DeveloperContextPacket | CapabilityEvidence;
      error: null;
    }>
  | Readonly<{
      schemaVersion: "0.1.0";
      kind: "profile-provider-response";
      requestId: string;
      operation: ProfileProviderOperation;
      outcome: "error";
      data: null;
      error: ProfileProviderError;
    }>;
