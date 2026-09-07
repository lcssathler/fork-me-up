import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, rename, stat, symlink, unlink, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  nodeBoundedGitCommandPort,
  produceDemandProfile,
  refreshLocalRepositories,
} from "@fork-me-up/community-provider";
import {
  refreshFixture,
  refreshRequest,
  refreshValue,
} from "../helpers/incremental-refresh-fixture.mjs";
import { demandRequest, readyDemand } from "../helpers/demand-profile-fixture.mjs";

/** @param {string} directory @param {string[]} args */
function git(directory, args) {
  return execFileSync("git", args, {
    cwd: directory,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      GIT_AUTHOR_DATE: "2026-09-07T11:00:00+00:00",
      GIT_COMMITTER_DATE: "2026-09-07T11:00:00+00:00",
    },
  });
}
/** @param {string} directory */
function commit(directory) {
  git(directory, ["add", "--", "."]);
  git(directory, [
    "-c",
    "user.name=Unit Person",
    "-c",
    "user.email=unit@example.invalid",
    "commit",
    "-m",
    "MESSAGE_CANARY",
  ]);
}

test("real multi-repository refresh reuses unchanged sources and composes with Demand while updating content and Git", async (context) => {
  const fixture = await refreshFixture(context, false);
  for (const directory of [fixture.a, fixture.b]) {
    git(directory, ["init", "--initial-branch=main"]);
    commit(directory);
  }
  const session = fixture.session({}, { commandPort: nodeBoundedGitCommandPort });
  const cold = refreshValue(await refreshLocalRepositories(session, refreshRequest()));
  assert.equal(cold.status, "fresh");
  const counts = { ...fixture.stats };
  const hit = refreshValue(
    await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:01Z")),
  );
  assert.equal(hit.status, "fresh");
  assert.equal(hit.work.collections, 0);
  assert.deepEqual(fixture.stats, counts);
  const request = demandRequest();
  const selected = hit.filesystemSnapshots[0];
  assert.ok(selected);
  const demand = readyDemand(
    produceDemandProfile(
      JSON.stringify({
        ...request,
        project: { projectRef: "project_a", repositoryId: "repo_a", sourcePaths: ["main.ts"] },
      }),
      selected,
    ),
  );
  assert.deepEqual(
    demand.capabilities.map((item) => item.capability),
    ["language.typescript"],
  );

  const target = path.join(fixture.b, "main.ts");
  const before = await stat(target);
  await writeFile(target, "export const SOURCE_CANARY = 3;\n");
  await utimes(target, before.atime, before.mtime);
  const changed = refreshValue(
    await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:02Z")),
  );
  assert.equal(changed.status, "fresh");
  assert.equal(changed.work.collections, 1);
  assert.equal(changed.repositories[0]?.origin, "memory-cache");
  assert.equal(changed.repositories[1]?.reason, "fingerprint-changed");

  await writeFile(path.join(fixture.b, "new.py"), "NEW_SOURCE_CANARY = True\n");
  commit(fixture.b);
  const committed = refreshValue(
    await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:03Z")),
  );
  assert.equal(committed.status, "fresh");
  assert.equal(committed.work.collections, 1);
  assert.ok(committed.derivation?.claims.some((claim) => claim.capability === "language.python"));
  await unlink(path.join(fixture.b, "new.py"));
  const deleted = refreshValue(
    await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:04Z")),
  );
  assert.equal(deleted.status, "fresh");
  assert.ok(
    deleted.derivation?.invalidation.evidence.some(
      (entry) => entry.reason === "source-unavailable",
    ),
  );
  assert.doesNotMatch(
    JSON.stringify([cold, hit, changed, committed, deleted, demand]),
    /SOURCE_CANARY|MESSAGE_CANARY|unit@example|Unit Person/u,
  );
  assert.equal(JSON.stringify(deleted).includes(fixture.root), false);
  assert.equal(
    await readFile(path.join(fixture.a, "main.ts"), "utf8"),
    "export const SOURCE_CANARY = 1;\n",
  );
});

test("real repository junction replacement cannot unlock an existing cached source", async (context) => {
  const fixture = await refreshFixture(context);
  const session = fixture.session();
  assert.equal(
    refreshValue(await refreshLocalRepositories(session, refreshRequest())).status,
    "fresh",
  );
  const moved = path.join(fixture.root, "original_b");
  await rename(fixture.b, moved);
  await symlink(fixture.a, fixture.b, process.platform === "win32" ? "junction" : "dir");
  const result = refreshValue(
    await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:01Z")),
  );
  assert.equal(result.repositories[1]?.status, "invalid");
  assert.equal(result.repositories[1]?.origin, "none");
  assert.equal(result.repositories[1]?.fingerprint, null);
  assert.equal(result.derivation, null);
  assert.deepEqual(result.filesystemSnapshots, []);
  assert.doesNotMatch(JSON.stringify(result), /original_b|main.ts|SOURCE_CANARY/u);
});
