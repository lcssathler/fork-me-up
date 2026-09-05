import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assessGitAuthorship,
  classifyEvidenceSourceRisk,
  collectFilesystemMetadata,
  collectGitMetadata,
  deriveEvidenceClaims,
  resolveAuthorizedRepositoryConfig,
  resolveDeveloperIdentityConfig,
  resolveEvidenceSourceRiskConfig,
  serializeCommunityProfileStore,
} from "@fork-me-up/community-provider";

/** @param {string} repository @param {string[]} arguments_ @param {Record<string, string>} [environment] */
function git(repository, arguments_, environment = {}) {
  return execFileSync("git", arguments_, {
    cwd: repository,
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0", ...environment },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }).trim();
}

/**
 * @param {import("@fork-me-up/community-provider").ResolvedAuthorizedRepositoryConfig} authorization
 * @param {import("@fork-me-up/community-provider").ResolvedDeveloperIdentityConfig} identities
 * @param {import("@fork-me-up/community-provider").ResolvedEvidenceSourceRiskConfig} riskConfig
 */
async function collectRisk(authorization, identities, riskConfig) {
  const [filesystem, gitMetadata] = await Promise.all([
    collectFilesystemMetadata(authorization),
    collectGitMetadata(authorization),
  ]);
  assert.equal(filesystem.ok, true);
  assert.equal(gitMetadata.ok, true);
  if (!filesystem.ok || !gitMetadata.ok) throw new Error("collection failed");
  const authorship = assessGitAuthorship(gitMetadata.value, identities);
  assert.equal(authorship.ok, true);
  if (!authorship.ok) throw new Error("authorship failed");
  const risk = classifyEvidenceSourceRisk(
    filesystem.value,
    gitMetadata.value,
    authorship.value,
    riskConfig,
  );
  assert.equal(risk.ok, true);
  if (!risk.ok) throw new Error("risk classification failed");
  return risk.value;
}

test("real M2 chain derives Store-compatible Claims and invalidates changed source", async (context) => {
  const sandbox = await mkdtemp(path.join(tmpdir(), "fork-me-up-m2-s07-"));
  const root = path.join(sandbox, "authorized");
  const repository = path.join(root, "repository");
  await mkdir(path.join(repository, "src"), { recursive: true });
  context.after(async () => rm(sandbox, { recursive: true, force: true }));

  await Promise.all([
    writeFile(path.join(repository, "src", "main.ts"), "export const SOURCE_CANARY = 1;\n"),
    writeFile(path.join(repository, "src", "helper.ts"), "export const HELPER_CANARY = 2;\n"),
    writeFile(path.join(repository, "README.md"), "# DOCUMENT_CANARY\n"),
  ]);
  git(repository, ["init", "--initial-branch=main"]);
  git(repository, ["add", "--", "."]);
  git(
    repository,
    [
      "-c",
      "user.name=Synthetic Developer",
      "-c",
      "user.email=developer@example.invalid",
      "commit",
      "-m",
      "INITIAL_MESSAGE_CANARY",
    ],
    {
      GIT_AUTHOR_DATE: "2026-09-05T12:00:00+00:00",
      GIT_COMMITTER_DATE: "2026-09-05T12:00:00+00:00",
    },
  );

  const authorization = await resolveAuthorizedRepositoryConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      authorizedRoots: [{ rootId: "root_synthetic", path: root }],
      repositories: [
        { repositoryId: "repo_synthetic", rootId: "root_synthetic", relativePath: "repository" },
      ],
      limits: {
        maxRepositories: 1,
        maxFilesPerRepository: 100,
        maxBytesPerFile: 65_536,
        maxTotalBytesPerRepository: 1_048_576,
        maxDepth: 8,
        maxDurationMs: 30_000,
        maxConcurrency: 1,
      },
    }),
  );
  assert.equal(authorization.ok, true);
  if (!authorization.ok) return;
  const identities = resolveDeveloperIdentityConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      subjectRef: "subject_synthetic",
      identities: [
        { role: "developer", name: "Synthetic Developer", email: "developer@example.invalid" },
      ],
      annotations: [],
    }),
  );
  assert.equal(identities.ok, true);
  if (!identities.ok) return;
  const riskConfig = resolveEvidenceSourceRiskConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      repositoryAnnotations: [],
      pathAnnotations: [],
    }),
  );
  assert.equal(riskConfig.ok, true);
  if (!riskConfig.ok) return;

  const firstRisk = await collectRisk(authorization.value, identities.value, riskConfig.value);
  const first = deriveEvidenceClaims(firstRisk, {
    kind: "evidence-claim-derivation-request",
    derivationVersion: "0.1.0",
    sourceObservedAt: "2026-09-05T12:01:00Z",
    derivedAt: "2026-09-05T12:02:00Z",
    staleBefore: "2026-09-01T00:00:00Z",
    repositoryProjects: [{ repositoryId: "repo_synthetic", projectRef: "project_synthetic" }],
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.value.evidence.length, 2);
  assert.equal(first.value.claims.length, 1);
  assert.equal(first.value.claims[0]?.capability, "language.typescript");
  assert.equal(first.value.claims[0]?.observedDepth, "practical-use");

  const store = serializeCommunityProfileStore({
    storeSchemaVersion: "0.1.0",
    kind: "community-profile-store",
    storeId: "store_synthetic",
    profileVersion: "profile_synthetic",
    subjectRef: first.value.subjectRef,
    profile: {
      projectRefs: first.value.projectRefs,
      evidence: first.value.evidence,
      claims: first.value.claims,
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
    internalState: {
      generation: 0,
      createdAt: "2026-09-05T12:02:00Z",
      updatedAt: "2026-09-05T12:02:00Z",
      lastValidatedAt: "2026-09-05T12:02:00Z",
      migratedFromStoreSchemaVersion: null,
    },
  });
  assert.equal(store.ok, true);

  await writeFile(path.join(repository, "src", "main.ts"), "export const SOURCE_CANARY = 3;\n");
  git(repository, ["add", "--", "src/main.ts"]);
  git(
    repository,
    [
      "-c",
      "user.name=Synthetic Developer",
      "-c",
      "user.email=developer@example.invalid",
      "commit",
      "-m",
      "REFRESH_MESSAGE_CANARY",
    ],
    {
      GIT_AUTHOR_DATE: "2026-09-05T12:03:00+00:00",
      GIT_COMMITTER_DATE: "2026-09-05T12:03:00+00:00",
    },
  );
  const refreshedRisk = await collectRisk(authorization.value, identities.value, riskConfig.value);
  const refreshed = deriveEvidenceClaims(
    refreshedRisk,
    {
      kind: "evidence-claim-derivation-request",
      derivationVersion: "0.1.0",
      sourceObservedAt: "2026-09-05T12:04:00Z",
      derivedAt: "2026-09-05T12:05:00Z",
      staleBefore: "2026-09-01T00:00:00Z",
      repositoryProjects: [{ repositoryId: "repo_synthetic", projectRef: "project_synthetic" }],
    },
    first.value,
  );
  assert.equal(refreshed.ok, true);
  if (!refreshed.ok) return;
  const oldMain = first.value.evidence.find(
    (item) => item.source.sourceRelativeRef === "src/main.ts",
  );
  const newMain = refreshed.value.evidence.find(
    (item) => item.source.sourceRelativeRef === "src/main.ts",
  );
  assert.ok(oldMain);
  assert.ok(newMain);
  assert.equal(oldMain.evidenceId, newMain.evidenceId);
  assert.notEqual(oldMain.invalidation.fingerprint, newMain.invalidation.fingerprint);
  assert.deepEqual(refreshed.value.invalidation.evidence, [
    { evidenceRef: oldMain.evidenceId, reason: "fingerprint-changed" },
  ]);
  assert.deepEqual(
    refreshed.value.invalidation.claims.map((item) => item.reason),
    ["evidence-invalidated"],
  );

  const serialized = JSON.stringify(refreshed.value);
  for (const canary of [
    "SOURCE_CANARY",
    "HELPER_CANARY",
    "DOCUMENT_CANARY",
    "MESSAGE_CANARY",
    "Synthetic Developer",
    "developer@example.invalid",
    root.replaceAll("\\", "\\\\"),
  ]) {
    assert.equal(serialized.includes(canary), false, canary);
  }
});
