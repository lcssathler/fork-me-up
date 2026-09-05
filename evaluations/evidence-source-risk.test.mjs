import assert from "node:assert/strict";
import test from "node:test";

import {
  assessGitAuthorship,
  classifyEvidenceSourceRisk,
  resolveDeveloperIdentityConfig,
  resolveEvidenceSourceRiskConfig,
} from "@fork-me-up/community-provider";

test("FMU-E-007: risky source classes cannot independently establish demonstrated depth", () => {
  const identity = resolveDeveloperIdentityConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      subjectRef: "subject_synthetic",
      identities: [{ role: "developer", name: "Developer", email: "developer@example.invalid" }],
      annotations: [],
    }),
  );
  assert.equal(identity.ok, true);
  if (!identity.ok) return;
  const commitObjectId = "1".padStart(40, "0");
  const paths = ["generated/client.ts", "vendor/lib.ts", "templates/base.ts", "tutorial/guide.ts"];
  const git = {
    kind: "git-metadata-snapshot",
    snapshotVersion: "0.1.0",
    repositories: [
      {
        repositoryId: "repo_synthetic",
        rootId: "root_synthetic",
        objectFormat: "sha1",
        headObjectId: commitObjectId,
        shallow: false,
        historyTruncated: false,
        totalCommitBytes: 100,
        commits: [
          {
            objectId: commitObjectId,
            parentObjectIds: [],
            authoredAt: "2026-09-05T12:00:00.000Z",
            committedAt: "2026-09-05T12:00:01.000Z",
            authorIdentityDigest: identity.value.identities[0].identityDigest,
            committerIdentityDigest: identity.value.identities[0].identityDigest,
            coauthorIdentityDigests: [],
            changedPaths: paths,
          },
        ],
      },
    ],
  };
  const authorship = assessGitAuthorship(git, identity.value);
  assert.equal(authorship.ok, true);
  if (!authorship.ok) return;
  const config = resolveEvidenceSourceRiskConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      repositoryAnnotations: [{ repositoryId: "repo_synthetic", riskFlags: ["fork"] }],
      pathAnnotations: [],
    }),
  );
  assert.equal(config.ok, true);
  if (!config.ok) return;
  const files = paths.map((relativePath, index) => ({
    relativePath,
    bytes: 1,
    digest: { algorithm: "sha256", value: String(index + 1).repeat(64) },
    lineCount: 1,
    category: "source",
    language: "typescript",
    testFile: false,
  }));
  const result = classifyEvidenceSourceRisk(
    {
      kind: "filesystem-metadata-snapshot",
      snapshotVersion: "0.1.0",
      repositories: [
        {
          repositoryId: "repo_synthetic",
          rootId: "root_synthetic",
          visitedEntryCount: files.length,
          ignoredDirectoryCount: 0,
          unsupportedFileCount: 0,
          bytesRead: files.length,
          files,
        },
      ],
    },
    git,
    authorship.value,
    config.value,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const records = result.value.repositories[0].records;
  assert.ok(records.every((record) => record.riskFlags.length > 0));
  assert.ok(records.every((record) => record.supportLevel === "reduced"));
  assert.ok(records.every((record) => record.strengthCeiling === "weak"));
  assert.ok(records.every((record) => record.standaloneDemonstratedDepthAllowed === false));
  assert.doesNotMatch(JSON.stringify(result), /demonstrated-depth|"high"|"strong"/u);
});
