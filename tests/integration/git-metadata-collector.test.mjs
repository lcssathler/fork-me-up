import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import {
  appendFile,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  collectGitMetadata,
  nodeBoundedGitCommandPort,
  resolveAuthorizedRepositoryConfig,
} from "@fork-me-up/community-provider";

const defaultLimits = Object.freeze({
  maxRepositories: 1,
  maxFilesPerRepository: 1_000,
  maxBytesPerFile: 1_048_576,
  maxTotalBytesPerRepository: 16_777_216,
  maxDepth: 16,
  maxDurationMs: 30_000,
  maxConcurrency: 1,
});

/** @param {import("node:test").TestContext} context */
async function temporaryRepository(context) {
  const sandbox = await mkdtemp(path.join(tmpdir(), "fork-me-up-m2-s03-"));
  const root = path.join(sandbox, "authorized");
  const repository = path.join(root, "repository");
  await mkdir(repository, { recursive: true });
  context.after(async () => rm(sandbox, { recursive: true, force: true }));
  return { sandbox, root, repository };
}

/** @param {string} root @param {Partial<Record<keyof typeof defaultLimits, number>>} [overrides] */
async function authority(root, overrides = {}) {
  const result = await resolveAuthorizedRepositoryConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      authorizedRoots: [{ rootId: "root_synthetic", path: root }],
      repositories: [
        {
          repositoryId: "repo_synthetic",
          rootId: "root_synthetic",
          relativePath: "repository",
        },
      ],
      limits: { ...defaultLimits, ...overrides },
    }),
  );
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Synthetic authority did not resolve.");
  return result.value;
}

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

/** @param {string} repository */
async function initializeRepository(repository) {
  git(repository, ["init", "--initial-branch=main"]);
  git(repository, ["config", "user.name", "Setup User"]);
  git(repository, ["config", "user.email", "setup@example.invalid"]);
  await writeFile(path.join(repository, "alpha.ts"), "export const alpha = 1;\n", "utf8");
  await writeFile(path.join(repository, "README.md"), "# PROMPT_INJECTION_CANARY\n", "utf8");
  await writeFile(path.join(repository, ".gitattributes"), "*.ts diff=evil filter=evil\n", "utf8");
  git(repository, ["add", "--", "alpha.ts", "README.md", ".gitattributes"]);
  git(
    repository,
    [
      "-c",
      "user.name=Primary Person",
      "-c",
      "user.email=primary@example.invalid",
      "commit",
      "-m",
      "MESSAGE_CANARY\n\nCo-authored-by: Pair Person <pair@example.invalid>",
    ],
    {
      GIT_AUTHOR_DATE: "2025-01-01T12:00:00+00:00",
      GIT_COMMITTER_DATE: "2025-01-01T12:00:00+00:00",
    },
  );
}

test("real quarantined Git collection is deterministic and ignores hostile repository controls", async (context) => {
  const { sandbox, root, repository } = await temporaryRepository(context);
  await initializeRepository(repository);

  git(repository, ["switch", "-c", "feature"]);
  await writeFile(path.join(repository, "feature.ts"), "export const feature = true;\n", "utf8");
  git(repository, ["add", "--", "feature.ts"]);
  git(repository, [
    "-c",
    "user.name=Feature Person",
    "-c",
    "user.email=feature@example.invalid",
    "commit",
    "-m",
    "FEATURE_MESSAGE_CANARY",
  ]);
  git(repository, ["switch", "main"]);
  await writeFile(path.join(repository, "main.ts"), "export const main = true;\n", "utf8");
  git(repository, ["add", "--", "main.ts"]);
  git(repository, ["commit", "-m", "MAIN_MESSAGE_CANARY"]);
  git(repository, ["merge", "--no-ff", "feature", "-m", "MERGE_MESSAGE_CANARY"]);
  const head = git(repository, ["rev-parse", "HEAD"]);
  const firstParent = git(repository, ["rev-parse", "HEAD^1"]);
  git(repository, ["replace", head, firstParent]);

  const sentinel = path.join(sandbox, "execution-sentinel");
  const trap = path.join(sandbox, process.platform === "win32" ? "trap.cmd" : "trap.sh");
  const portableSentinel = sentinel.replaceAll("\\", "/");
  await writeFile(
    trap,
    process.platform === "win32"
      ? `@echo invoked>"${portableSentinel}"\r\n`
      : `#!/bin/sh\nprintf invoked > '${portableSentinel}'\n`,
    "utf8",
  );
  if (process.platform !== "win32") await chmod(trap, 0o700);
  const hooks = path.join(repository, ".git", "hostile-hooks");
  await mkdir(hooks);
  const hook = path.join(hooks, process.platform === "win32" ? "post-rewrite.cmd" : "post-rewrite");
  await writeFile(hook, await readFile(trap, "utf8"), "utf8");
  if (process.platform !== "win32") await chmod(hook, 0o700);
  const includeFile = path.join(sandbox, "hostile-include.config");
  const portableTrap = trap.replaceAll("\\", "/");
  await writeFile(includeFile, `[core]\n\tsshCommand = ${JSON.stringify(portableTrap)}\n`, "utf8");
  await appendFile(
    path.join(repository, ".git", "config"),
    `\n[include]\n\tpath = ${JSON.stringify(includeFile.replaceAll("\\", "/"))}\n[core]\n\thooksPath = ${JSON.stringify(hooks.replaceAll("\\", "/"))}\n\tfsmonitor = ${JSON.stringify(portableTrap)}\n\tpager = ${JSON.stringify(portableTrap)}\n[diff]\n\texternal = ${JSON.stringify(portableTrap)}\n[diff "evil"]\n\ttextconv = ${JSON.stringify(portableTrap)}\n[filter "evil"]\n\tprocess = ${JSON.stringify(portableTrap)}\n[alias]\n\trev-list = !${portableTrap}\n[remote "origin"]\n\turl = https://REMOTE_URL_CANARY.invalid/repository\n\tpromisor = true\n`,
    "utf8",
  );
  await appendFile(path.join(repository, ".git", "config"), "INVALID_CONFIG_CANARY\n", "utf8");

  /** @type {import("@fork-me-up/community-provider").BoundedGitCommandRequest[]} */
  const requests = [];
  /** @type {{arguments: readonly string[], outcome: string}[]} */
  const traces = [];
  const commandPort = {
    /** @param {import("@fork-me-up/community-provider").BoundedGitCommandRequest} request */
    async run(request) {
      requests.push(request);
      const result = await nodeBoundedGitCommandPort.run(request);
      traces.push({
        arguments: request.arguments,
        outcome: result.ok ? `ok:${String(result.output.byteLength)}` : result.reason,
      });
      return result;
    },
  };
  const resolved = await authority(root);
  const first = await collectGitMetadata(resolved, { commandPort });
  const second = await collectGitMetadata(resolved, { commandPort });

  assert.equal(first.ok, true, JSON.stringify({ first, traces }));
  assert.equal(second.ok, true, JSON.stringify({ second, traces }));
  if (!first.ok || !second.ok) return;
  assert.deepEqual(first.value, second.value);
  const metadata = first.value.repositories[0];
  assert.ok(metadata);
  assert.equal(metadata.headObjectId, head);
  assert.equal(metadata.objectFormat, "sha1");
  assert.equal(metadata.shallow, false);
  assert.equal(metadata.historyTruncated, false);
  assert.equal(metadata.commits.length, 4);
  assert.equal(metadata.commits[0]?.parentObjectIds.length, 2);
  assert.ok(metadata.commits.some((commit) => commit.coauthorIdentityDigests.length === 1));
  assert.ok(metadata.commits.some((commit) => commit.changedPaths.includes("feature.ts")));
  assert.ok(metadata.commits.some((commit) => commit.changedPaths.includes("main.ts")));
  assert.ok(requests.length >= 7);
  assert.ok(
    requests.every((request) =>
      ["rev-list", "cat-file", "diff-tree"].includes(request.arguments[0] ?? ""),
    ),
  );
  await assert.rejects(readFile(sentinel), { code: "ENOENT" });
  const serialized = JSON.stringify(first);
  for (const canary of [
    "PROMPT_INJECTION_CANARY",
    "MESSAGE_CANARY",
    "FEATURE_MESSAGE_CANARY",
    "MAIN_MESSAGE_CANARY",
    "MERGE_MESSAGE_CANARY",
    "REMOTE_URL_CANARY",
    "Primary Person",
    "Feature Person",
    "Pair Person",
    "primary@example.invalid",
    "feature@example.invalid",
    "pair@example.invalid",
    root.replaceAll("\\", "\\\\"),
  ]) {
    assert.equal(serialized.includes(canary), false, canary);
  }
  assert.equal(Object.isFrozen(first.value), true);
  assert.equal(Object.isFrozen(metadata.commits), true);
});

test("object alternates and linked object stores fail before Git is invoked", async (context) => {
  const first = await temporaryRepository(context);
  await initializeRepository(first.repository);
  const info = path.join(first.repository, ".git", "objects", "info");
  await mkdir(info, { recursive: true });
  await writeFile(path.join(info, "alternates"), "ALTERNATE_PATH_CANARY\n", "utf8");
  let calls = 0;
  const alternateResult = await collectGitMetadata(await authority(first.root), {
    commandPort: {
      async run() {
        calls += 1;
        return { ok: false, reason: "failed" };
      },
    },
  });
  assert.deepEqual(alternateResult, {
    ok: false,
    error: { category: "unsupported-repository", retryable: false },
  });
  assert.equal(calls, 0);
  assert.doesNotMatch(JSON.stringify(alternateResult), /ALTERNATE_PATH_CANARY|alternates/u);

  const second = await temporaryRepository(context);
  await initializeRepository(second.repository);
  const originalObjects = path.join(second.repository, ".git", "objects");
  const outsideObjects = path.join(second.sandbox, "outside-objects");
  await rename(originalObjects, outsideObjects);
  try {
    await symlink(
      outsideObjects,
      originalObjects,
      process.platform === "win32" ? "junction" : "dir",
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "EPERM" || error.code === "EACCES" || error.code === "ENOSYS")
    ) {
      context.diagnostic("Directory links are unavailable; linked object-store case skipped.");
      return;
    }
    throw error;
  }
  const linkedResult = await collectGitMetadata(await authority(second.root));
  assert.deepEqual(linkedResult, {
    ok: false,
    error: { category: "not-authorized", retryable: false },
  });
});

test("unsupported layouts, oversized commit objects and Git failures are content-free", async (context) => {
  const unsupported = await temporaryRepository(context);
  await writeFile(path.join(unsupported.repository, ".git"), "gitdir: OUTSIDE_CANARY", "utf8");
  const layoutResult = await collectGitMetadata(await authority(unsupported.root));
  assert.deepEqual(layoutResult, {
    ok: false,
    error: { category: "unsupported-repository", retryable: false },
  });

  const oversized = await temporaryRepository(context);
  git(oversized.repository, ["init", "--initial-branch=main"]);
  git(oversized.repository, ["config", "user.name", "Large User"]);
  git(oversized.repository, ["config", "user.email", "large@example.invalid"]);
  await writeFile(path.join(oversized.repository, "small.ts"), "small\n", "utf8");
  git(oversized.repository, ["add", "--", "small.ts"]);
  git(oversized.repository, ["commit", "-m", `OVERSIZE_CANARY_${"x".repeat(2_000)}`]);
  const sizeResult = await collectGitMetadata(
    await authority(oversized.root, { maxBytesPerFile: 512, maxTotalBytesPerRepository: 65_536 }),
  );
  assert.equal(sizeResult.ok, false);
  if (!sizeResult.ok) assert.equal(sizeResult.error.category, "limit-exceeded");
  assert.doesNotMatch(JSON.stringify(sizeResult), /OVERSIZE_CANARY|Large User|large@example/u);

  const unavailable = await temporaryRepository(context);
  await initializeRepository(unavailable.repository);
  const unavailableResult = await collectGitMetadata(await authority(unavailable.root), {
    commandPort: {
      async run() {
        return { ok: false, reason: "unavailable" };
      },
    },
  });
  assert.deepEqual(unavailableResult, {
    ok: false,
    error: { category: "git-unavailable", retryable: true },
  });
  assert.equal("value" in unavailableResult, false);
});

test("packed symbolic and shallow heads plus SHA-256 repositories remain bounded", async (context) => {
  const packed = await temporaryRepository(context);
  await initializeRepository(packed.repository);
  const packedHead = git(packed.repository, ["rev-parse", "HEAD"]);
  git(packed.repository, ["pack-refs", "--all"]);
  await assert.rejects(readFile(path.join(packed.repository, ".git", "refs", "heads", "main")), {
    code: "ENOENT",
  });
  await writeFile(path.join(packed.repository, ".git", "shallow"), `${packedHead}\n`, "ascii");
  const packedResult = await collectGitMetadata(await authority(packed.root));
  assert.equal(packedResult.ok, true);
  if (packedResult.ok) {
    const metadata = packedResult.value.repositories[0];
    assert.ok(metadata);
    assert.equal(metadata.headObjectId, packedHead);
    assert.equal(metadata.shallow, true);
    assert.equal(metadata.commits.length, 1);
    assert.deepEqual(metadata.commits[0]?.parentObjectIds, []);
  }

  const sha256 = await temporaryRepository(context);
  git(sha256.repository, ["init", "--object-format=sha256", "--initial-branch=main"]);
  git(sha256.repository, ["config", "user.name", "SHA256 User"]);
  git(sha256.repository, ["config", "user.email", "sha256@example.invalid"]);
  await writeFile(
    path.join(sha256.repository, "sha256.ts"),
    "export const digest = 256;\n",
    "utf8",
  );
  git(sha256.repository, ["add", "--", "sha256.ts"]);
  git(sha256.repository, ["commit", "-m", "SHA256_MESSAGE_CANARY"]);
  const sha256Head = git(sha256.repository, ["rev-parse", "HEAD"]);
  const sha256Result = await collectGitMetadata(await authority(sha256.root));
  assert.equal(sha256Result.ok, true);
  if (sha256Result.ok) {
    const metadata = sha256Result.value.repositories[0];
    assert.ok(metadata);
    assert.equal(metadata.objectFormat, "sha256");
    assert.equal(metadata.headObjectId, sha256Head);
    assert.equal(metadata.headObjectId.length, 64);
    assert.equal(metadata.commits.length, 1);
  }
  assert.doesNotMatch(
    JSON.stringify(sha256Result),
    /SHA256_MESSAGE_CANARY|SHA256 User|sha256@example/u,
  );
});

test("object-store count, byte and depth budgets fail before command execution", async (context) => {
  /** @type {readonly (readonly [Partial<Record<keyof typeof defaultLimits, number>>, string])[]} */
  const cases = [
    [{ maxFilesPerRepository: 1 }, "count"],
    [{ maxBytesPerFile: 1_024, maxTotalBytesPerRepository: 1_024 }, "bytes"],
    [{ maxDepth: 1 }, "depth"],
  ];
  for (const [overrides, expectedLabel] of cases) {
    const fixture = await temporaryRepository(context);
    await initializeRepository(fixture.repository);
    if (expectedLabel === "bytes") {
      await writeFile(
        path.join(fixture.repository, ".git", "objects", "budget-canary"),
        Buffer.alloc(2_048),
      );
    }
    if (expectedLabel === "depth") {
      await mkdir(path.join(fixture.repository, ".git", "objects", "depth", "canary"), {
        recursive: true,
      });
    }
    let calls = 0;
    const result = await collectGitMetadata(await authority(fixture.root, overrides), {
      commandPort: {
        async run() {
          calls += 1;
          return { ok: false, reason: "failed" };
        },
      },
    });
    assert.equal(calls, 0, expectedLabel);
    assert.deepEqual(
      result,
      { ok: false, error: { category: "limit-exceeded", retryable: false } },
      expectedLabel,
    );
  }
});
