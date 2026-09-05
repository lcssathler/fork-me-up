import { Buffer } from "node:buffer";

import type { AuthorAssessmentState, Confidence, ObservedDepth } from "@fork-me-up/protocol";

import { localRepositoryConfigHardLimits } from "./authorized-repository-config.ts";
import {
  isIssuedDeveloperIdentityConfig,
  type GitCommitAnnotationKind,
  type GitIdentityRole,
  type ResolvedDeveloperIdentityConfig,
} from "./developer-identity-config.ts";
import {
  gitMetadataHardLimits,
  gitMetadataSnapshotVersion,
  type GitCommitMetadata,
  type GitMetadataSnapshot,
  type RepositoryGitMetadata,
} from "./git-metadata-collector.ts";
import type { GitObjectFormat } from "./bounded-git-command.ts";

export const gitAuthorshipAssessmentVersion = "0.1.0" as const;

export type GitAttributionState =
  "attributed" | "shared" | "coauthored" | "bot" | "pair-work" | "unknown";

export type GitHistoryShape = "ordinary" | "merge" | "squash";

export type GitAuthorshipLimitation =
  | "automated-contributor"
  | "bot-authored"
  | "coauthored"
  | "distinct-committer"
  | "history-truncated"
  | "merge-commit"
  | "pair-work-declared"
  | "shared-identity"
  | "shallow-history"
  | "squash-history"
  | "unknown-authorship"
  | "unmatched-coauthor";

export interface GitCommitAuthorshipAssessment {
  readonly commitObjectId: string;
  readonly observedAt: string;
  readonly attributionState: GitAttributionState;
  readonly historyShape: GitHistoryShape;
  readonly evidenceAuthorAssessment: {
    readonly state: AuthorAssessmentState;
    readonly subjectRef: string | null;
  };
  readonly botInvolved: boolean;
  readonly depthCeiling: ObservedDepth | null;
  readonly confidenceCeiling: Confidence;
  readonly standaloneDemonstratedDepthAllowed: false;
  readonly limitations: readonly GitAuthorshipLimitation[];
}

export interface RepositoryGitAuthorshipAssessment {
  readonly repositoryId: string;
  readonly rootId: string;
  readonly assessments: readonly GitCommitAuthorshipAssessment[];
}

export interface GitAuthorshipAssessmentSnapshot {
  readonly kind: "git-authorship-assessment-snapshot";
  readonly assessmentVersion: typeof gitAuthorshipAssessmentVersion;
  readonly sourceSnapshotVersion: typeof gitMetadataSnapshotVersion;
  readonly subjectRef: string;
  readonly repositories: readonly RepositoryGitAuthorshipAssessment[];
}

export type GitAuthorshipAssessmentErrorCategory =
  "invalid-input" | "not-configured" | "configuration-mismatch" | "limit-exceeded";

export type AssessGitAuthorshipResult =
  | { readonly ok: true; readonly value: GitAuthorshipAssessmentSnapshot }
  | {
      readonly ok: false;
      readonly error: {
        readonly category: GitAuthorshipAssessmentErrorCategory;
        readonly retryable: false;
      };
    };

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;
const digestPattern = /^[0-9a-f]{64}$/u;

class AssessmentFault extends Error {
  readonly category: GitAuthorshipAssessmentErrorCategory;

  constructor(category: GitAuthorshipAssessmentErrorCategory) {
    super(category);
    this.category = category;
  }
}

export function assessGitAuthorship(
  snapshotInput: unknown,
  configuration: ResolvedDeveloperIdentityConfig,
): AssessGitAuthorshipResult {
  if (!isIssuedDeveloperIdentityConfig(configuration)) return failure("not-configured");
  try {
    const snapshot = validateSnapshot(snapshotInput);
    const roles = new Map(
      configuration.identities.map((identity) => [identity.identityDigest, identity.role]),
    );
    const annotations = resolveAnnotations(snapshot, configuration);
    const repositories = snapshot.repositories
      .map((repository) =>
        assessRepository(repository, configuration.subjectRef, roles, annotations),
      )
      .sort((left, right) => compareText(left.repositoryId, right.repositoryId));
    return deepFreeze({
      ok: true,
      value: {
        kind: "git-authorship-assessment-snapshot",
        assessmentVersion: gitAuthorshipAssessmentVersion,
        sourceSnapshotVersion: gitMetadataSnapshotVersion,
        subjectRef: configuration.subjectRef,
        repositories,
      },
    });
  } catch (error) {
    if (error instanceof AssessmentFault) return failure(error.category);
    return failure("invalid-input");
  }
}

function assessRepository(
  repository: RepositoryGitMetadata,
  subjectRef: string,
  roles: ReadonlyMap<string, GitIdentityRole>,
  annotations: ReadonlyMap<string, ReadonlySet<GitCommitAnnotationKind>>,
): RepositoryGitAuthorshipAssessment {
  const assessments = repository.commits
    .map((commit) => {
      const key = annotationKey(repository.repositoryId, commit.objectId);
      return assessCommit(
        commit,
        subjectRef,
        roles,
        annotations.get(key) ?? new Set<GitCommitAnnotationKind>(),
        repository.shallow,
        repository.historyTruncated,
      );
    })
    .sort((left, right) => compareText(left.commitObjectId, right.commitObjectId));
  return deepFreeze({
    repositoryId: repository.repositoryId,
    rootId: repository.rootId,
    assessments,
  });
}

function assessCommit(
  commit: GitCommitMetadata,
  subjectRef: string,
  roles: ReadonlyMap<string, GitIdentityRole>,
  annotations: ReadonlySet<GitCommitAnnotationKind>,
  shallow: boolean,
  historyTruncated: boolean,
): GitCommitAuthorshipAssessment {
  const authorRole = roles.get(commit.authorIdentityDigest);
  const coauthorRoles = commit.coauthorIdentityDigests.map((digest) => roles.get(digest));
  const developerIsCoauthor = coauthorRoles.includes("developer");
  const developerIsAuthor = authorRole === "developer";
  const pairWork = annotations.has("pair-work");
  const attributionState: GitAttributionState = pairWork
    ? "pair-work"
    : developerIsCoauthor || (developerIsAuthor && commit.coauthorIdentityDigests.length > 0)
      ? "coauthored"
      : developerIsAuthor
        ? "attributed"
        : authorRole === "shared"
          ? "shared"
          : authorRole === "bot"
            ? "bot"
            : "unknown";
  const historyShape: GitHistoryShape = annotations.has("squash")
    ? "squash"
    : commit.parentObjectIds.length > 1
      ? "merge"
      : "ordinary";
  const botInvolved =
    authorRole === "bot" ||
    roles.get(commit.committerIdentityDigest) === "bot" ||
    coauthorRoles.includes("bot");
  const limitations = limitationsFor({
    attributionState,
    historyShape,
    botInvolved,
    committerDiffers: commit.committerIdentityDigest !== commit.authorIdentityDigest,
    unmatchedCoauthor: coauthorRoles.includes(undefined),
    shallow,
    historyTruncated,
  });
  const evidenceState = evidenceStateFor(attributionState);
  const ceilings = ceilingsFor(attributionState, historyShape);
  return deepFreeze({
    commitObjectId: commit.objectId,
    observedAt: commit.committedAt,
    attributionState,
    historyShape,
    evidenceAuthorAssessment: {
      state: evidenceState,
      subjectRef:
        evidenceState === "attributed" || evidenceState === "coauthored" ? subjectRef : null,
    },
    botInvolved,
    depthCeiling: ceilings.depth,
    confidenceCeiling: ceilings.confidence,
    standaloneDemonstratedDepthAllowed: false as const,
    limitations,
  });
}

function limitationsFor(input: {
  readonly attributionState: GitAttributionState;
  readonly historyShape: GitHistoryShape;
  readonly botInvolved: boolean;
  readonly committerDiffers: boolean;
  readonly unmatchedCoauthor: boolean;
  readonly shallow: boolean;
  readonly historyTruncated: boolean;
}): readonly GitAuthorshipLimitation[] {
  const limitations = new Set<GitAuthorshipLimitation>();
  if (input.attributionState === "shared") limitations.add("shared-identity");
  if (input.attributionState === "coauthored") limitations.add("coauthored");
  if (input.attributionState === "bot") limitations.add("bot-authored");
  if (input.attributionState === "pair-work") limitations.add("pair-work-declared");
  if (input.attributionState === "unknown") limitations.add("unknown-authorship");
  if (input.historyShape === "merge") limitations.add("merge-commit");
  if (input.historyShape === "squash") limitations.add("squash-history");
  if (input.botInvolved) limitations.add("automated-contributor");
  if (input.committerDiffers) limitations.add("distinct-committer");
  if (input.unmatchedCoauthor) limitations.add("unmatched-coauthor");
  if (input.shallow) limitations.add("shallow-history");
  if (input.historyTruncated) limitations.add("history-truncated");
  return Object.freeze([...limitations].sort(compareText));
}

function evidenceStateFor(state: GitAttributionState): AuthorAssessmentState {
  if (state === "attributed") return "attributed";
  if (state === "coauthored" || state === "pair-work") return "coauthored";
  if (state === "bot") return "bot";
  return "unknown";
}

function ceilingsFor(
  state: GitAttributionState,
  historyShape: GitHistoryShape,
): { readonly depth: ObservedDepth | null; readonly confidence: Confidence } {
  if (state === "attributed") {
    return historyShape === "squash"
      ? Object.freeze({ depth: "exposure", confidence: "low" })
      : Object.freeze({ depth: "practical-use", confidence: "medium" });
  }
  if (state === "coauthored" || state === "pair-work") {
    return Object.freeze({ depth: "exposure", confidence: "low" });
  }
  return Object.freeze({ depth: null, confidence: "low" });
}

function resolveAnnotations(
  snapshot: GitMetadataSnapshot,
  configuration: ResolvedDeveloperIdentityConfig,
): ReadonlyMap<string, ReadonlySet<GitCommitAnnotationKind>> {
  const repositories = new Map(
    snapshot.repositories.map((repository) => [repository.repositoryId, repository]),
  );
  const result = new Map<string, Set<GitCommitAnnotationKind>>();
  for (const annotation of configuration.annotations) {
    const repository = repositories.get(annotation.repositoryId);
    if (
      repository === undefined ||
      !isObjectIdForFormat(annotation.commitObjectId, repository.objectFormat) ||
      !repository.commits.some((commit) => commit.objectId === annotation.commitObjectId)
    ) {
      throw new AssessmentFault("configuration-mismatch");
    }
    const key = annotationKey(annotation.repositoryId, annotation.commitObjectId);
    const kinds = result.get(key) ?? new Set<GitCommitAnnotationKind>();
    kinds.add(annotation.kind);
    result.set(key, kinds);
  }
  return result;
}

function validateSnapshot(value: unknown): GitMetadataSnapshot {
  if (!isRecord(value) || !hasExactKeys(value, ["kind", "snapshotVersion", "repositories"])) {
    throw new AssessmentFault("invalid-input");
  }
  if (
    value["kind"] !== "git-metadata-snapshot" ||
    value["snapshotVersion"] !== gitMetadataSnapshotVersion ||
    !Array.isArray(value["repositories"]) ||
    value["repositories"].length < 1 ||
    value["repositories"].length > localRepositoryConfigHardLimits.maxRepositories
  ) {
    throw new AssessmentFault("invalid-input");
  }
  const repositoryIds = new Set<string>();
  for (const repository of value["repositories"]) {
    validateRepository(repository, repositoryIds);
  }
  return value as unknown as GitMetadataSnapshot;
}

function validateRepository(value: unknown, repositoryIds: Set<string>): void {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "repositoryId",
      "rootId",
      "objectFormat",
      "headObjectId",
      "shallow",
      "historyTruncated",
      "totalCommitBytes",
      "commits",
    ]) ||
    !isIdentifier(value["repositoryId"]) ||
    !isIdentifier(value["rootId"]) ||
    repositoryIds.has(value["repositoryId"]) ||
    (value["objectFormat"] !== "sha1" && value["objectFormat"] !== "sha256") ||
    typeof value["headObjectId"] !== "string" ||
    !isObjectIdForFormat(value["headObjectId"], value["objectFormat"]) ||
    typeof value["shallow"] !== "boolean" ||
    typeof value["historyTruncated"] !== "boolean" ||
    !Number.isSafeInteger(value["totalCommitBytes"]) ||
    Number(value["totalCommitBytes"]) < 1 ||
    Number(value["totalCommitBytes"]) >
      localRepositoryConfigHardLimits.maxTotalBytesPerRepository ||
    !Array.isArray(value["commits"]) ||
    value["commits"].length < 1 ||
    value["commits"].length > gitMetadataHardLimits.maxCommits
  ) {
    throw new AssessmentFault("invalid-input");
  }
  repositoryIds.add(value["repositoryId"]);
  const commitIds = new Set<string>();
  let pathAssociations = 0;
  let pathBytes = 0;
  for (const commit of value["commits"]) {
    const pathTotals = validateCommit(commit, value["objectFormat"], commitIds);
    pathAssociations += pathTotals.associations;
    pathBytes += pathTotals.bytes;
    if (
      pathAssociations > localRepositoryConfigHardLimits.maxFilesPerRepository ||
      pathBytes > localRepositoryConfigHardLimits.maxTotalBytesPerRepository
    ) {
      throw new AssessmentFault("limit-exceeded");
    }
  }
  const first = value["commits"][0];
  if (!isRecord(first) || first["objectId"] !== value["headObjectId"]) {
    throw new AssessmentFault("invalid-input");
  }
}

function validateCommit(
  value: unknown,
  objectFormat: GitObjectFormat,
  commitIds: Set<string>,
): { readonly associations: number; readonly bytes: number } {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "objectId",
      "parentObjectIds",
      "authoredAt",
      "committedAt",
      "authorIdentityDigest",
      "committerIdentityDigest",
      "coauthorIdentityDigests",
      "changedPaths",
    ]) ||
    typeof value["objectId"] !== "string" ||
    !isObjectIdForFormat(value["objectId"], objectFormat) ||
    commitIds.has(value["objectId"]) ||
    !isTimestamp(value["authoredAt"]) ||
    !isTimestamp(value["committedAt"]) ||
    typeof value["authorIdentityDigest"] !== "string" ||
    !digestPattern.test(value["authorIdentityDigest"]) ||
    typeof value["committerIdentityDigest"] !== "string" ||
    !digestPattern.test(value["committerIdentityDigest"]) ||
    !isUniqueStringArray(
      value["parentObjectIds"],
      gitMetadataHardLimits.maxParentsPerCommit,
      (item) => isObjectIdForFormat(item, objectFormat),
    ) ||
    !isUniqueStringArray(
      value["coauthorIdentityDigests"],
      gitMetadataHardLimits.maxCoauthorsPerCommit,
      (item) => digestPattern.test(item),
    ) ||
    !isUniqueStringArray(
      value["changedPaths"],
      localRepositoryConfigHardLimits.maxFilesPerRepository,
      isSafeRelativePath,
    )
  ) {
    throw new AssessmentFault("invalid-input");
  }
  commitIds.add(value["objectId"]);
  return {
    associations: value["changedPaths"].length,
    bytes: value["changedPaths"].reduce((sum, item) => sum + Buffer.byteLength(item, "utf8"), 0),
  };
}

function isUniqueStringArray(
  value: unknown,
  maximumItems: number,
  validator: (item: string) => boolean,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maximumItems &&
    value.every((item) => typeof item === "string" && validator(item)) &&
    new Set(value).size === value.length
  );
}

function isTimestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.[0-9]{3}Z$/u.test(
      value,
    )
  ) {
    return false;
  }
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function isSafeRelativePath(value: string): boolean {
  return (
    value.length > 0 &&
    !value.startsWith("/") &&
    Buffer.byteLength(value, "utf8") <= localRepositoryConfigHardLimits.maxRelativePathBytes &&
    !/[\\:]/u.test(value) &&
    !containsUnsafeControl(value) &&
    value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}

function containsUnsafeControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x1f || codeUnit === 0x7f) return true;
  }
  return false;
}

function isObjectIdForFormat(value: string, format: GitObjectFormat): boolean {
  return value.length === (format === "sha1" ? 40 : 64) && /^[0-9a-f]+$/u.test(value);
}

function annotationKey(repositoryId: string, commitObjectId: string): string {
  return `${repositoryId}\0${commitObjectId}`;
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

function failure(category: GitAuthorshipAssessmentErrorCategory): AssessGitAuthorshipResult {
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
