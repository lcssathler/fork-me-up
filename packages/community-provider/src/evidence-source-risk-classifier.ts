import { Buffer } from "node:buffer";

import type { Confidence, ObservedDepth } from "@fork-me-up/protocol";

import { localRepositoryConfigHardLimits } from "./authorized-repository-config.ts";
import {
  type EvidenceSourceRiskFlag,
  isIssuedEvidenceSourceRiskConfig,
  type ResolvedEvidenceSourceRiskConfig,
} from "./evidence-source-risk-config.ts";
import {
  filesystemMetadataSnapshotVersion,
  type FilesystemMetadataFile,
  type FilesystemMetadataSnapshot,
  type RepositoryFilesystemMetadata,
} from "./filesystem-metadata-collector.ts";
import {
  isIssuedGitAuthorshipAssessment,
  type GitAttributionState,
  type GitAuthorshipAssessmentSnapshot,
  type GitAuthorshipLimitation,
  type GitCommitAuthorshipAssessment,
  validateGitMetadataSnapshot,
} from "./git-authorship-assessment.ts";
import {
  gitMetadataSnapshotVersion,
  type GitMetadataSnapshot,
  type RepositoryGitMetadata,
} from "./git-metadata-collector.ts";

export const evidenceSourceRiskSnapshotVersion = "0.1.0" as const;

export type EvidenceSourceLimitation =
  | "exact-content-duplicate"
  | "explicit-path-annotation"
  | "explicit-repository-annotation"
  | "history-truncated"
  | "multiple-source-risks"
  | "no-bounded-commit-association"
  | "no-target-attribution"
  | "origin-unverified"
  | "path-indicator-only"
  | "shallow-history";

export interface EvidenceSourceRiskRecord {
  readonly sourceRelativeRef: string;
  readonly contentDigest: { readonly algorithm: "sha256"; readonly value: string };
  readonly sourceCategory: "document" | "manifest" | "source";
  readonly sourceLanguage: string | null;
  readonly associatedCommitObjectIds: readonly string[];
  readonly attributionStates: readonly GitAttributionState[];
  readonly authorshipLimitations: readonly GitAuthorshipLimitation[];
  readonly authorshipDepthCeiling: ObservedDepth | null;
  readonly authorshipConfidenceCeiling: Confidence;
  readonly riskFlags: readonly EvidenceSourceRiskFlag[];
  readonly sourceLimitations: readonly EvidenceSourceLimitation[];
  readonly duplicateCount: number;
  readonly supportLevel: "normal" | "reduced";
  readonly strengthCeiling: "moderate" | "weak";
  readonly standaloneDemonstratedDepthAllowed: false;
}

export interface RepositoryEvidenceSourceRisk {
  readonly repositoryId: string;
  readonly rootId: string;
  readonly headRevisionRef: string;
  readonly records: readonly EvidenceSourceRiskRecord[];
}

export interface EvidenceSourceRiskSnapshot {
  readonly kind: "evidence-source-risk-snapshot";
  readonly classificationVersion: typeof evidenceSourceRiskSnapshotVersion;
  readonly filesystemSnapshotVersion: typeof filesystemMetadataSnapshotVersion;
  readonly gitSnapshotVersion: typeof gitMetadataSnapshotVersion;
  readonly authorshipAssessmentVersion: string;
  readonly subjectRef: string;
  readonly repositories: readonly RepositoryEvidenceSourceRisk[];
}

export type EvidenceSourceRiskErrorCategory =
  | "configuration-mismatch"
  | "invalid-input"
  | "limit-exceeded"
  | "not-configured"
  | "snapshot-mismatch"
  | "untrusted-authorship";

export type ClassifyEvidenceSourceRiskResult =
  | { readonly ok: true; readonly value: EvidenceSourceRiskSnapshot }
  | {
      readonly ok: false;
      readonly error: {
        readonly category: EvidenceSourceRiskErrorCategory;
        readonly retryable: false;
      };
    };

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;
const digestPattern = /^[0-9a-f]{64}$/u;
const issuedRiskSnapshots = new WeakSet<object>();
const generatedDirectories = new Set(["build", "dist", "gen", "generated"]);
const vendoredDirectories = new Set([
  "external",
  "third-party",
  "third_party",
  "vendor",
  "vendors",
]);
const tutorialDirectories = new Set([
  "demo",
  "demos",
  "example",
  "examples",
  "sample",
  "samples",
  "tutorial",
  "tutorials",
]);
const templateDirectories = new Set([
  "boilerplate",
  "scaffold",
  "scaffolds",
  "template",
  "templates",
]);

class SourceRiskFault extends Error {
  readonly category: EvidenceSourceRiskErrorCategory;

  constructor(category: EvidenceSourceRiskErrorCategory) {
    super(category);
    this.category = category;
  }
}

export function classifyEvidenceSourceRisk(
  filesystemInput: unknown,
  gitInput: unknown,
  authorship: GitAuthorshipAssessmentSnapshot,
  configuration: ResolvedEvidenceSourceRiskConfig,
): ClassifyEvidenceSourceRiskResult {
  if (!isIssuedEvidenceSourceRiskConfig(configuration)) return failure("not-configured");
  if (!isIssuedGitAuthorshipAssessment(authorship)) return failure("untrusted-authorship");
  try {
    const filesystem = validateFilesystemSnapshot(filesystemInput);
    const git = validateGitMetadataSnapshot(gitInput);
    const repositories = correlateSnapshots(filesystem, git, authorship, configuration);
    const duplicateCounts = countDigests(filesystem);
    const repositoryAnnotations = new Map(
      configuration.repositoryAnnotations.map((annotation) => [
        annotation.repositoryId,
        annotation.riskFlags,
      ]),
    );
    const pathAnnotations = new Map(
      configuration.pathAnnotations.map((annotation) => [
        recordKey(annotation.repositoryId, annotation.sourceRelativeRef),
        annotation.riskFlags,
      ]),
    );
    const value = deepFreeze({
      kind: "evidence-source-risk-snapshot" as const,
      classificationVersion: evidenceSourceRiskSnapshotVersion,
      filesystemSnapshotVersion: filesystemMetadataSnapshotVersion,
      gitSnapshotVersion: gitMetadataSnapshotVersion,
      authorshipAssessmentVersion: authorship.assessmentVersion,
      subjectRef: authorship.subjectRef,
      repositories: repositories.map(({ filesystemRepository, gitRepository, assessments }) => ({
        repositoryId: filesystemRepository.repositoryId,
        rootId: filesystemRepository.rootId,
        headRevisionRef: gitRepository.headObjectId,
        records: filesystemRepository.files
          .map((file) =>
            classifyFile(
              filesystemRepository.repositoryId,
              file,
              gitRepository,
              assessments,
              duplicateCounts,
              repositoryAnnotations,
              pathAnnotations,
            ),
          )
          .sort((left, right) => compareText(left.sourceRelativeRef, right.sourceRelativeRef)),
      })),
    });
    issuedRiskSnapshots.add(value);
    return deepFreeze({ ok: true as const, value });
  } catch (error) {
    return failure(error instanceof SourceRiskFault ? error.category : "invalid-input");
  }
}

export function isIssuedEvidenceSourceRiskSnapshot(value: EvidenceSourceRiskSnapshot): boolean {
  return typeof value === "object" && value !== null && issuedRiskSnapshots.has(value);
}

function classifyFile(
  repositoryId: string,
  file: FilesystemMetadataFile,
  git: RepositoryGitMetadata,
  assessments: ReadonlyMap<string, GitCommitAuthorshipAssessment>,
  duplicateCounts: ReadonlyMap<string, number>,
  repositoryAnnotations: ReadonlyMap<string, readonly EvidenceSourceRiskFlag[]>,
  pathAnnotations: ReadonlyMap<string, readonly EvidenceSourceRiskFlag[]>,
): EvidenceSourceRiskRecord {
  const riskFlags = new Set<EvidenceSourceRiskFlag>();
  const sourceLimitations = new Set<EvidenceSourceLimitation>();
  const repositoryRisks = repositoryAnnotations.get(repositoryId) ?? [];
  const pathRisks = pathAnnotations.get(recordKey(repositoryId, file.relativePath)) ?? [];
  addRisks(riskFlags, repositoryRisks);
  addRisks(riskFlags, pathRisks);
  if (repositoryRisks.length > 0) sourceLimitations.add("explicit-repository-annotation");
  if (pathRisks.length > 0) sourceLimitations.add("explicit-path-annotation");

  const indicated = pathIndicators(file.relativePath);
  addRisks(riskFlags, indicated);
  if (indicated.length > 0) sourceLimitations.add("path-indicator-only");

  const duplicateCount = duplicateCounts.get(file.digest.value) ?? 1;
  if (duplicateCount > 1) {
    riskFlags.add("duplicated");
    sourceLimitations.add("exact-content-duplicate");
  }

  const associated = git.commits
    .filter((commit) => commit.changedPaths.includes(file.relativePath))
    .map((commit) => assessments.get(commit.objectId))
    .filter((assessment): assessment is GitCommitAuthorshipAssessment => assessment !== undefined)
    .sort((left, right) => compareText(left.commitObjectId, right.commitObjectId));
  if (associated.length === 0) {
    riskFlags.add("uncertain");
    sourceLimitations.add("no-bounded-commit-association");
  } else if (
    !associated.some(
      (assessment) =>
        assessment.evidenceAuthorAssessment.state === "attributed" ||
        assessment.evidenceAuthorAssessment.state === "coauthored",
    )
  ) {
    riskFlags.add("uncertain");
    sourceLimitations.add("no-target-attribution");
  }
  if (git.shallow) sourceLimitations.add("shallow-history");
  if (git.historyTruncated) sourceLimitations.add("history-truncated");
  if (riskFlags.size > 1) sourceLimitations.add("multiple-source-risks");
  if (riskFlags.size === 0) sourceLimitations.add("origin-unverified");

  const risky = riskFlags.size > 0;
  const targetAssessments = associated.filter(
    (assessment) =>
      assessment.evidenceAuthorAssessment.state === "attributed" ||
      assessment.evidenceAuthorAssessment.state === "coauthored",
  );
  const collaborativeAttribution = associated.some(
    (assessment) =>
      assessment.attributionState === "coauthored" || assessment.attributionState === "pair-work",
  );
  return deepFreeze({
    sourceRelativeRef: file.relativePath,
    contentDigest: { algorithm: "sha256" as const, value: file.digest.value },
    sourceCategory: file.category,
    sourceLanguage: file.category === "source" ? file.language : null,
    associatedCommitObjectIds: associated.map((assessment) => assessment.commitObjectId),
    attributionStates: uniqueSorted(associated.map((assessment) => assessment.attributionState)),
    authorshipLimitations: uniqueSorted(associated.flatMap((assessment) => assessment.limitations)),
    authorshipDepthCeiling:
      collaborativeAttribution && targetAssessments.length > 0
        ? "exposure"
        : aggregateDepthCeiling(targetAssessments),
    authorshipConfidenceCeiling: collaborativeAttribution
      ? "low"
      : aggregateConfidenceCeiling(targetAssessments),
    riskFlags: uniqueSorted([...riskFlags]),
    sourceLimitations: uniqueSorted([...sourceLimitations]),
    duplicateCount,
    supportLevel: risky ? ("reduced" as const) : ("normal" as const),
    strengthCeiling: risky ? ("weak" as const) : ("moderate" as const),
    standaloneDemonstratedDepthAllowed: false as const,
  });
}

function aggregateDepthCeiling(
  assessments: readonly GitCommitAuthorshipAssessment[],
): ObservedDepth | null {
  if (assessments.some((assessment) => assessment.depthCeiling === "practical-use")) {
    return "practical-use";
  }
  return assessments.some((assessment) => assessment.depthCeiling === "exposure")
    ? "exposure"
    : null;
}

function aggregateConfidenceCeiling(
  assessments: readonly GitCommitAuthorshipAssessment[],
): Confidence {
  return assessments.some((assessment) => assessment.confidenceCeiling === "medium")
    ? "medium"
    : "low";
}

function pathIndicators(relativePath: string): readonly EvidenceSourceRiskFlag[] {
  const segments = relativePath.toLowerCase().split("/");
  const directorySegments = segments.slice(0, -1);
  const name = segments.at(-1) ?? "";
  const result = new Set<EvidenceSourceRiskFlag>();
  if (directorySegments.some((segment) => generatedDirectories.has(segment))) {
    result.add("generated");
  }
  if (
    name.includes(".generated.") ||
    /\.g\.[a-z0-9]+$/u.test(name) ||
    /\.pb\.[a-z0-9]+$/u.test(name) ||
    /\.min\.(?:css|js)$/u.test(name)
  ) {
    result.add("generated");
  }
  if (directorySegments.some((segment) => vendoredDirectories.has(segment))) {
    result.add("vendored");
  }
  if (directorySegments.some((segment) => tutorialDirectories.has(segment))) {
    result.add("tutorial");
  }
  if (directorySegments.some((segment) => templateDirectories.has(segment))) {
    result.add("template");
  }
  return uniqueSorted([...result]);
}

function correlateSnapshots(
  filesystem: FilesystemMetadataSnapshot,
  git: GitMetadataSnapshot,
  authorship: GitAuthorshipAssessmentSnapshot,
  configuration: ResolvedEvidenceSourceRiskConfig,
): readonly {
  readonly filesystemRepository: RepositoryFilesystemMetadata;
  readonly gitRepository: RepositoryGitMetadata;
  readonly assessments: ReadonlyMap<string, GitCommitAuthorshipAssessment>;
}[] {
  const gitRepositories = new Map(
    git.repositories.map((repository) => [repository.repositoryId, repository]),
  );
  const authorshipRepositories = new Map(
    authorship.repositories.map((repository) => [repository.repositoryId, repository]),
  );
  if (
    filesystem.repositories.length !== git.repositories.length ||
    git.repositories.length !== authorship.repositories.length
  ) {
    throw new SourceRiskFault("snapshot-mismatch");
  }
  const result = filesystem.repositories.map((filesystemRepository) => {
    const gitRepository = gitRepositories.get(filesystemRepository.repositoryId);
    const authorshipRepository = authorshipRepositories.get(filesystemRepository.repositoryId);
    if (
      gitRepository === undefined ||
      authorshipRepository === undefined ||
      filesystemRepository.rootId !== gitRepository.rootId ||
      gitRepository.rootId !== authorshipRepository.rootId ||
      gitRepository.commits.length !== authorshipRepository.assessments.length
    ) {
      throw new SourceRiskFault("snapshot-mismatch");
    }
    const assessments = new Map(
      authorshipRepository.assessments.map((assessment) => [assessment.commitObjectId, assessment]),
    );
    if (gitRepository.commits.some((commit) => !assessments.has(commit.objectId))) {
      throw new SourceRiskFault("snapshot-mismatch");
    }
    return { filesystemRepository, gitRepository, assessments };
  });
  const fileKeys = new Set(
    filesystem.repositories.flatMap((repository) =>
      repository.files.map((file) => recordKey(repository.repositoryId, file.relativePath)),
    ),
  );
  const repositoryIds = new Set(
    filesystem.repositories.map((repository) => repository.repositoryId),
  );
  if (
    configuration.repositoryAnnotations.some(
      (annotation) => !repositoryIds.has(annotation.repositoryId),
    ) ||
    configuration.pathAnnotations.some(
      (annotation) =>
        !fileKeys.has(recordKey(annotation.repositoryId, annotation.sourceRelativeRef)),
    )
  ) {
    throw new SourceRiskFault("configuration-mismatch");
  }
  return result.sort((left, right) =>
    compareText(left.filesystemRepository.repositoryId, right.filesystemRepository.repositoryId),
  );
}

function validateFilesystemSnapshot(value: unknown): FilesystemMetadataSnapshot {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["kind", "snapshotVersion", "repositories"]) ||
    value["kind"] !== "filesystem-metadata-snapshot" ||
    value["snapshotVersion"] !== filesystemMetadataSnapshotVersion ||
    !Array.isArray(value["repositories"]) ||
    value["repositories"].length < 1 ||
    value["repositories"].length > localRepositoryConfigHardLimits.maxRepositories
  ) {
    throw new SourceRiskFault("invalid-input");
  }
  const repositoryIds = new Set<string>();
  for (const repository of value["repositories"])
    validateFilesystemRepository(repository, repositoryIds);
  return value as unknown as FilesystemMetadataSnapshot;
}

function validateFilesystemRepository(value: unknown, repositoryIds: Set<string>): void {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "repositoryId",
      "rootId",
      "visitedEntryCount",
      "ignoredDirectoryCount",
      "unsupportedFileCount",
      "bytesRead",
      "files",
    ]) ||
    !isIdentifier(value["repositoryId"]) ||
    !isIdentifier(value["rootId"]) ||
    repositoryIds.has(value["repositoryId"]) ||
    !isBoundedCount(
      value["visitedEntryCount"],
      localRepositoryConfigHardLimits.maxFilesPerRepository,
    ) ||
    !isBoundedCount(
      value["ignoredDirectoryCount"],
      localRepositoryConfigHardLimits.maxFilesPerRepository,
    ) ||
    !isBoundedCount(
      value["unsupportedFileCount"],
      localRepositoryConfigHardLimits.maxFilesPerRepository,
    ) ||
    !isBoundedCount(
      value["bytesRead"],
      localRepositoryConfigHardLimits.maxTotalBytesPerRepository,
    ) ||
    !Array.isArray(value["files"]) ||
    value["files"].length > localRepositoryConfigHardLimits.maxFilesPerRepository ||
    Number(value["visitedEntryCount"]) < value["files"].length
  ) {
    throw new SourceRiskFault("invalid-input");
  }
  repositoryIds.add(value["repositoryId"]);
  const paths = new Set<string>();
  let totalBytes = 0;
  for (const file of value["files"]) {
    validateFilesystemFile(file, paths);
    totalBytes += Number(file.bytes);
    if (totalBytes > localRepositoryConfigHardLimits.maxTotalBytesPerRepository) {
      throw new SourceRiskFault("limit-exceeded");
    }
  }
  if (totalBytes !== value["bytesRead"]) throw new SourceRiskFault("invalid-input");
}

function validateFilesystemFile(
  value: unknown,
  paths: Set<string>,
): asserts value is FilesystemMetadataFile {
  if (
    !isRecord(value) ||
    typeof value["relativePath"] !== "string" ||
    !isSafeRelativePath(value["relativePath"]) ||
    paths.has(value["relativePath"]) ||
    !isBoundedCount(value["bytes"], localRepositoryConfigHardLimits.maxBytesPerFile) ||
    !isBoundedCount(value["lineCount"], localRepositoryConfigHardLimits.maxBytesPerFile) ||
    !isDigest(value["digest"])
  ) {
    throw new SourceRiskFault("invalid-input");
  }
  paths.add(value["relativePath"]);
  if (value["category"] === "document") {
    if (
      !hasExactKeys(value, [
        "relativePath",
        "bytes",
        "digest",
        "lineCount",
        "category",
        "format",
        "headingCount",
        "codeFenceCount",
      ]) ||
      !["markdown", "mdx", "restructured-text", "asciidoc"].includes(String(value["format"])) ||
      !isBoundedCount(value["headingCount"], Number(value["lineCount"])) ||
      !isBoundedCount(value["codeFenceCount"], Number(value["lineCount"]))
    )
      throw new SourceRiskFault("invalid-input");
    return;
  }
  if (value["category"] === "manifest") {
    if (
      !hasExactKeys(value, [
        "relativePath",
        "bytes",
        "digest",
        "lineCount",
        "category",
        "format",
        "packageJson",
      ]) ||
      typeof value["format"] !== "string" ||
      !validatePackageJson(value["packageJson"])
    )
      throw new SourceRiskFault("invalid-input");
    return;
  }
  if (
    value["category"] !== "source" ||
    !hasExactKeys(value, [
      "relativePath",
      "bytes",
      "digest",
      "lineCount",
      "category",
      "language",
      "testFile",
    ]) ||
    typeof value["language"] !== "string" ||
    value["language"].length === 0 ||
    typeof value["testFile"] !== "boolean"
  )
    throw new SourceRiskFault("invalid-input");
}

function validatePackageJson(value: unknown): boolean {
  if (value === null) return true;
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "moduleType",
      "private",
      "workspacePatternCount",
      "dependencyNames",
      "scriptNames",
    ]) &&
    ["module", "commonjs", "unspecified"].includes(String(value["moduleType"])) &&
    (typeof value["private"] === "boolean" || value["private"] === null) &&
    isBoundedCount(value["workspacePatternCount"], 512) &&
    isBoundedStrings(value["dependencyNames"], 256) &&
    isBoundedStrings(value["scriptNames"], 128)
  );
}

function countDigests(snapshot: FilesystemMetadataSnapshot): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const repository of snapshot.repositories) {
    for (const file of repository.files)
      counts.set(file.digest.value, (counts.get(file.digest.value) ?? 0) + 1);
  }
  return counts;
}

function isDigest(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["algorithm", "value"]) &&
    value["algorithm"] === "sha256" &&
    typeof value["value"] === "string" &&
    digestPattern.test(value["value"])
  );
}

function isSafeRelativePath(value: string): boolean {
  return (
    value.length > 0 &&
    value.isWellFormed() &&
    !value.startsWith("/") &&
    Buffer.byteLength(value, "utf8") <= localRepositoryConfigHardLimits.maxRelativePathBytes &&
    !/[\\:]/u.test(value) &&
    !containsUnsafeControl(value) &&
    value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}

function isBoundedStrings(value: unknown, maximum: number): boolean {
  return (
    Array.isArray(value) &&
    value.length <= maximum &&
    value.every((item) => typeof item === "string" && item.length > 0 && item.isWellFormed()) &&
    new Set(value).size === value.length
  );
}

function isBoundedCount(value: unknown, maximum: number): boolean {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= maximum;
}

function containsUnsafeControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x1f || codeUnit === 0x7f) return true;
  }
  return false;
}

function addRisks(
  target: Set<EvidenceSourceRiskFlag>,
  values: readonly EvidenceSourceRiskFlag[],
): void {
  for (const value of values) target.add(value);
}

function uniqueSorted<Value extends string>(values: readonly Value[]): readonly Value[] {
  return Object.freeze([...new Set(values)].sort(compareText));
}

function recordKey(repositoryId: string, path: string): string {
  return `${repositoryId}\0${path}`;
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

function failure(category: EvidenceSourceRiskErrorCategory): ClassifyEvidenceSourceRiskResult {
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
