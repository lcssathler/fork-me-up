import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assessGitAuthorship,
  collectGitMetadata,
  resolveAuthorizedRepositoryConfig,
  resolveDeveloperIdentityConfig,
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
 * @param {string} repository
 * @param {number} ordinal
 * @param {string} name
 * @param {string} email
 * @param {string} message
 */
async function createCommit(repository, ordinal, name, email, message) {
  await writeFile(
    path.join(repository, `synthetic-${String(ordinal)}.ts`),
    `export const value${String(ordinal)} = ${String(ordinal)};\n`,
    "utf8",
  );
  git(repository, ["add", "--", `synthetic-${String(ordinal)}.ts`]);
  git(
    repository,
    ["-c", `user.name=${name}`, "-c", `user.email=${email}`, "commit", "-m", message],
    {
      GIT_AUTHOR_DATE: `2026-09-05T12:0${String(ordinal)}:00+00:00`,
      GIT_COMMITTER_DATE: `2026-09-05T12:0${String(ordinal)}:00+00:00`,
    },
  );
  return git(repository, ["rev-parse", "HEAD"]);
}

test("real Git digests match private configuration without leaking identity or source content", async (context) => {
  const sandbox = await mkdtemp(path.join(tmpdir(), "fork-me-up-m2-s04-"));
  const root = path.join(sandbox, "authorized");
  const repository = path.join(root, "repository");
  await mkdir(repository, { recursive: true });
  context.after(async () => rm(sandbox, { recursive: true, force: true }));
  git(repository, ["init", "--initial-branch=main"]);

  const developerCommit = await createCommit(
    repository,
    1,
    "Developer Person",
    "developer@example.invalid",
    "DEVELOPER_MESSAGE_CANARY",
  );
  const botCommit = await createCommit(
    repository,
    2,
    "Synthetic Bot",
    "bot@example.invalid",
    "BOT_MESSAGE_CANARY",
  );
  const coauthoredCommit = await createCommit(
    repository,
    3,
    "Developer Person",
    "developer@example.invalid",
    "COAUTHOR_MESSAGE_CANARY\n\nCo-authored-by: Pair Person <pair@example.invalid>",
  );
  const pairCommit = await createCommit(
    repository,
    4,
    "Unlisted Person",
    "unlisted@example.invalid",
    "PAIR_MESSAGE_CANARY",
  );
  const unknownCommit = await createCommit(
    repository,
    5,
    "Another Person",
    "another@example.invalid",
    "UNKNOWN_MESSAGE_CANARY",
  );
  const sharedCommit = await createCommit(
    repository,
    6,
    "Shared Account",
    "shared@example.invalid",
    "SHARED_MESSAGE_CANARY",
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
        maxFilesPerRepository: 1_000,
        maxBytesPerFile: 1_048_576,
        maxTotalBytesPerRepository: 16_777_216,
        maxDepth: 16,
        maxDurationMs: 30_000,
        maxConcurrency: 1,
      },
    }),
  );
  assert.equal(authorization.ok, true);
  if (!authorization.ok) return;
  const metadata = await collectGitMetadata(authorization.value);
  assert.equal(metadata.ok, true);
  if (!metadata.ok) return;

  const configuration = resolveDeveloperIdentityConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      subjectRef: "subject_synthetic_developer",
      identities: [
        { role: "developer", name: " Developer  Person ", email: "DEVELOPER@example.invalid" },
        { role: "shared", name: "Shared Account", email: "shared@example.invalid" },
        { role: "bot", name: "Synthetic Bot", email: "bot@example.invalid" },
      ],
      annotations: [
        { repositoryId: "repo_synthetic", commitObjectId: developerCommit, kind: "squash" },
        { repositoryId: "repo_synthetic", commitObjectId: pairCommit, kind: "pair-work" },
      ],
    }),
  );
  assert.equal(configuration.ok, true);
  if (!configuration.ok) return;
  const result = assessGitAuthorship(metadata.value, configuration.value);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const assessments = result.value.repositories[0]?.assessments ?? [];
  const byId = new Map(assessments.map((item) => [item.commitObjectId, item]));
  assert.equal(byId.get(developerCommit)?.attributionState, "attributed");
  assert.equal(byId.get(developerCommit)?.historyShape, "squash");
  assert.equal(byId.get(botCommit)?.attributionState, "bot");
  assert.equal(byId.get(coauthoredCommit)?.attributionState, "coauthored");
  assert.equal(byId.get(pairCommit)?.attributionState, "pair-work");
  assert.equal(byId.get(unknownCommit)?.attributionState, "unknown");
  assert.equal(byId.get(sharedCommit)?.attributionState, "shared");
  assert.ok(assessments.every((item) => item.standaloneDemonstratedDepthAllowed === false));
  const serialized = JSON.stringify(result);
  for (const canary of [
    "Developer Person",
    "developer@example.invalid",
    "Synthetic Bot",
    "bot@example.invalid",
    "Pair Person",
    "pair@example.invalid",
    "Unlisted Person",
    "unlisted@example.invalid",
    "Another Person",
    "another@example.invalid",
    "Shared Account",
    "shared@example.invalid",
    "MESSAGE_CANARY",
    "synthetic-",
    root.replaceAll("\\", "\\\\"),
  ]) {
    assert.equal(serialized.includes(canary), false, canary);
  }
});
