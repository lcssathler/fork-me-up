import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import type { Claim, Correction, ProfilePayload } from "@fork-me-up/protocol";
import {
  type CommunityProfileStore,
  serializeCommunityProfileStore,
} from "./community-profile-store-format.ts";
import {
  isIssuedLocalProfileStoreConfig,
  type ResolvedLocalProfileStoreConfig,
} from "./local-profile-store-config.ts";
import {
  loadLocalProfileStore,
  writeLocalProfileStore,
  type LocalProfileStoreFilePort,
  type LocalProfileStoreErrorCategory,
  type LoadLocalProfileStoreResult,
} from "./local-profile-store.ts";
import {
  isIssuedEvidenceClaimDerivation,
  type EvidenceClaimDerivationSnapshot,
} from "./evidence-claim-derivation.ts";

export const ownerWorkflowMaximumInputBytes = 32_768;
export const ownerWorkflowMaximumOutputBytes = 262_144;
type OwnerErrorCategory = LocalProfileStoreErrorCategory | "not-found" | "unsupported-target";
type OwnerFailure = {
  readonly ok: false;
  readonly error: { readonly category: OwnerErrorCategory; readonly retryable: boolean };
};
export interface OwnerWorkflowOptions {
  readonly port?: LocalProfileStoreFilePort;
  readonly nonce?: string;
}
interface Mutation {
  readonly expectedGeneration: number | null;
  readonly at: string;
}
type OwnerRequest =
  | { readonly version: "0.1.0"; readonly operation: "inspect"; readonly claimId: string | null }
  | (Mutation & {
      readonly version: "0.1.0";
      readonly operation: "correct" | "dispute" | "reject";
      readonly claimId: string;
      readonly summary: string;
    })
  | (Mutation & {
      readonly version: "0.1.0";
      readonly operation: "declare";
      readonly capability: string;
      readonly projectRef: string | null;
      readonly summary: string;
    });
export type OwnerWorkflowResult =
  | OwnerFailure
  | {
      readonly ok: true;
      readonly status: "inspected" | "saved" | "absent";
      readonly generation: number | null;
      readonly maintenanceRequired: boolean;
      readonly recovered: boolean;
      readonly view: unknown;
    };

/** First-party owner boundary; never register as a Provider/MCP operation. */
export async function runOwnerProfileOperation(
  configuration: ResolvedLocalProfileStoreConfig,
  requestJson: string,
  options: OwnerWorkflowOptions = {},
): Promise<OwnerWorkflowResult> {
  if (!isIssuedLocalProfileStoreConfig(configuration)) return failure("not-configured");
  try {
    const request = parseRequest(requestJson);
    const loaded = await loadLocalProfileStore(configuration, portOptions(options));
    if (!loaded.ok) return loaded;
    if (request.operation === "inspect") {
      if (loaded.value === null)
        return freeze({
          ok: true,
          status: "absent",
          generation: null,
          maintenanceRequired: loaded.maintenanceRequired,
          recovered: false,
          view: null,
        });
      const profile = loaded.value.profile;
      const claims =
        request.claimId === null
          ? profile.claims
          : profile.claims.filter((item) => item.claimId === request.claimId);
      if (request.claimId !== null && claims.length === 0) return failure("not-found");
      // Notes and source-relative paths remain private Store data, never normal output.
      const historical = new Set(profile.corrections.map((item) => item.targetClaimRef));
      const view = claims.map((claim) => ({
        claimId: claim.claimId,
        capability: claim.capability,
        state: claim.state,
        observedDepth: claim.observedDepth,
        confidence: claim.confidence,
        scope: claim.scope,
        projectRef: claim.projectRef,
        freshness: claim.freshness,
        historical: historical.has(claim.claimId),
        basisKind: claim.basis.kind,
        correctionRef: claim.basis.correctionRef,
        declarationRef: claim.basis.declarationRef,
        evidence:
          request.claimId === null
            ? undefined
            : profile.evidence
                .filter((item) => claim.basis.evidenceRefs.includes(item.evidenceId))
                .map((item) => ({
                  evidenceId: item.evidenceId,
                  authorAssessment: item.authorAssessment.state,
                  strength: item.strength,
                  freshness: item.freshness,
                  fingerprint: item.invalidation.fingerprint,
                })),
        corrections:
          request.claimId === null
            ? undefined
            : profile.corrections
                .filter(
                  (item) =>
                    item.targetClaimRef === claim.claimId ||
                    item.targetClaimRef ===
                      profile.corrections.find(
                        (correction) => correction.correctionId === claim.basis.correctionRef,
                      )?.targetClaimRef,
                )
                .map((item) => ({
                  correctionId: item.correctionId,
                  kind: item.kind,
                  targetClaimRef: item.targetClaimRef,
                  createdAt: item.createdAt,
                })),
      }));
      if (Buffer.byteLength(JSON.stringify(view), "utf8") > ownerWorkflowMaximumOutputBytes - 1024)
        return failure("limit-exceeded");
      return freeze({
        ok: true,
        status: "inspected",
        generation: loaded.value.internalState.generation,
        maintenanceRequired: loaded.maintenanceRequired,
        recovered: loaded.status === "recovered",
        view,
      });
    }
    const conflict = checkMutation(loaded, request);
    if (conflict !== null) return conflict;
    const profile = loaded.value?.profile ?? emptyProfile();
    const changed =
      request.operation === "declare"
        ? declare(profile, request, loaded.nextGeneration)
        : correct(profile, request, loaded.nextGeneration);
    if ("ok" in changed) return changed;
    return commit(configuration, loaded, changed, request.at, options);
  } catch {
    return failure("invalid-input");
  }
}

/** Save authentic automated output while preserving owner history and effective disputes. */
export async function saveOwnerDerivation(
  configuration: ResolvedLocalProfileStoreConfig,
  derivation: EvidenceClaimDerivationSnapshot,
  requestJson: string,
  options: OwnerWorkflowOptions = {},
): Promise<OwnerWorkflowResult> {
  if (!isIssuedLocalProfileStoreConfig(configuration)) return failure("not-configured");
  if (!isIssuedEvidenceClaimDerivation(derivation)) return failure("invalid-input");
  try {
    const request = json(requestJson);
    if (
      !shape(request, ["version", "expectedGeneration", "at"]) ||
      request["version"] !== "0.1.0" ||
      !mutation(request)
    )
      return failure("invalid-input");
    if (derivation.subjectRef !== configuration.subjectRef || derivation.derivedAt > request.at)
      return failure("invalid-input");
    const loaded = await loadLocalProfileStore(configuration, portOptions(options));
    if (!loaded.ok) return loaded;
    const conflict = checkMutation(loaded, request);
    if (conflict !== null) return conflict;
    const prior = loaded.value?.profile ?? emptyProfile();
    if (loaded.value !== null && derivation.derivedAt < loaded.value.internalState.lastValidatedAt)
      return failure("invalid-input");
    const targets = new Set(prior.corrections.map((item) => item.targetClaimRef));
    const preserved = prior.claims
      .filter(
        (item) =>
          targets.has(item.claimId) || item.state === "disputed" || item.state === "self-declared",
      )
      .map((item) => {
        if (item.state !== "disputed") return item;
        const current = derivation.claims.find((claim) => scopeKey(claim) === scopeKey(item));
        const unchanged = item.basis.evidenceRefs.every((id) => {
          const archived = prior.evidence.find((evidence) => evidence.evidenceId === id);
          return (
            archived !== undefined &&
            derivation.evidence.some(
              (evidence) =>
                evidence.source.repositoryRef === archived.source.repositoryRef &&
                evidence.source.sourceRelativeRef === archived.source.sourceRelativeRef &&
                evidence.invalidation.fingerprint === archived.invalidation.fingerprint,
            )
          );
        });
        return {
          ...item,
          freshness: {
            ...item.freshness,
            stale:
              item.freshness.stale ||
              current === undefined ||
              current.freshness.stale ||
              current.freshness.observedThrough !== item.freshness.observedThrough ||
              !unchanged,
          },
        };
      });
    const correctedScopes = new Set(
      preserved.filter((item) => item.state === "disputed").map(scopeKey),
    );
    const automated = derivation.claims.filter((item) => !correctedScopes.has(scopeKey(item)));
    const claims = [...preserved, ...automated];
    const retainedRefs = new Set(preserved.flatMap((item) => item.basis.evidenceRefs));
    const liveRefs = new Set(automated.flatMap((item) => item.basis.evidenceRefs));
    const historicalEvidence = prior.evidence.filter((item) => retainedRefs.has(item.evidenceId));
    const liveEvidence = derivation.evidence.filter((item) => liveRefs.has(item.evidenceId));
    const evidence = [...historicalEvidence];
    for (const item of liveEvidence) {
      const existing = evidence.find((old) => old.evidenceId === item.evidenceId);
      if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(item))
        return failure("invalid-input");
      if (existing === undefined) evidence.push(item);
    }
    return commit(
      configuration,
      loaded,
      {
        ...prior,
        claims,
        evidence,
        projectRefs: [
          ...new Set([
            ...derivation.projectRefs,
            ...preserved.flatMap((item) => (item.projectRef === null ? [] : [item.projectRef])),
          ]),
        ].sort(),
      },
      request.at,
      options,
    );
  } catch {
    return failure("invalid-input");
  }
}

function correct(
  profile: ProfilePayload,
  request: Extract<OwnerRequest, { operation: "correct" | "dispute" | "reject" }>,
  generation: number,
): ProfilePayload | OwnerFailure {
  const target = profile.claims.find((item) => item.claimId === request.claimId);
  if (target === undefined) return failure("not-found");
  if (target.freshness.observedThrough !== null && target.freshness.observedThrough > request.at)
    return failure("invalid-input");
  if (
    target.state === "self-declared" ||
    target.basis.evidenceRefs.length === 0 ||
    target.freshness.observedThrough === null ||
    profile.corrections.some((item) => item.targetClaimRef === target.claimId)
  )
    return failure("unsupported-target");
  let claims = [...profile.claims];
  const evidence = [...profile.evidence];
  let original: Claim;
  if (target.state === "disputed") {
    const correction = profile.corrections.find(
      (item) => item.correctionId === target.basis.correctionRef,
    );
    const archived = profile.claims.find((item) => item.claimId === correction?.targetClaimRef);
    if (
      archived === undefined ||
      archived.claimId === target.claimId ||
      scopeKey(archived) !== scopeKey(target)
    )
      return failure("unsupported-target");
    original = archived;
  } else {
    const references: string[] = [];
    for (const reference of target.basis.evidenceRefs) {
      const source = profile.evidence.find((item) => item.evidenceId === reference);
      if (source === undefined) return failure("invalid-input");
      const archived = { ...source, evidenceId: opaque("owner_evidence", source) };
      const existing = evidence.find((item) => item.evidenceId === archived.evidenceId);
      if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(archived))
        return failure("invalid-input");
      if (existing === undefined) evidence.push(archived);
      references.push(archived.evidenceId);
    }
    original = {
      ...target,
      claimId: opaque("owner_history", target),
      basis: { ...target.basis, evidenceRefs: references },
    };
    if (claims.some((item) => item.claimId === original.claimId)) return failure("invalid-input");
    claims.push(original);
  }
  const correction: Correction = {
    correctionId: opaque("owner_correction", [generation, request]),
    kind: request.operation === "reject" ? "rejection" : "adjustment",
    capability: target.capability,
    targetClaimRef: original.claimId,
    summary: request.summary,
    createdAt: request.at,
  };
  const disputed: Claim = {
    ...target,
    state: "disputed",
    confidence: "low",
    basis: {
      kind: "dispute",
      evidenceRefs: original.basis.evidenceRefs,
      adjacentFrom: [],
      rationale: null,
      declarationRef: null,
      correctionRef: correction.correctionId,
      correctionSummary: "Owner correction overrides automated assessment.",
    },
  };
  claims = claims.map((item) => (item.claimId === target.claimId ? disputed : item));
  return { ...profile, claims, evidence, corrections: [...profile.corrections, correction] };
}

function declare(
  profile: ProfilePayload,
  request: Extract<OwnerRequest, { operation: "declare" }>,
  generation: number,
): ProfilePayload {
  const declaration = {
    declarationId: opaque("owner_declaration", [generation, request]),
    capability: request.capability,
    summary: request.summary,
    declaredAt: request.at,
  };
  const claim: Claim = {
    schemaVersion: "0.1.0",
    claimId: opaque("owner_claim", declaration),
    capability: request.capability,
    state: "self-declared",
    observedDepth: null,
    confidence: "low",
    scope: request.projectRef === null ? "global" : "project",
    projectRef: request.projectRef,
    basis: {
      kind: "declaration",
      evidenceRefs: [],
      adjacentFrom: [],
      rationale: null,
      declarationRef: declaration.declarationId,
      correctionRef: null,
      correctionSummary: null,
    },
    limitations: ["Owner declaration is not observed evidence."],
    freshness: { observedThrough: null, stale: false },
  };
  return {
    ...profile,
    claims: [...profile.claims, claim],
    declarations: [...profile.declarations, declaration],
    projectRefs: [
      ...new Set([
        ...profile.projectRefs,
        ...(request.projectRef === null ? [] : [request.projectRef]),
      ]),
    ].sort(),
  };
}

async function commit(
  configuration: ResolvedLocalProfileStoreConfig,
  loaded: Extract<LoadLocalProfileStoreResult, { ok: true }>,
  profile: ProfilePayload,
  at: string,
  options: OwnerWorkflowOptions,
): Promise<OwnerWorkflowResult> {
  const prior = loaded.value;
  const candidate: CommunityProfileStore = {
    storeSchemaVersion: "0.1.0",
    kind: "community-profile-store",
    storeId: configuration.storeId,
    subjectRef: configuration.subjectRef,
    profileVersion: `owner_generation_${loaded.nextGeneration}`,
    profile,
    internalState: {
      generation: loaded.nextGeneration,
      createdAt: prior?.internalState.createdAt ?? at,
      updatedAt: at,
      lastValidatedAt: at,
      migratedFromStoreSchemaVersion: prior?.internalState.migratedFromStoreSchemaVersion ?? null,
    },
  };
  const serialized = serializeCommunityProfileStore(candidate);
  if (!serialized.ok) return serialized;
  const written = await writeLocalProfileStore(configuration, serialized.value, {
    ...options,
    expectedGeneration: prior?.internalState.generation ?? null,
  });
  if (!written.ok) return written;
  return freeze({
    ok: true,
    status: "saved",
    generation: written.value.internalState.generation,
    maintenanceRequired: written.maintenanceRequired,
    recovered: loaded.status === "recovered",
    view: null,
  });
}
function checkMutation(
  loaded: Extract<LoadLocalProfileStoreResult, { ok: true }>,
  request: Mutation,
): OwnerFailure | null {
  if ((loaded.value?.internalState.generation ?? null) !== request.expectedGeneration)
    return failure("conflict", true);
  if (
    loaded.value !== null &&
    (loaded.value.internalState.lastValidatedAt > request.at ||
      loaded.value.profile.corrections.some((item) => item.createdAt > request.at) ||
      loaded.value.profile.declarations.some((item) => item.declaredAt > request.at))
  )
    return failure("invalid-input");
  return null;
}
function emptyProfile(): ProfilePayload {
  return {
    projectRefs: [],
    evidence: [],
    claims: [],
    declarations: [],
    corrections: [],
    preferences: {
      explanationMode: "balanced",
      explainPurposeBeforeCommands: true,
      includeExpectedResult: true,
      includeRiskAndRollback: true,
      questionBudget: 1,
    },
  };
}
function parseRequest(text: string): OwnerRequest {
  const value = json(text);
  if (!record(value) || value["version"] !== "0.1.0") throw new Error("invalid");
  if (
    value["operation"] === "inspect" &&
    shape(value, ["version", "operation", "claimId"]) &&
    (value["claimId"] === null || identifier(value["claimId"]))
  )
    return value as unknown as OwnerRequest;
  if (!mutation(value) || !note(value["summary"])) throw new Error("invalid");
  if (
    ["correct", "dispute", "reject"].includes(String(value["operation"])) &&
    shape(value, ["version", "operation", "claimId", "summary", "expectedGeneration", "at"]) &&
    identifier(value["claimId"])
  )
    return value as unknown as OwnerRequest;
  if (
    value["operation"] === "declare" &&
    shape(value, [
      "version",
      "operation",
      "capability",
      "projectRef",
      "summary",
      "expectedGeneration",
      "at",
    ]) &&
    typeof value["capability"] === "string" &&
    /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*(?![\s\S])/u.test(value["capability"]) &&
    value["capability"].length <= 128 &&
    (value["projectRef"] === null || identifier(value["projectRef"]))
  )
    return value as unknown as OwnerRequest;
  throw new Error("invalid");
}
function json(text: string): unknown {
  if (
    typeof text !== "string" ||
    !text.isWellFormed() ||
    Buffer.byteLength(text, "utf8") > ownerWorkflowMaximumInputBytes
  )
    throw new Error("invalid");
  return JSON.parse(text);
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
function mutation(value: Record<string, unknown>): value is Record<string, unknown> & Mutation {
  return (
    (value["expectedGeneration"] === null ||
      (Number.isSafeInteger(value["expectedGeneration"]) &&
        Number(value["expectedGeneration"]) >= 0)) &&
    timestamp(value["at"])
  );
}
function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z(?![\s\S])/u.test(value))
    return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value.replace("Z", ".000Z");
}
function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}(?![\s\S])/u.test(value);
}
function note(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.isWellFormed() &&
    value.trim().length > 0 &&
    value.length <= 256 &&
    [...value].every((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
  );
}
function opaque(prefix: string, value: unknown): string {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}
function scopeKey(claim: Claim): string {
  return JSON.stringify([claim.capability, claim.scope, claim.projectRef]);
}
function portOptions(options: OwnerWorkflowOptions): { readonly port?: LocalProfileStoreFilePort } {
  return options.port === undefined ? {} : { port: options.port };
}
function failure(category: OwnerErrorCategory, retryable = false): OwnerFailure {
  return freeze({ ok: false, error: { category, retryable } });
}
function freeze<Value>(value: Value): Value {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
