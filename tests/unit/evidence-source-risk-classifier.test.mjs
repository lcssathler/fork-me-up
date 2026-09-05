import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assessGitAuthorship,
  classifyEvidenceSourceRisk,
  evidenceSourceRiskConfigHardLimits,
  resolveDeveloperIdentityConfig,
  resolveEvidenceSourceRiskConfig,
} from "@fork-me-up/community-provider";

const objectId = "1".padStart(40, "0");
/** @param {string} value */
const digest = (value) => value.repeat(64);

/** @param {string} relativePath @param {string} value @param {number} [bytes] @returns {import("@fork-me-up/community-provider").SourceMetadataFile} */
function source(relativePath, value, bytes = 1) {
  return {
    relativePath,
    bytes,
    digest: { algorithm: "sha256", value: digest(value) },
    lineCount: 1,
    category: "source",
    language: "typescript",
    testFile: false,
  };
}

/** @param {import("@fork-me-up/community-provider").SourceMetadataFile[]} files @param {string[]} [changedPaths] */
function snapshots(files, changedPaths = files.map((file) => file.relativePath)) {
  const identity = resolveDeveloperIdentityConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      subjectRef: "subject_synthetic",
      identities: [{ role: "developer", name: "Synthetic", email: "synthetic@example.invalid" }],
      annotations: [],
    }),
  );
  assert.equal(identity.ok, true);
  if (!identity.ok) throw new Error("identity configuration failed");
  const developerIdentity = identity.value.identities[0];
  assert.ok(developerIdentity);
  const developerDigest = developerIdentity.identityDigest;
  const git = {
    kind: "git-metadata-snapshot",
    snapshotVersion: "0.1.0",
    repositories: [
      {
        repositoryId: "repo_synthetic",
        rootId: "root_synthetic",
        objectFormat: "sha1",
        headObjectId: objectId,
        shallow: false,
        historyTruncated: false,
        totalCommitBytes: 100,
        commits: [
          {
            objectId,
            parentObjectIds: [],
            authoredAt: "2026-09-05T12:00:00.000Z",
            committedAt: "2026-09-05T12:00:01.000Z",
            authorIdentityDigest: developerDigest,
            committerIdentityDigest: developerDigest,
            coauthorIdentityDigests: [],
            changedPaths,
          },
        ],
      },
    ],
  };
  const authorship = assessGitAuthorship(git, identity.value);
  assert.equal(authorship.ok, true);
  if (!authorship.ok) throw new Error("authorship assessment failed");
  return {
    filesystem: {
      kind: "filesystem-metadata-snapshot",
      snapshotVersion: "0.1.0",
      repositories: [
        {
          repositoryId: "repo_synthetic",
          rootId: "root_synthetic",
          visitedEntryCount: files.length,
          ignoredDirectoryCount: 0,
          unsupportedFileCount: 0,
          bytesRead: files.reduce((sum, file) => sum + file.bytes, 0),
          files,
        },
      ],
    },
    git,
    authorship: authorship.value,
    identityConfiguration: identity.value,
  };
}

/**
 * @param {import("@fork-me-up/community-provider").ResolvedRepositoryRiskAnnotation[]} [repositoryAnnotations]
 * @param {import("@fork-me-up/community-provider").ResolvedPathRiskAnnotation[]} [pathAnnotations]
 */
function configuration(repositoryAnnotations = [], pathAnnotations = []) {
  const result = resolveEvidenceSourceRiskConfig(
    JSON.stringify({ configVersion: "0.1.0", repositoryAnnotations, pathAnnotations }),
  );
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("risk configuration failed");
  return result.value;
}

/** @param {Map<string, import("@fork-me-up/community-provider").EvidenceSourceRiskRecord>} records @param {string} path */
function requireRecord(records, path) {
  const record = records.get(path);
  assert.ok(record);
  return record;
}

test("classifies path indicators and exact duplicates while preserving a conservative clean ceiling", () => {
  const files = [
    source("generated/client.ts", "a"),
    source("vendor/library.ts", "b"),
    source("tutorial/example.ts", "c"),
    source("templates/base.ts", "d"),
    source("src/copy-one.ts", "e"),
    source("src/copy-two.ts", "e"),
    source("src/clean.ts", "f"),
  ];
  const input = snapshots(files);
  const result = classifyEvidenceSourceRisk(
    input.filesystem,
    input.git,
    input.authorship,
    configuration(),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const repository = result.value.repositories[0];
  assert.ok(repository);
  const records = new Map(repository.records.map((record) => [record.sourceRelativeRef, record]));
  assert.deepEqual(requireRecord(records, "generated/client.ts").riskFlags, ["generated"]);
  assert.deepEqual(requireRecord(records, "vendor/library.ts").riskFlags, ["vendored"]);
  assert.deepEqual(requireRecord(records, "tutorial/example.ts").riskFlags, ["tutorial"]);
  assert.deepEqual(requireRecord(records, "templates/base.ts").riskFlags, ["template"]);
  assert.deepEqual(requireRecord(records, "src/copy-one.ts").riskFlags, ["duplicated"]);
  assert.equal(requireRecord(records, "src/copy-one.ts").duplicateCount, 2);
  const clean = requireRecord(records, "src/clean.ts");
  assert.deepEqual(clean.riskFlags, []);
  assert.deepEqual(clean.sourceLimitations, ["origin-unverified"]);
  assert.equal(clean.sourceLanguage, "typescript");
  assert.equal(clean.authorshipDepthCeiling, "practical-use");
  assert.equal(clean.authorshipConfidenceCeiling, "medium");
  assert.equal(clean.supportLevel, "normal");
  assert.equal(clean.strengthCeiling, "moderate");
  for (const record of records.values()) {
    assert.equal(record.standaloneDemonstratedDepthAllowed, false);
    if (record.riskFlags.length > 0) {
      assert.equal(record.supportLevel, "reduced");
      assert.equal(record.strengthCeiling, "weak");
    }
  }
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(repository.records), true);
});

test("explicit fork and uncertain annotations are visible and always down-rank support", () => {
  const files = [source("src/main.ts", "a"), source("src/other.ts", "b")];
  const input = snapshots(files);
  const config = configuration(
    [{ repositoryId: "repo_synthetic", riskFlags: ["fork"] }],
    [
      {
        repositoryId: "repo_synthetic",
        sourceRelativeRef: "src/other.ts",
        riskFlags: ["uncertain"],
      },
    ],
  );
  const result = classifyEvidenceSourceRisk(input.filesystem, input.git, input.authorship, config);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const repository = result.value.repositories[0];
  assert.ok(repository);
  const [main, other] = repository.records;
  assert.ok(main);
  assert.ok(other);
  assert.deepEqual(main.riskFlags, ["fork"]);
  assert.deepEqual(other.riskFlags, ["fork", "uncertain"]);
  assert.ok(main.sourceLimitations.includes("explicit-repository-annotation"));
  assert.ok(other.sourceLimitations.includes("explicit-path-annotation"));
  assert.equal(other.supportLevel, "reduced");
});

test("missing bounded history association becomes uncertain and forged inputs fail closed", () => {
  const files = [source("src/untracked.ts", "a")];
  const input = snapshots(files, ["src/other.ts"]);
  const config = configuration();
  const result = classifyEvidenceSourceRisk(input.filesystem, input.git, input.authorship, config);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const repository = result.value.repositories[0];
  assert.ok(repository);
  const record = repository.records[0];
  assert.ok(record);
  assert.deepEqual(record.riskFlags, ["uncertain"]);
  assert.ok(record.sourceLimitations.includes("no-bounded-commit-association"));
  assert.deepEqual(
    classifyEvidenceSourceRisk(input.filesystem, input.git, input.authorship, { ...config }),
    {
      ok: false,
      error: { category: "not-configured", retryable: false },
    },
  );
  assert.deepEqual(
    classifyEvidenceSourceRisk(input.filesystem, input.git, { ...input.authorship }, config),
    {
      ok: false,
      error: { category: "untrusted-authorship", retryable: false },
    },
  );
  const mismatched = globalThis.structuredClone(input.filesystem);
  const mismatchedRepository = mismatched.repositories[0];
  assert.ok(mismatchedRepository);
  mismatchedRepository.rootId = "root_other";
  assert.deepEqual(classifyEvidenceSourceRisk(mismatched, input.git, input.authorship, config), {
    ok: false,
    error: { category: "snapshot-mismatch", retryable: false },
  });
});

test("exact duplicates span repositories and shallow truncated history remains visible", () => {
  const input = snapshots([source("src/main.ts", "a")]);
  const filesystem = globalThis.structuredClone(input.filesystem);
  const secondFilesystemRepository = globalThis.structuredClone(filesystem.repositories[0]);
  assert.ok(secondFilesystemRepository);
  secondFilesystemRepository.repositoryId = "repo_second";
  secondFilesystemRepository.rootId = "root_second";
  filesystem.repositories.push(secondFilesystemRepository);

  const git = globalThis.structuredClone(input.git);
  const secondGitRepository = globalThis.structuredClone(git.repositories[0]);
  assert.ok(secondGitRepository);
  const secondObjectId = "2".padStart(40, "0");
  secondGitRepository.repositoryId = "repo_second";
  secondGitRepository.rootId = "root_second";
  secondGitRepository.headObjectId = secondObjectId;
  secondGitRepository.shallow = true;
  secondGitRepository.historyTruncated = true;
  const secondCommit = secondGitRepository.commits[0];
  assert.ok(secondCommit);
  secondCommit.objectId = secondObjectId;
  git.repositories.push(secondGitRepository);

  const authorship = assessGitAuthorship(git, input.identityConfiguration);
  assert.equal(authorship.ok, true);
  if (!authorship.ok) return;
  const result = classifyEvidenceSourceRisk(filesystem, git, authorship.value, configuration());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.repositories.length, 2);
  for (const repository of result.value.repositories) {
    const record = repository.records[0];
    assert.ok(record);
    assert.equal(record.duplicateCount, 2);
    assert.ok(record.riskFlags.includes("duplicated"));
  }
  const secondRepository = result.value.repositories.find(
    (repository) => repository.repositoryId === "repo_second",
  );
  assert.ok(secondRepository);
  const secondRecord = secondRepository.records[0];
  assert.ok(secondRecord);
  assert.ok(secondRecord.sourceLimitations.includes("shallow-history"));
  assert.ok(secondRecord.sourceLimitations.includes("history-truncated"));
});

test("risk configuration is closed, bounded, deterministic, and content-free on failure", () => {
  const base = { configVersion: "0.1.0", repositoryAnnotations: [], pathAnnotations: [] };
  for (const value of [
    { ...base, extra: true },
    { ...base, configVersion: "9.0.0" },
    {
      ...base,
      pathAnnotations: [
        { repositoryId: "repo", sourceRelativeRef: "../secret", riskFlags: ["uncertain"] },
      ],
    },
    { ...base, repositoryAnnotations: [{ repositoryId: "repo", riskFlags: ["duplicated"] }] },
    {
      ...base,
      pathAnnotations: [
        { repositoryId: "repo", sourceRelativeRef: "private.ts", riskFlags: ["fork"] },
      ],
    },
  ]) {
    const result = resolveEvidenceSourceRiskConfig(JSON.stringify(value));
    assert.equal(result.ok, false);
    assert.equal("value" in result, false);
    assert.doesNotMatch(JSON.stringify(result), /private|secret/u);
  }
  const first = configuration(
    [{ repositoryId: "repo_b", riskFlags: ["uncertain", "fork"] }],
    [
      {
        repositoryId: "repo_b",
        sourceRelativeRef: "src/b.ts",
        riskFlags: ["tutorial", "generated"],
      },
    ],
  );
  const second = configuration(
    [{ repositoryId: "repo_b", riskFlags: ["fork", "uncertain"] }],
    [
      {
        repositoryId: "repo_b",
        sourceRelativeRef: "src/b.ts",
        riskFlags: ["generated", "tutorial"],
      },
    ],
  );
  assert.deepEqual(first, second);
  const exact = JSON.stringify(base).padEnd(evidenceSourceRiskConfigHardLimits.maximumBytes, " ");
  assert.equal(resolveEvidenceSourceRiskConfig(exact).ok, true);
  assert.equal(resolveEvidenceSourceRiskConfig(`${exact} `).ok, false);
});

test("classifier implementation has no filesystem, process, command, or network authority", async () => {
  const sourceText = await readFile(
    new URL(
      "../../packages/community-provider/src/evidence-source-risk-classifier.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(
    sourceText,
    /node:fs|child_process|node:net|node:http|node:https|fetch\s*\(|process\./u,
  );
});
