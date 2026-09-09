import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  collectPublicHistory,
  nodeGitHubPublicHistoryPort,
  resolveAuthorizedRepositoryConfig,
  resolvePublicHistoryConfig,
} from "@fork-me-up/community-provider";

const head = "a".repeat(40);
const parent = "b".repeat(40);
const tree = "c".repeat(40);

/** @param {import("node:test").TestContext} context @param {boolean} [shallow] */
async function fixture(context, shallow = false) {
  const sandbox = await mkdtemp(path.join(tmpdir(), "fork-me-up-m3-s06-"));
  const repository = path.join(sandbox, "repository");
  const gitDirectory = path.join(repository, ".git");
  await mkdir(path.join(gitDirectory, "objects"), { recursive: true });
  await writeFile(path.join(repository, "main.ts"), "export const SOURCE_CANARY = 1;\n");
  await writeFile(path.join(gitDirectory, "HEAD"), `${head}\n`);
  if (shallow) await writeFile(path.join(gitDirectory, "shallow"), `${head}\n`);
  context.after(async () => rm(sandbox, { recursive: true, force: true }));
  const resolved = await resolveAuthorizedRepositoryConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      authorizedRoots: [{ rootId: "root_public", path: sandbox }],
      repositories: [
        { repositoryId: "repo_public", rootId: "root_public", relativePath: "repository" },
      ],
      limits: {
        maxRepositories: 1,
        maxFilesPerRepository: 1000,
        maxBytesPerFile: 65536,
        maxTotalBytesPerRepository: 1048576,
        maxDepth: 16,
        maxDurationMs: 30000,
        maxConcurrency: 1,
      },
    }),
  );
  assert.equal(resolved.ok, true);
  if (!resolved.ok) throw new Error("authority failed");
  return { sandbox, repository, authorization: resolved.value };
}

/** @param {Awaited<ReturnType<typeof fixture>>["authorization"]} authorization @param {string | null} [expectedHeadObjectId] @param {Record<string, number>} [limitOverrides] */
function policy(authorization, expectedHeadObjectId = null, limitOverrides = {}) {
  return resolvePublicHistoryConfig(
    JSON.stringify({
      historyVersion: "0.1.0",
      mode: "local-first",
      github: {
        authentication: "existing-gh",
        permission: "public-metadata-read-only",
        consent: {
          decision: "allow-read-selected-public-history",
          issuedAt: "2026-09-09T12:00:00Z",
          expiresAt: "2026-09-09T13:00:00Z",
        },
        repositories: [
          {
            repositoryId: "repo_public",
            owner: "example-owner",
            name: "example-repository",
            expectedHeadObjectId,
          },
        ],
        limits: {
          maxCommits: 8,
          maxRequests: 32,
          maxResponseBytes: 65536,
          maxTotalResponseBytes: 1048576,
          maxDurationMs: 30000,
          maxPagesPerCommit: 2,
          maxChangedPaths: 1000,
          ...limitOverrides,
        },
      },
    }),
    authorization,
  );
}

/** @returns {import("@fork-me-up/community-provider").BoundedGitCommandPort} */
function localCommandPort() {
  const body = Buffer.from(
    `tree ${tree}\nauthor Unit Person <unit@example.invalid> 1788955200 +0000\ncommitter Unit Person <unit@example.invalid> 1788955200 +0000\n\nMESSAGE_CANARY\n`,
  );
  return {
    async run(request) {
      if (request.arguments[0] === "rev-list")
        return /** @type {const} */ ({ ok: true, output: Buffer.from(`${head}\n`) });
      if (request.arguments[1] === "--batch-check") {
        return /** @type {const} */ ({
          ok: true,
          output: Buffer.from(`${head} commit ${String(body.byteLength)}\n`),
        });
      }
      if (request.arguments[1] === "--batch") {
        return /** @type {const} */ ({
          ok: true,
          output: Buffer.concat([
            Buffer.from(`${head} commit ${String(body.byteLength)}\n`),
            body,
            Buffer.from("\n"),
          ]),
        });
      }
      return /** @type {const} */ ({ ok: true, output: Buffer.from("main.ts\0") });
    },
  };
}

/** @param {string} sha @param {string[]} parents @param {string[]} files */
function commitResponse(sha, parents, files) {
  return {
    sha,
    parents: parents.map((parentSha) => ({ sha: parentSha })),
    commit: {
      author: {
        name: "Remote Person CANARY",
        email: "remote-canary@example.invalid",
        date: "2026-09-09T12:00:00Z",
      },
      committer: {
        name: "Remote Person CANARY",
        email: "remote-canary@example.invalid",
        date: "2026-09-09T12:00:00Z",
      },
      message: "MESSAGE_CANARY\n\nCo-authored-by: Hidden CANARY <hidden@example.invalid>",
    },
    files: files.map((filename) => ({ filename })),
  };
}

/** @param {unknown} [repository] @returns {{endpoints: string[], port: import("@fork-me-up/community-provider").GitHubPublicHistoryPort}} */
function githubPort(
  repository = {
    private: false,
    visibility: "public",
    full_name: "example-owner/example-repository",
  },
) {
  /** @type {string[]} */
  const endpoints = [];
  return {
    endpoints,
    port: {
      async get(request) {
        endpoints.push(request.endpoint);
        /** @type {unknown} */
        let value = repository;
        if (request.endpoint.includes(`/commits/${head}`)) {
          value = commitResponse(head, [parent], ["main.ts"]);
        } else if (request.endpoint.includes(`/commits/${parent}`)) {
          value = commitResponse(parent, [], ["src/parent.ts"]);
        }
        return /** @type {const} */ ({
          ok: true,
          output: Buffer.from(JSON.stringify(value)),
        });
      },
    },
  };
}

test("public-history configuration is authentic, exact, bounded and scoped to selected repositories", async (context) => {
  const source = await fixture(context);
  const otherSource = await fixture(context);
  const resolved = policy(source.authorization);
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  assert.equal(Object.isFrozen(resolved.value.github.repositories[0]), true);
  assert.deepEqual(resolvePublicHistoryConfig("{}", source.authorization), {
    ok: false,
    error: { category: "invalid-config", retryable: false },
  });
  assert.equal(
    resolvePublicHistoryConfig(JSON.stringify({}), { ...source.authorization }).ok,
    false,
  );

  const valid = JSON.parse(
    JSON.stringify({
      historyVersion: "0.1.0",
      mode: "local-first",
      github: {
        authentication: "existing-gh",
        permission: "public-metadata-read-only",
        consent: {
          decision: "allow-read-selected-public-history",
          issuedAt: "2026-09-09T12:00:00Z",
          expiresAt: "2026-09-09T13:00:00Z",
        },
        repositories: [
          {
            repositoryId: "repo_public",
            owner: "example-owner",
            name: "example-repository",
            expectedHeadObjectId: null,
          },
        ],
        limits: resolved.value.github.limits,
      },
    }),
  );
  for (const candidate of [
    { ...valid, extra: "CANARY" },
    { ...valid, historyVersion: "2.0.0" },
    { ...valid, mode: "github-first" },
    { ...valid, github: { ...valid.github, token: "TOKEN_CANARY" } },
    {
      ...valid,
      github: {
        ...valid.github,
        consent: { ...valid.github.consent, expiresAt: "2026-09-11T12:00:00Z" },
      },
    },
    {
      ...valid,
      github: {
        ...valid.github,
        repositories: [{ ...valid.github.repositories[0], repositoryId: "repo_other" }],
      },
    },
    {
      ...valid,
      github: {
        ...valid.github,
        repositories: [{ ...valid.github.repositories[0], expectedHeadObjectId: "A".repeat(40) }],
      },
    },
  ]) {
    const result = resolvePublicHistoryConfig(JSON.stringify(candidate), source.authorization);
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /CANARY|TOKEN/u);
  }
  const rebound = await collectPublicHistory(
    otherSource.authorization,
    resolved.value,
    "2026-09-09T12:30:00Z",
    { commandPort: localCommandPort(), githubPort: githubPort().port, now: () => 0 },
  );
  assert.deepEqual(rebound, {
    ok: false,
    error: { category: "not-authorized", retryable: false },
    githubStatus: "rejected",
    networkRequests: 0,
  });
});

test("complete local Git history is always preferred and makes no GitHub request", async (context) => {
  const source = await fixture(context);
  const resolved = policy(source.authorization);
  assert.ok(resolved.ok);
  if (!resolved.ok) return;
  let calls = 0;
  const result = await collectPublicHistory(
    source.authorization,
    resolved.value,
    "2026-09-09T12:30:00Z",
    {
      commandPort: localCommandPort(),
      githubPort: {
        async get() {
          calls += 1;
          throw new Error("NETWORK_CANARY");
        },
      },
      now: () => 0,
    },
  );
  assert.equal(result.ok, true);
  assert.equal(result.historySource, "local-git");
  assert.equal(result.githubStatus, "not-needed");
  assert.equal(result.networkRequests, 0);
  assert.equal(calls, 0);
});

test("an explicitly consented shallow repository uses bounded GitHub public history", async (context) => {
  const source = await fixture(context, true);
  const resolved = policy(source.authorization);
  assert.ok(resolved.ok);
  if (!resolved.ok) return;
  const github = githubPort();
  const result = await collectPublicHistory(
    source.authorization,
    resolved.value,
    "2026-09-09T12:30:00Z",
    { commandPort: localCommandPort(), githubPort: github.port, now: () => 0 },
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.historySource, "github");
  assert.equal(result.githubStatus, "used");
  assert.equal(result.networkRequests, 3);
  assert.equal(result.value.repositories[0]?.headObjectId, head);
  assert.equal(result.value.repositories[0]?.commits.length, 2);
  assert.deepEqual(github.endpoints, [
    "/repos/example-owner/example-repository",
    `/repos/example-owner/example-repository/commits/${head}?per_page=100&page=1`,
    `/repos/example-owner/example-repository/commits/${parent}?per_page=100&page=1`,
  ]);
  assert.doesNotMatch(
    JSON.stringify(result),
    /CANARY|example-owner|example-repository|remote-canary|hidden@example/u,
  );
});

test("expired consent, private responses and unsafe remote paths fail closed to local history", async (context) => {
  const source = await fixture(context, true);
  const resolved = policy(source.authorization);
  assert.ok(resolved.ok);
  if (!resolved.ok) return;
  let calls = 0;
  const expired = await collectPublicHistory(
    source.authorization,
    resolved.value,
    "2026-09-09T13:00:00Z",
    {
      commandPort: localCommandPort(),
      githubPort: {
        async get() {
          calls += 1;
          return { ok: false, reason: "failed" };
        },
      },
      now: () => 0,
    },
  );
  assert.equal(expired.ok, true);
  assert.equal(expired.githubStatus, "expired");
  assert.equal(expired.networkRequests, 0);
  assert.equal(calls, 0);

  const privateRepository = githubPort({
    private: true,
    visibility: "private",
    full_name: "example-owner/example-repository",
  });
  const rejected = await collectPublicHistory(
    source.authorization,
    resolved.value,
    "2026-09-09T12:30:00Z",
    { commandPort: localCommandPort(), githubPort: privateRepository.port, now: () => 0 },
  );
  assert.equal(rejected.ok, true);
  assert.equal(rejected.historySource, "local-git");
  assert.equal(rejected.githubStatus, "rejected");
  assert.equal(rejected.networkRequests, 1);

  const unsafe = githubPort();
  unsafe.port.get = async (request) => {
    unsafe.endpoints.push(request.endpoint);
    const value = request.endpoint.includes("/commits/")
      ? commitResponse(head, [], ["../escape.ts"])
      : { private: false, visibility: "public", full_name: "example-owner/example-repository" };
    return { ok: true, output: Buffer.from(JSON.stringify(value)) };
  };
  const unsafeResult = await collectPublicHistory(
    source.authorization,
    resolved.value,
    "2026-09-09T12:30:00Z",
    { commandPort: localCommandPort(), githubPort: unsafe.port, now: () => 0 },
  );
  assert.equal(unsafeResult.ok, true);
  assert.equal(unsafeResult.githubStatus, "rejected");
  assert.doesNotMatch(JSON.stringify(unsafeResult), /escape|CANARY/u);
});

test("GitHub can replace an unavailable local Git command only with an exact configured head", async (context) => {
  const source = await fixture(context);
  const withoutHead = policy(source.authorization);
  const withHead = policy(source.authorization, head);
  assert.ok(withoutHead.ok && withHead.ok);
  if (!withoutHead.ok || !withHead.ok) return;
  /** @type {import("@fork-me-up/community-provider").BoundedGitCommandPort} */
  const unavailable = {
    async run() {
      return { ok: false, reason: "unavailable" };
    },
  };
  const noFallback = await collectPublicHistory(
    source.authorization,
    withoutHead.value,
    "2026-09-09T12:30:00Z",
    { commandPort: unavailable, githubPort: githubPort().port, now: () => 0 },
  );
  assert.equal(noFallback.ok, false);
  assert.equal(noFallback.githubStatus, "rejected");
  assert.equal(noFallback.networkRequests, 0);

  const github = githubPort();
  const fallback = await collectPublicHistory(
    source.authorization,
    withHead.value,
    "2026-09-09T12:30:00Z",
    { commandPort: unavailable, githubPort: github.port, now: () => 0 },
  );
  assert.equal(fallback.ok, true);
  assert.equal(fallback.historySource, "github");
  assert.equal(fallback.networkRequests, 3);
});

test("remote request, response, path and timestamp limits fail closed to shallow local history", async (context) => {
  const source = await fixture(context, true);
  /** @type {{policy: ReturnType<typeof policy>, port: import("@fork-me-up/community-provider").GitHubPublicHistoryPort, requests: number, status?: "unavailable"}[]} */
  const scenarios = [
    {
      policy: policy(source.authorization, null, { maxRequests: 2 }),
      port: githubPort().port,
      requests: 2,
    },
    {
      policy: policy(source.authorization, null, { maxResponseBytes: 64 }),
      port: {
        async get() {
          return /** @type {const} */ ({ ok: true, output: Buffer.alloc(65) });
        },
      },
      requests: 1,
    },
    {
      policy: policy(source.authorization, null, { maxChangedPaths: 1 }),
      port: githubPort().port,
      requests: 3,
    },
    {
      policy: policy(source.authorization),
      port: {
        async get(request) {
          const value = request.endpoint.includes("/commits/")
            ? {
                ...commitResponse(head, [], ["main.ts"]),
                commit: {
                  ...commitResponse(head, [], ["main.ts"]).commit,
                  author: {
                    ...commitResponse(head, [], ["main.ts"]).commit.author,
                    date: "09/09/2026 12:00:00",
                  },
                },
              }
            : {
                private: false,
                visibility: "public",
                full_name: "example-owner/example-repository",
              };
          return /** @type {const} */ ({
            ok: true,
            output: Buffer.from(JSON.stringify(value)),
          });
        },
      },
      requests: 2,
    },
    {
      policy: policy(source.authorization),
      port: {
        async get() {
          return { ok: false, reason: "deadline-exceeded" };
        },
      },
      requests: 1,
      status: "unavailable",
    },
  ];
  for (const scenario of scenarios) {
    assert.equal(scenario.policy.ok, true);
    if (!scenario.policy.ok) continue;
    const result = await collectPublicHistory(
      source.authorization,
      scenario.policy.value,
      "2026-09-09T12:30:00Z",
      { commandPort: localCommandPort(), githubPort: scenario.port, now: () => 0 },
    );
    assert.equal(result.ok, true);
    assert.equal(result.historySource, "local-git");
    assert.equal(result.githubStatus, scenario.status ?? "rejected");
    assert.equal(result.networkRequests, scenario.requests);
    assert.doesNotMatch(JSON.stringify(result), /CANARY|09\/09\/2026/u);
  }
});

test("the Node GitHub port accepts only fixed read-only github.com API requests", async () => {
  for (const request of [
    { endpoint: "https://example.invalid/repos/a/b", maximumOutputBytes: 1, timeoutMs: 1 },
    {
      endpoint: "/repos/a/b/commits/" + head + "?per_page=100&page=5",
      maximumOutputBytes: 1,
      timeoutMs: 1,
    },
    { endpoint: "/repos/a/b", maximumOutputBytes: 0, timeoutMs: 1 },
    { endpoint: "/repos/a/b", maximumOutputBytes: 1, timeoutMs: 0 },
  ]) {
    assert.deepEqual(await nodeGitHubPublicHistoryPort.get(request), {
      ok: false,
      reason: "invalid-request",
    });
  }
  const source = await readFile(
    new URL("../../packages/community-provider/src/public-history-collector.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /spawn\(\s*"gh"/u);
  assert.match(source, /"--method",\s*\n\s*"GET"/u);
  assert.match(source, /"--hostname",\s*\n\s*"github\.com"/u);
  assert.match(source, /shell: false/u);
  assert.match(source, /GH_PROMPT_DISABLED: "1"/u);
  assert.doesNotMatch(source, /\b(?:fetch|writeFile|appendFile|createWriteStream|eval)\s*\(/u);
  assert.doesNotMatch(source, /"(?:POST|PUT|PATCH|DELETE)"/u);
});
