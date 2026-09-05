import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  collectGitMetadata,
  nodeBoundedGitCommandPort,
  resolveAuthorizedRepositoryConfig,
} from "@fork-me-up/community-provider";

const limits = Object.freeze({
  maxRepositories: 1,
  maxFilesPerRepository: 1_000,
  maxBytesPerFile: 1_048_576,
  maxTotalBytesPerRepository: 16_777_216,
  maxDepth: 16,
  maxDurationMs: 30_000,
  maxConcurrency: 1,
});

/** @param {import("node:test").TestContext} context */
async function syntheticLayout(context) {
  const sandbox = await mkdtemp(path.join(tmpdir(), "fork-me-up-m2-s03-unit-"));
  const root = path.join(sandbox, "authorized");
  const repository = path.join(root, "repository");
  const gitDirectory = path.join(repository, ".git");
  const objectDirectory = path.join(gitDirectory, "objects");
  await mkdir(objectDirectory, { recursive: true });
  context.after(async () => rm(sandbox, { recursive: true, force: true }));
  return { root, repository, gitDirectory, objectDirectory };
}

/** @param {string} root */
async function authority(root) {
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
      limits,
    }),
  );
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Synthetic authority did not resolve.");
  return result.value;
}

/** @param {number} value */
const objectId = (value) => value.toString(16).padStart(40, "0");

/** @param {string} id @param {string | undefined} parent */
function commitBody(id, parent) {
  const parentHeader = parent === undefined ? "" : `parent ${parent}\n`;
  return Buffer.from(
    `tree ${"a".repeat(40)}\n${parentHeader}author Unit Person <unit@example.invalid> 1735689600 +0000\ncommitter Unit Person <unit@example.invalid> 1735689600 +0000\n\nMESSAGE_CANARY_${id}\n`,
    "utf8",
  );
}

test("a 257-commit history returns one deterministic explicitly truncated 256-commit prefix", async (context) => {
  const layout = await syntheticLayout(context);
  const ids = Array.from({ length: 257 }, (_, index) => objectId(257 - index));
  const head = ids[0];
  assert.ok(head);
  await writeFile(path.join(layout.gitDirectory, "HEAD"), `${head}\n`, "ascii");
  const bodies = ids.slice(0, 256).map((id, index) => commitBody(id, ids[index + 1]));
  const revisionOutput = Buffer.from(
    ids
      .map((id, index) => `${id}${ids[index + 1] === undefined ? "" : ` ${ids[index + 1]}`}`)
      .join("\n") + "\n",
    "ascii",
  );
  const checkOutput = Buffer.from(
    ids
      .slice(0, 256)
      .map((id, index) => `${id} commit ${String(bodies[index]?.byteLength ?? 0)}`)
      .join("\n") + "\n",
    "ascii",
  );
  const batchParts = ids.slice(0, 256).flatMap((id, index) => {
    const body = bodies[index];
    assert.ok(body);
    return [
      Buffer.from(`${id} commit ${String(body.byteLength)}\n`, "ascii"),
      body,
      Buffer.from("\n"),
    ];
  });
  let call = 0;
  /** @type {import("@fork-me-up/community-provider").BoundedGitCommandPort} */
  const commandPort = {
    /** @param {import("@fork-me-up/community-provider").BoundedGitCommandRequest} request */
    async run(request) {
      call += 1;
      if (request.arguments[0] === "rev-list") {
        return /** @type {const} */ ({ ok: true, output: revisionOutput });
      }
      if (request.arguments[0] === "cat-file" && request.arguments[1] === "--batch-check") {
        return /** @type {const} */ ({ ok: true, output: checkOutput });
      }
      if (request.arguments[0] === "cat-file" && request.arguments[1] === "--batch") {
        return /** @type {const} */ ({ ok: true, output: Buffer.concat(batchParts) });
      }
      return /** @type {const} */ ({ ok: true, output: new Uint8Array() });
    },
  };

  const result = await collectGitMetadata(await authority(layout.root), {
    commandPort,
    now: () => 0,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const metadata = result.value.repositories[0];
  assert.ok(metadata);
  assert.equal(metadata.historyTruncated, true);
  assert.equal(metadata.commits.length, 256);
  assert.equal(metadata.commits[0]?.objectId, head);
  assert.equal(metadata.commits.at(-1)?.objectId, ids[255]);
  assert.equal(call, 259);
  assert.doesNotMatch(JSON.stringify(result), /MESSAGE_CANARY|Unit Person|unit@example/u);
  assert.equal(Object.isFrozen(metadata.commits[0]), true);
});

test("forged authority and every command failure remain typed and content-free", async (context) => {
  const layout = await syntheticLayout(context);
  const head = objectId(1);
  await writeFile(path.join(layout.gitDirectory, "HEAD"), `${head}\n`, "ascii");
  const authentic = await authority(layout.root);
  assert.deepEqual(await collectGitMetadata({ ...authentic }), {
    ok: false,
    error: { category: "invalid-input", retryable: false },
  });

  /** @type {readonly (readonly [import("@fork-me-up/community-provider").BoundedGitCommandFailureReason, import("@fork-me-up/community-provider").GitMetadataErrorCategory, boolean])[]} */
  const mappings = [
    ["unavailable", "git-unavailable", true],
    ["failed", "invalid-metadata", false],
    ["limit-exceeded", "limit-exceeded", false],
    ["deadline-exceeded", "deadline-exceeded", true],
    ["invalid-request", "invalid-input", false],
  ];
  for (const [reason, category, retryable] of mappings) {
    const result = await collectGitMetadata(authentic, {
      commandPort: {
        async run() {
          return { ok: false, reason };
        },
      },
      now: () => 0,
    });
    assert.deepEqual(result, { ok: false, error: { category, retryable } });
    assert.equal("value" in result, false);
  }
});

test("the Node port rejects commands, revision expressions, format mismatches and invalid budgets", async (context) => {
  const layout = await syntheticLayout(context);
  /** @type {import("@fork-me-up/community-provider").BoundedGitCommandRequest} */
  const base = {
    arguments: ["rev-list", "--max-count=2", "--topo-order", "--parents", objectId(1)],
    input: new Uint8Array(),
    objectDirectory: layout.objectDirectory,
    objectFormat: "sha1",
    shallowObjectIds: [],
    maximumOutputBytes: 1_024,
    timeoutMs: 1_000,
    platform: process.platform === "win32" ? "win32" : "posix",
  };
  /** @type {import("@fork-me-up/community-provider").BoundedGitCommandRequest[]} */
  const invalidRequests = [
    { ...base, arguments: ["status"] },
    { ...base, arguments: [...base.arguments, "--exec=CANARY"] },
    { ...base, arguments: ["cat-file", "--batch"], input: Buffer.from("HEAD\n") },
    {
      ...base,
      arguments: ["cat-file", "--batch"],
      input: Buffer.from(`${objectId(1)}^{commit}\n`),
    },
    { ...base, objectFormat: "sha256" },
    { ...base, maximumOutputBytes: 0 },
    { ...base, timeoutMs: 0 },
    { ...base, shallowObjectIds: ["f".repeat(64)] },
  ];
  for (const request of invalidRequests) {
    assert.deepEqual(await nodeBoundedGitCommandPort.run(request), {
      ok: false,
      reason: "invalid-request",
    });
  }
});

test("the Git boundary source fixes subprocess, environment and source-write behavior", async () => {
  const commandSource = await readFile(
    new URL("../../packages/community-provider/src/bounded-git-command.ts", import.meta.url),
    "utf8",
  );
  const collectorSource = await readFile(
    new URL("../../packages/community-provider/src/git-metadata-collector.ts", import.meta.url),
    "utf8",
  );
  assert.match(commandSource, /spawn\("git", fixedArguments/u);
  assert.match(commandSource, /shell: false/u);
  assert.match(commandSource, /windowsHide: true/u);
  assert.match(commandSource, /GIT_CONFIG_NOSYSTEM: "1"/u);
  assert.match(commandSource, /GIT_NO_LAZY_FETCH: "1"/u);
  assert.doesNotMatch(commandSource, /\b(?:exec|execFile|fork)\s*\(/u);
  assert.doesNotMatch(
    collectorSource,
    /node:(?:http|https|http2|net|tls|dgram|dns)|\bfetch\s*\(|["'](?:clone|pull|push|checkout|switch|reset)["']/u,
  );
  assert.equal(commandSource.includes("writeFile(path.join(gitDirectory"), true);
  assert.equal(commandSource.includes("writeFile(request.objectDirectory"), false);
});
