import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  collectFilesystemMetadata,
  resolveAuthorizedRepositoryConfig,
} from "@fork-me-up/community-provider";

/** @type {Readonly<Record<"maxRepositories" | "maxFilesPerRepository" | "maxBytesPerFile" | "maxTotalBytesPerRepository" | "maxDepth" | "maxDurationMs" | "maxConcurrency", number>>} */
const defaultLimits = Object.freeze({
  maxRepositories: 1,
  maxFilesPerRepository: 100,
  maxBytesPerFile: 65_536,
  maxTotalBytesPerRepository: 1_048_576,
  maxDepth: 8,
  maxDurationMs: 5_000,
  maxConcurrency: 1,
});

/** @param {import("node:test").TestContext} context */
async function temporaryRepository(context) {
  const sandbox = await mkdtemp(path.join(tmpdir(), "fork-me-up-m2-s02-"));
  const root = path.join(sandbox, "authorized");
  const repository = path.join(root, "repository");
  await mkdir(repository, { recursive: true });
  context.after(async () => rm(sandbox, { recursive: true, force: true }));
  return { sandbox, root, repository };
}

/** @param {string} root @param {Partial<typeof defaultLimits>} [limitOverrides] */
async function authority(root, limitOverrides = {}) {
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
      limits: { ...defaultLimits, ...limitOverrides },
    }),
  );
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Synthetic authority did not resolve.");
  return result.value;
}

test("the Node collector returns stable structural metadata from a synthetic repository", async (context) => {
  const { root, repository } = await temporaryRepository(context);
  await mkdir(path.join(repository, "docs"), { recursive: true });
  await mkdir(path.join(repository, "src", "__tests__"), { recursive: true });
  await mkdir(path.join(repository, "node_modules", "hidden"), { recursive: true });
  await mkdir(path.join(repository, "nested", ".git"), { recursive: true });
  await writeFile(
    path.join(repository, "docs", "guide.md"),
    "# Guide\n\nREAL_DOC_CANARY\n",
    "utf8",
  );
  await writeFile(
    path.join(repository, "src", "main.ts"),
    "export const REAL_SOURCE_CANARY = 1;\n",
    "utf8",
  );
  await writeFile(
    path.join(repository, "src", "__tests__", "main.ts"),
    "test('x', () => {});\n",
    "utf8",
  );
  await writeFile(
    path.join(repository, "node_modules", "hidden", "secret.ts"),
    "IGNORED_CANARY",
    "utf8",
  );
  await writeFile(path.join(repository, "nested", "secret.ts"), "NESTED_CANARY", "utf8");
  await writeFile(path.join(repository, "archive.zip"), new Uint8Array([0, 1, 2]));
  await writeFile(
    path.join(repository, "package.json"),
    JSON.stringify({
      name: "REAL_PACKAGE_CANARY",
      scripts: { test: "REAL_SCRIPT_CANARY" },
      dependencies: { alpha: "REAL_VALUE_CANARY" },
    }),
    "utf8",
  );

  const resolved = await authority(root);
  const first = await collectFilesystemMetadata(resolved);
  const second = await collectFilesystemMetadata(resolved);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.deepEqual(first.value, second.value);
  const repositoryMetadata = first.value.repositories[0];
  assert.ok(repositoryMetadata);
  assert.deepEqual(
    repositoryMetadata.files.map((file) => file.relativePath),
    ["docs/guide.md", "package.json", "src/__tests__/main.ts", "src/main.ts"],
  );
  assert.equal(repositoryMetadata.unsupportedFileCount, 1);
  assert.equal(repositoryMetadata.ignoredDirectoryCount, 2);
  const testSource = repositoryMetadata.files.find(
    (file) => file.relativePath === "src/__tests__/main.ts",
  );
  assert.equal(testSource?.category, "source");
  if (testSource?.category === "source") assert.equal(testSource.testFile, true);
  const serialized = JSON.stringify(first);
  for (const canary of [
    "REAL_DOC_CANARY",
    "REAL_SOURCE_CANARY",
    "REAL_PACKAGE_CANARY",
    "REAL_SCRIPT_CANARY",
    "REAL_VALUE_CANARY",
    "IGNORED_CANARY",
    "NESTED_CANARY",
    sandboxPathFragment(root),
  ]) {
    assert.equal(serialized.includes(canary), false, canary);
  }
});

test("a real file or directory link is rejected without following its target", async (context) => {
  const { sandbox, root, repository } = await temporaryRepository(context);
  const outside = path.join(sandbox, "outside");
  await mkdir(outside, { recursive: true });
  await writeFile(path.join(outside, "secret.ts"), "LINK_TARGET_CANARY", "utf8");
  const link = path.join(repository, "linked");
  try {
    await symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
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

  const result = await collectFilesystemMetadata(await authority(root));
  assert.deepEqual(result, {
    ok: false,
    error: { category: "not-authorized", retryable: false },
  });
  assert.doesNotMatch(JSON.stringify(result), /LINK_TARGET_CANARY|outside|linked/u);
});

test("real binary, malformed manifest and oversized selected content fail all-or-nothing", async (context) => {
  const cases = [
    {
      name: "bad.md",
      content: new Uint8Array([65, 0, 66]),
      category: "binary-content",
      limits: {},
    },
    { name: "package.json", content: '{"scripts":', category: "invalid-content", limits: {} },
    {
      name: "large.ts",
      content: "12345",
      category: "limit-exceeded",
      limits: { maxBytesPerFile: 4, maxTotalBytesPerRepository: 4 },
    },
  ];
  for (const [index, item] of cases.entries()) {
    const directory = path.join(tmpdir(), `fork-me-up-m2-s02-case-${String(index)}-`);
    const sandbox = await mkdtemp(directory);
    context.after(async () => rm(sandbox, { recursive: true, force: true }));
    const root = path.join(sandbox, "authorized");
    const repository = path.join(root, "repository");
    await mkdir(repository, { recursive: true });
    await writeFile(path.join(repository, item.name), item.content);
    const result = await collectFilesystemMetadata(await authority(root, item.limits));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.category, item.category);
    assert.equal("value" in result, false);
  }
});

test("real depth and entry budgets are enforced before partial metadata is returned", async (context) => {
  const { root, repository } = await temporaryRepository(context);
  await writeFile(path.join(repository, "a.ts"), "a", "utf8");
  await writeFile(path.join(repository, "b.ts"), "b", "utf8");
  const entryResult = await collectFilesystemMetadata(
    await authority(root, { maxFilesPerRepository: 1 }),
  );
  assert.equal(entryResult.ok, false);
  if (!entryResult.ok) assert.equal(entryResult.error.category, "limit-exceeded");

  await rm(path.join(repository, "a.ts"));
  await rm(path.join(repository, "b.ts"));
  await mkdir(path.join(repository, "one", "two"), { recursive: true });
  const depthResult = await collectFilesystemMetadata(await authority(root, { maxDepth: 1 }));
  assert.equal(depthResult.ok, false);
  if (!depthResult.ok) assert.equal(depthResult.error.category, "limit-exceeded");
});

/** @param {string} value */
function sandboxPathFragment(value) {
  return value.replaceAll("\\", "\\\\");
}
