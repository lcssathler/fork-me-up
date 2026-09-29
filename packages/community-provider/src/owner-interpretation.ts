import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import type { Claim, Evidence } from "@fork-me-up/protocol";
import {
  isIssuedLocalProfileStoreConfig,
  type ResolvedLocalProfileStoreConfig,
} from "./local-profile-store-config.ts";
import { loadLocalProfileStore, type LocalProfileStoreFilePort } from "./local-profile-store.ts";

export const ownerInterpretationLimits = Object.freeze({
  inputBytes: 16_384,
  outputBytes: 32_768,
  sourceProjects: 4,
  capabilities: 16,
  claims: 16,
  evidence: 32,
  proposals: 8,
  disclosureSeconds: 600,
});

type Failure = Readonly<{
  ok: false;
  error: Readonly<{
    category: "invalid-input" | "unavailable" | "limit-exceeded";
    retryable: false;
  }>;
}>;
export type OwnerInterpretationResult =
  | Failure
  | Readonly<{
      ok: true;
      status: "view";
      generation: number;
      viewId: string;
      view: OwnerInterpretationView;
    }>
  | Readonly<{
      ok: true;
      status: "admitted";
      generation: number;
      viewId: string;
      proposals: readonly AdmittedProposal[];
    }>;

export interface OwnerInterpretationView {
  readonly version: "0.1.0";
  readonly kind: "owner-interpretation-view";
  readonly targetProjectRef: string;
  readonly sourceProjectRefs: readonly string[];
  readonly requestedCapabilities: readonly string[];
  readonly claims: readonly ReturnType<typeof projectClaim>[];
  readonly evidence: readonly ReturnType<typeof projectEvidence>[];
  readonly coverage: Readonly<{ selectedClaims: number; selectedEvidence: number }>;
  readonly limitations: readonly string[];
}

export interface AdmittedProposal {
  readonly kind: "assessment" | "transfer" | "task-need";
  readonly capability: string;
  readonly targetProjectRef: string | null;
  readonly status: "provisional-owner-review" | "unverified-task-need";
  readonly relevance?: "required" | "supporting";
  readonly sourceClaimId?: string;
  readonly sourceCapability?: string;
  readonly sourceProjectRef?: string | null;
  readonly relation?: "shared-concept" | "similar-workflow";
  readonly transferLimit?:
    "different-apis" | "different-runtime" | "different-domain" | "unverified";
  readonly sourceState?: Claim["state"];
  readonly sourceDepth?: Claim["observedDepth"];
  readonly sourceConfidence?: Claim["confidence"];
  readonly evidenceRefs?: readonly string[];
  readonly limitations?: readonly string[];
}

interface Selection {
  readonly version: "0.1.0";
  readonly operation: "view" | "admit";
  readonly disclosure: {
    readonly mode: "existing-agent";
    readonly approved: true;
    readonly approvedAt: string;
    readonly expiresAt: string;
  };
  readonly targetProjectRef: string;
  readonly sourceProjectRefs: readonly string[];
  readonly capabilities: readonly string[];
  readonly expectedGeneration?: number;
  readonly viewId?: string;
  readonly proposals?: readonly unknown[];
}

/** First-party owner operation. Never expose this through the Provider or consumer MCP. */
export async function runOwnerInterpretationOperation(
  configuration: ResolvedLocalProfileStoreConfig,
  requestJson: string,
  options: {
    readonly authorizedProjectRefs: readonly string[];
    readonly maxObservationAgeMs: number;
    readonly clock?: () => Date;
    readonly port?: LocalProfileStoreFilePort;
  },
): Promise<OwnerInterpretationResult> {
  if (!isIssuedLocalProfileStoreConfig(configuration)) return failure("invalid-input");
  try {
    const now = options.clock?.() ?? new Date();
    const request = parseRequest(requestJson, now);
    if (request === null) return failure("invalid-input");
    if (
      !Number.isSafeInteger(options.maxObservationAgeMs) ||
      options.maxObservationAgeMs <= 0 ||
      options.maxObservationAgeMs > 86_400_000
    )
      return failure("invalid-input");
    if (
      !Array.isArray(options.authorizedProjectRefs) ||
      options.authorizedProjectRefs.length > 64 ||
      !options.authorizedProjectRefs.every(identifier) ||
      request.sourceProjectRefs.some((item) => !options.authorizedProjectRefs.includes(item))
    )
      return failure("invalid-input");
    const loaded = await loadLocalProfileStore(
      configuration,
      options.port === undefined ? {} : { port: options.port },
    );
    if (!loaded.ok || loaded.value === null) return failure("unavailable");
    const store = loaded.value;
    const profile = store.profile;
    const checkedAt = options.clock?.() ?? new Date();
    if (
      !Number.isFinite(checkedAt.getTime()) ||
      checkedAt.getTime() < now.getTime() ||
      checkedAt.getTime() >= Date.parse(request.disclosure.expiresAt)
    )
      return failure("invalid-input");

    const historical = new Set(
      profile.claims
        .filter((claim) => claim.state === "disputed")
        .flatMap((claim) => {
          const correction = profile.corrections.find(
            (item) => item.correctionId === claim.basis.correctionRef,
          );
          return correction?.targetClaimRef === null || correction?.targetClaimRef === undefined
            ? []
            : [correction.targetClaimRef];
        }),
    );
    const selected = profile.claims
      .filter(
        (claim) =>
          !historical.has(claim.claimId) &&
          claim.state !== "disputed" &&
          request.capabilities.includes(claim.capability) &&
          (claim.scope === "global" ||
            (claim.projectRef !== null && request.sourceProjectRefs.includes(claim.projectRef))),
      )
      .sort((a, b) => compare(a.claimId, b.claimId));
    if (selected.length > ownerInterpretationLimits.claims) return failure("limit-exceeded");
    const evidenceIds = new Set(selected.flatMap((claim) => claim.basis.evidenceRefs));
    if (evidenceIds.size > ownerInterpretationLimits.evidence) return failure("limit-exceeded");
    const evidence = profile.evidence
      .filter((item) => evidenceIds.has(item.evidenceId))
      .sort((a, b) => compare(a.evidenceId, b.evidenceId));
    if (evidence.length !== evidenceIds.size) return failure("invalid-input");
    if (
      [...selected, ...evidence].some((item) =>
        item.limitations.some((value) => !safeLimitation(value)),
      )
    )
      return failure("invalid-input");
    const view: OwnerInterpretationView = {
      version: "0.1.0" as const,
      kind: "owner-interpretation-view" as const,
      targetProjectRef: request.targetProjectRef,
      sourceProjectRefs: [...request.sourceProjectRefs],
      requestedCapabilities: [...request.capabilities],
      claims: selected.map(projectClaim),
      evidence: evidence.map(projectEvidence),
      coverage: { selectedClaims: selected.length, selectedEvidence: evidence.length },
      limitations: ["selected-profile-only", "no-source-excerpts", "not-verified-understanding"],
    };
    const generation = store.internalState.generation;
    const viewId = `interpretation_${createHash("sha256")
      .update(
        JSON.stringify([
          store.subjectRef,
          generation,
          store.profileVersion,
          request.disclosure,
          view,
        ]),
      )
      .digest("hex")}`;
    if (request.operation === "view") {
      const result = { ok: true as const, status: "view" as const, generation, viewId, view };
      const returnedAt = options.clock?.() ?? new Date();
      if (
        !Number.isFinite(returnedAt.getTime()) ||
        returnedAt.getTime() < checkedAt.getTime() ||
        returnedAt.getTime() >= Date.parse(request.disclosure.expiresAt)
      )
        return failure("invalid-input");
      return Buffer.byteLength(JSON.stringify(result), "utf8") <=
        ownerInterpretationLimits.outputBytes
        ? freeze(result)
        : failure("limit-exceeded");
    }
    if (request.expectedGeneration !== generation || request.viewId !== viewId)
      return failure("invalid-input");
    const proposals: AdmittedProposal[] = [];
    for (const raw of request.proposals ?? []) {
      const admitted = admit(
        raw,
        selected,
        evidence,
        request.targetProjectRef,
        checkedAt.getTime(),
        options.maxObservationAgeMs,
      );
      if (admitted === null) return failure("invalid-input");
      proposals.push(admitted);
    }
    const result = {
      ok: true as const,
      status: "admitted" as const,
      generation,
      viewId,
      proposals,
    };
    if (Buffer.byteLength(JSON.stringify(result), "utf8") > ownerInterpretationLimits.outputBytes)
      return failure("limit-exceeded");
    const returnedAt = options.clock?.() ?? new Date();
    if (
      !Number.isFinite(returnedAt.getTime()) ||
      returnedAt.getTime() < checkedAt.getTime() ||
      returnedAt.getTime() >= Date.parse(request.disclosure.expiresAt)
    )
      return failure("invalid-input");
    return freeze(result);
  } catch {
    return failure("invalid-input");
  }
}

function admit(
  input: unknown,
  claims: readonly Claim[],
  evidence: readonly Evidence[],
  targetProjectRef: string,
  now: number,
  maxObservationAgeMs: number,
): AdmittedProposal | null {
  if (!record(input) || !identifier(input["capability"])) return null;
  if (input["kind"] === "task-need") {
    if (
      !shape(input, ["kind", "capability", "relevance"]) ||
      !["required", "supporting"].includes(String(input["relevance"]))
    )
      return null;
    return {
      kind: "task-need",
      capability: input["capability"],
      relevance: input["relevance"] as "required" | "supporting",
      targetProjectRef,
      status: "unverified-task-need",
    };
  }
  if (input["kind"] !== "assessment" && input["kind"] !== "transfer") return null;
  const isTransfer = input["kind"] === "transfer";
  if (
    !shape(
      input,
      isTransfer
        ? ["kind", "capability", "sourceClaimId", "evidenceRefs", "relation", "transferLimit"]
        : ["kind", "capability", "sourceClaimId", "evidenceRefs"],
    ) ||
    !identifier(input["sourceClaimId"]) ||
    !Array.isArray(input["evidenceRefs"]) ||
    input["evidenceRefs"].length > ownerInterpretationLimits.evidence ||
    !input["evidenceRefs"].every(identifier)
  )
    return null;
  const claim = claims.find((item) => item.claimId === input["sourceClaimId"]);
  if (
    claim === undefined ||
    claim.state === "insufficient-evidence" ||
    claim.freshness.stale ||
    (claim.freshness.observedThrough !== null &&
      (Date.parse(claim.freshness.observedThrough) > now ||
        now - Date.parse(claim.freshness.observedThrough) > maxObservationAgeMs)) ||
    !sameSet(input["evidenceRefs"] as string[], claim.basis.evidenceRefs) ||
    claim.basis.evidenceRefs.some((id) => !evidence.some((item) => item.evidenceId === id))
  )
    return null;
  if (isTransfer) {
    if (
      claim.scope !== "project" ||
      claim.projectRef === targetProjectRef ||
      !["shared-concept", "similar-workflow"].includes(String(input["relation"])) ||
      !["different-apis", "different-runtime", "different-domain", "unverified"].includes(
        String(input["transferLimit"]),
      )
    )
      return null;
  } else if (input["capability"] !== claim.capability) return null;
  return {
    kind: input["kind"],
    capability: input["capability"],
    sourceClaimId: claim.claimId,
    sourceCapability: claim.capability,
    sourceProjectRef: claim.projectRef,
    targetProjectRef: isTransfer ? targetProjectRef : claim.projectRef,
    ...(isTransfer
      ? {
          relation: input["relation"] as "shared-concept" | "similar-workflow",
          transferLimit: input["transferLimit"] as Exclude<
            AdmittedProposal["transferLimit"],
            undefined
          >,
        }
      : {}),
    sourceState: claim.state,
    sourceDepth: claim.observedDepth,
    sourceConfidence: claim.confidence,
    evidenceRefs: [...claim.basis.evidenceRefs],
    limitations: [...claim.limitations, ...(isTransfer ? ["transfer-unverified"] : [])],
    status: "provisional-owner-review",
  };
}

function projectClaim(claim: Claim) {
  return {
    claimId: claim.claimId,
    capability: claim.capability,
    state: claim.state,
    observedDepth: claim.observedDepth,
    confidence: claim.confidence,
    scope: claim.scope,
    projectRef: claim.projectRef,
    evidenceRefs: [...claim.basis.evidenceRefs],
    limitations: [...claim.limitations],
    freshness: claim.freshness,
    basisKind: claim.basis.kind,
  };
}
function projectEvidence(item: Evidence) {
  return {
    evidenceId: item.evidenceId,
    capabilitySignal: item.capabilitySignal,
    sourceClass: item.source.class,
    authorAssessment: item.authorAssessment.state,
    strength: item.strength,
    observedAt: item.freshness.observedAt,
    limitations: [...item.limitations],
  };
}
const fixedLimitations = new Set([
  "Owner declaration is not observed evidence.",
  "additional-limitations-omitted",
  "automated-language-derivation",
  "automated-language-signal",
  "evidence-reference-limit-reached",
  "no-attributable-evidence",
  "project-scoped-source-evidence",
  "stale-evidence",
  "weak-source-evidence",
  "exact-content-duplicate",
  "explicit-path-annotation",
  "explicit-repository-annotation",
  "history-truncated",
  "multiple-source-risks",
  "no-bounded-commit-association",
  "no-target-attribution",
  "origin-unverified",
  "path-indicator-only",
  "shallow-history",
  "automated-contributor",
  "bot-authored",
  "coauthored",
  "distinct-committer",
  "merge-commit",
  "pair-work-declared",
  "shared-identity",
  "squash-history",
  "unknown-authorship",
  "unmatched-coauthor",
  ...["fork", "template", "generated", "vendored", "tutorial", "duplicated", "uncertain"].map(
    (flag) => `source-risk-${flag}`,
  ),
  ...["none", "exposure", "practical-use", "demonstrated-depth"].map(
    (depth) => `authorship-depth-ceiling-${depth}`,
  ),
  ...["low", "medium", "high"].map((confidence) => `authorship-confidence-ceiling-${confidence}`),
]);
function safeLimitation(value: string): boolean {
  return fixedLimitations.has(value);
}
function parseRequest(source: string, now: Date): Selection | null {
  if (
    typeof source !== "string" ||
    !source.isWellFormed() ||
    Buffer.byteLength(source, "utf8") > ownerInterpretationLimits.inputBytes ||
    !Number.isFinite(now.getTime())
  )
    return null;
  const value: unknown = JSON.parse(source);
  if (
    !record(value) ||
    !["view", "admit"].includes(String(value["operation"])) ||
    !shape(
      value,
      value["operation"] === "view"
        ? [
            "version",
            "operation",
            "disclosure",
            "targetProjectRef",
            "sourceProjectRefs",
            "capabilities",
          ]
        : [
            "version",
            "operation",
            "disclosure",
            "targetProjectRef",
            "sourceProjectRefs",
            "capabilities",
            "expectedGeneration",
            "viewId",
            "proposals",
          ],
    ) ||
    value["version"] !== "0.1.0" ||
    !identifier(value["targetProjectRef"]) ||
    !list(value["sourceProjectRefs"], ownerInterpretationLimits.sourceProjects) ||
    !list(value["capabilities"], ownerInterpretationLimits.capabilities) ||
    !shape(value["disclosure"], ["mode", "approved", "approvedAt", "expiresAt"]) ||
    value["disclosure"]["mode"] !== "existing-agent" ||
    value["disclosure"]["approved"] !== true ||
    !timestamp(value["disclosure"]["approvedAt"]) ||
    !timestamp(value["disclosure"]["expiresAt"])
  )
    return null;
  const approved = Date.parse(value["disclosure"]["approvedAt"]);
  const expires = Date.parse(value["disclosure"]["expiresAt"]);
  if (
    approved > now.getTime() ||
    expires <= now.getTime() ||
    expires <= approved ||
    expires - approved > ownerInterpretationLimits.disclosureSeconds * 1000
  )
    return null;
  if (
    value["operation"] === "admit" &&
    (!Number.isSafeInteger(value["expectedGeneration"]) ||
      (value["expectedGeneration"] as number) < 0 ||
      typeof value["viewId"] !== "string" ||
      !/^interpretation_[a-f0-9]{64}$/u.test(value["viewId"]) ||
      !Array.isArray(value["proposals"]) ||
      value["proposals"].length > ownerInterpretationLimits.proposals)
  )
    return null;
  return value as unknown as Selection;
}
function list(value: unknown, max: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= max &&
    value.every(identifier) &&
    new Set(value).size === value.length
  );
}
function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(value);
}
function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value.replace("Z", ".000Z")
  );
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function shape(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    record(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((item) => right.includes(item))
  );
}
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
function failure(category: Failure["error"]["category"]): Failure {
  return freeze({ ok: false, error: { category, retryable: false } });
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
