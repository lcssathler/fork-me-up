import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createIncrementalRefreshSession,
  refreshLocalRepositories,
  resolvePublicHistoryConfig,
} from "@fork-me-up/community-provider";
import {
  head,
  mockGit,
  refreshFixture,
  refreshRequest,
  refreshValue,
} from "../helpers/incremental-refresh-fixture.mjs";

test("incremental refresh exposes bounded GitHub use and reuses it only from process memory", async (context) => {
  const fixture = await refreshFixture(context);
  await writeFile(path.join(fixture.a, ".git", "shallow"), `${head}\n`);
  const resolved = resolvePublicHistoryConfig(
    JSON.stringify({
      historyVersion: "0.1.0",
      mode: "local-first",
      github: {
        authentication: "existing-gh",
        permission: "public-metadata-read-only",
        consent: {
          decision: "allow-read-selected-public-history",
          issuedAt: "2026-09-07T11:59:00Z",
          expiresAt: "2026-09-07T13:00:00Z",
        },
        repositories: [
          {
            repositoryId: "repo_a",
            owner: "example-owner",
            name: "example-repository",
            expectedHeadObjectId: null,
          },
        ],
        limits: {
          maxCommits: 8,
          maxRequests: 16,
          maxResponseBytes: 65536,
          maxTotalResponseBytes: 1048576,
          maxDurationMs: 30000,
          maxPagesPerCommit: 2,
          maxChangedPaths: 1000,
        },
      },
    }),
    fixture.authorization,
  );
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  /** @type {string[]} */
  const endpoints = [];
  /** @type {import("@fork-me-up/community-provider").GitHubPublicHistoryPort} */
  const githubPort = {
    async get(request) {
      endpoints.push(request.endpoint);
      const value = request.endpoint.includes("/commits/")
        ? {
            sha: head,
            parents: [],
            commit: {
              author: {
                name: "Unit Person",
                email: "unit@example.invalid",
                date: "2026-09-07T11:00:00Z",
              },
              committer: {
                name: "Unit Person",
                email: "unit@example.invalid",
                date: "2026-09-07T11:00:00Z",
              },
              message: "REMOTE_MESSAGE_CANARY",
            },
            files: [{ filename: "main.ts" }, { filename: "extra.ts" }],
          }
        : {
            private: false,
            visibility: "public",
            full_name: "example-owner/example-repository",
          };
      return /** @type {const} */ ({ ok: true, output: Buffer.from(JSON.stringify(value)) });
    },
  };
  const created = createIncrementalRefreshSession(
    fixture.authorization,
    fixture.identity,
    fixture.risk,
    JSON.stringify(fixture.settings),
    {
      commandPort: mockGit,
      githubPort,
      now: () => 0,
      wallClock: () => Date.parse("2026-09-07T12:00:00Z"),
    },
    resolved.value,
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const session = created.value;
  const cold = refreshValue(await refreshLocalRepositories(session, refreshRequest()));
  assert.equal(cold.status, "fresh");
  assert.equal(cold.work.networkRequests, 2);
  assert.equal(cold.repositories[0]?.historySource, "github");
  assert.equal(cold.repositories[0]?.githubStatus, "used");
  assert.equal(cold.repositories[1]?.historySource, "local-git");
  assert.equal(cold.repositories[1]?.githubStatus, "disabled");
  assert.equal(endpoints.length, 2);
  assert.doesNotMatch(
    JSON.stringify(cold),
    /CANARY|example-owner|example-repository|unit@example/u,
  );

  const hit = refreshValue(
    await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:01Z")),
  );
  assert.equal(hit.status, "fresh");
  assert.equal(hit.work.collections, 0);
  assert.equal(hit.work.networkRequests, 0);
  assert.equal(hit.repositories[0]?.origin, "memory-cache");
  assert.equal(hit.repositories[0]?.historySource, "github");
  assert.equal(endpoints.length, 2);
});
