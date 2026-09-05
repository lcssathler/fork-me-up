import assert from "node:assert/strict";
import test from "node:test";
import {
  assessGitAuthorship,
  resolveDeveloperIdentityConfig,
} from "@fork-me-up/community-provider";

test("FMU-E-008: shared and unknown authorship cannot establish high-confidence personal depth", () => {
  const configuration = resolveDeveloperIdentityConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      subjectRef: "subject_synthetic_developer",
      identities: [
        { role: "developer", name: "Developer", email: "developer@example.invalid" },
        { role: "shared", name: "Shared", email: "shared@example.invalid" },
      ],
      annotations: [],
    }),
  );
  assert.equal(configuration.ok, true);
  if (!configuration.ok) return;
  const sharedDigest = configuration.value.identities.find(
    (identity) => identity.role === "shared",
  )?.identityDigest;
  assert.ok(sharedDigest);
  const commits = [
    { objectId: "1".padStart(40, "0"), authorIdentityDigest: sharedDigest },
    { objectId: "2".padStart(40, "0"), authorIdentityDigest: "f".repeat(64) },
  ].map((item) => ({
    ...item,
    parentObjectIds: [],
    authoredAt: "2026-09-05T12:00:00.000Z",
    committedAt: "2026-09-05T12:00:01.000Z",
    committerIdentityDigest: item.authorIdentityDigest,
    coauthorIdentityDigests: [],
    changedPaths: ["src/synthetic.ts"],
  }));
  const result = assessGitAuthorship(
    {
      kind: "git-metadata-snapshot",
      snapshotVersion: "0.1.0",
      repositories: [
        {
          repositoryId: "repo_synthetic",
          rootId: "root_synthetic",
          objectFormat: "sha1",
          headObjectId: commits[0]?.objectId,
          shallow: false,
          historyTruncated: false,
          totalCommitBytes: 200,
          commits,
        },
      ],
    },
    configuration.value,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const assessments = result.value.repositories[0]?.assessments ?? [];
  assert.deepEqual(
    assessments.map((item) => item.attributionState),
    ["shared", "unknown"],
  );
  for (const assessment of assessments) {
    assert.equal(assessment.depthCeiling, null);
    assert.equal(assessment.confidenceCeiling, "low");
    assert.equal(assessment.standaloneDemonstratedDepthAllowed, false);
    assert.deepEqual(assessment.evidenceAuthorAssessment, { state: "unknown", subjectRef: null });
  }
  assert.doesNotMatch(JSON.stringify(result), /demonstrated-depth|"high"|developer@example/u);
});
