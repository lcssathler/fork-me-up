import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveAuthorizedRepositoryConfig } from "@fork-me-up/community-provider";

const limits = Object.freeze({
  maxRepositories: 2,
  maxFilesPerRepository: 100,
  maxBytesPerFile: 65_536,
  maxTotalBytesPerRepository: 1_048_576,
  maxDepth: 8,
  maxDurationMs: 5_000,
  maxConcurrency: 1,
});

/**
 * @param {string} rootPath
 * @param {string} relativePath
 */
function configuration(rootPath, relativePath) {
  return JSON.stringify({
    configVersion: "0.1.0",
    authorizedRoots: [{ rootId: "root_synthetic", path: rootPath }],
    repositories: [{ repositoryId: "repo_synthetic", rootId: "root_synthetic", relativePath }],
    limits,
  });
}

/** @param {import("node:test").TestContext} context */
async function temporaryRoot(context) {
  const root = await mkdtemp(path.join(tmpdir(), "fork-me-up-m2-s01-"));
  context.after(async () => rm(root, { recursive: true, force: true }));
  return root;
}

test("the Node boundary resolves real synthetic directories without exposing file content", async (context) => {
  const sandbox = await temporaryRoot(context);
  const authorizedRoot = path.join(sandbox, "authorized");
  const repository = path.join(authorizedRoot, "nested", "repository");
  const canary = "FMU_REPOSITORY_CONTENT_MUST_NOT_BE_READ";
  await mkdir(repository, { recursive: true });
  await writeFile(path.join(repository, "source.txt"), canary, "utf8");

  const result = await resolveAuthorizedRepositoryConfig(
    configuration(authorizedRoot, "nested/repository"),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const firstRoot = result.value.authorizedRoots[0];
  const firstRepository = result.value.repositories[0];
  assert.ok(firstRoot);
  assert.ok(firstRepository);
  assert.equal(firstRoot.canonicalPath, await realpath(authorizedRoot));
  assert.equal(firstRepository.canonicalPath, await realpath(repository));
  assert.doesNotMatch(JSON.stringify(result), new RegExp(canary, "u"));
  assert.equal(Object.isFrozen(firstRepository), true);
});

test("a real directory link cannot escape the canonical authorized root", async (context) => {
  const sandbox = await temporaryRoot(context);
  const authorizedRoot = path.join(sandbox, "authorized");
  const outsideRoot = path.join(sandbox, "outside");
  const linkedRepository = path.join(authorizedRoot, "linked-repository");
  await mkdir(authorizedRoot, { recursive: true });
  await mkdir(outsideRoot, { recursive: true });
  try {
    await symlink(outsideRoot, linkedRepository, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "EPERM" || error.code === "EACCES" || error.code === "ENOSYS")
    ) {
      context.skip("Directory links are unavailable in this environment.");
      return;
    }
    throw error;
  }

  const result = await resolveAuthorizedRepositoryConfig(
    configuration(authorizedRoot, "linked-repository"),
  );
  assert.deepEqual(result, {
    ok: false,
    error: { category: "not-authorized", retryable: false },
  });
});

test("missing and non-directory selections return no native path or partial authority", async (context) => {
  const sandbox = await temporaryRoot(context);
  const authorizedRoot = path.join(sandbox, "authorized");
  await mkdir(authorizedRoot, { recursive: true });
  await writeFile(path.join(authorizedRoot, "plain-file"), "synthetic", "utf8");

  for (const relativePath of ["missing", "plain-file"]) {
    const result = await resolveAuthorizedRepositoryConfig(
      configuration(authorizedRoot, relativePath),
    );
    assert.deepEqual(result, {
      ok: false,
      error: { category: "path-unavailable", retryable: true },
    });
    assert.doesNotMatch(JSON.stringify(result), /authorized|plain-file|missing/u);
  }
});
