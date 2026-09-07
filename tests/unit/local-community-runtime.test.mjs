import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createLocalCommunityRuntime,
  nodeBoundedGitCommandPort,
} from "@fork-me-up/community-provider";
import {
  communityFixture,
  ownerRefresh,
  communityTask,
} from "../helpers/local-community-fixture.mjs";
const clock = () => new Date("2026-09-07T12:00:10Z");

test("runtime rejects mismatched identities/projects and closed configuration violations before persistence", async (context) => {
  const fixture = await communityFixture(context);
  for (const config of [
    { ...fixture.config, version: "1.0.0" },
    { ...fixture.config, extra: "CANARY" },
    { ...fixture.config, identity: { ...fixture.config.identity, subjectRef: "other" } },
    { ...fixture.config, project: { projectRef: "project_other", repositoryId: "repo_a" } },
  ]) {
    const result = await createLocalCommunityRuntime(JSON.stringify(config), { clock });
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /CANARY|directoryPath|subject_synthetic/u);
  }
  assert.equal((await createLocalCommunityRuntime("x".repeat(131073))).ok, false);
  for (const directoryPath of [fixture.a, fixture.root]) {
    const overlapping = { ...fixture.config, store: { ...fixture.config.store, directoryPath } };
    assert.equal(
      (await createLocalCommunityRuntime(JSON.stringify(overlapping), { clock })).ok,
      false,
    );
  }
  assert.deepEqual(await readdir(fixture.store), []);
});

test("malformed owner commands preserve usable context and do not mutate stored data", async (context) => {
  const fixture = await communityFixture(context);
  const created = await createLocalCommunityRuntime(JSON.stringify(fixture.config), { clock });
  assert.ok(created.ok);
  if (!created.ok) return;
  const runtime = created.value;
  assert.equal(
    /** @type {any} */ (await runtime.run(JSON.stringify(ownerRefresh(null, 0)))).ok,
    true,
  );
  const names = await readdir(fixture.store);
  const bytes = await Promise.all(names.map((name) => readFile(path.join(fixture.store, name))));
  for (const request of [
    {
      version: "0.1.0",
      operation: "delete",
      confirm: "wrong",
      cacheScope: "all-local-adapter-caches",
    },
    { ...ownerRefresh(0, 1), request: {} },
    { ...ownerRefresh(0, 1), expectedGeneration: -1 },
    { ...ownerRefresh(0, 1), at: "2020-01-01T00:00:00Z" },
  ]) {
    assert.equal(/** @type {any} */ (await runtime.run(JSON.stringify(request))).ok, false);
    assert.equal((await runtime.provider.invoke(communityTask)).outcome, "success");
  }
  assert.deepEqual(await readdir(fixture.store), names);
  assert.deepEqual(
    await Promise.all(names.map((name) => readFile(path.join(fixture.store, name)))),
    bytes,
  );
});

test("incomplete refresh preserves the Store and withholds context until a complete verified refresh", async (context) => {
  const fixture = await communityFixture(context);
  let unavailable = false;
  const created = await createLocalCommunityRuntime(JSON.stringify(fixture.config), {
    clock,
    refreshPorts: {
      commandPort: {
        async run(request) {
          if (unavailable) throw new Error("GIT_FAILURE_CANARY");
          return nodeBoundedGitCommandPort.run(request);
        },
      },
    },
  });
  assert.ok(created.ok);
  if (!created.ok) return;
  const runtime = created.value;
  assert.equal(
    /** @type {any} */ (await runtime.run(JSON.stringify(ownerRefresh(null, 0)))).ok,
    true,
  );
  const names = await readdir(fixture.store);
  const bytes = await Promise.all(names.map((name) => readFile(path.join(fixture.store, name))));
  unavailable = true;
  const failed = await runtime.run(JSON.stringify(ownerRefresh(0, 1, true)));
  assert.equal(/** @type {any} */ (failed).ok, false);
  assert.doesNotMatch(JSON.stringify(failed), /CANARY/u);
  assert.equal((await runtime.provider.invoke(communityTask)).outcome, "error");
  assert.deepEqual(
    await Promise.all(names.map((name) => readFile(path.join(fixture.store, name)))),
    bytes,
  );
  unavailable = false;
  assert.equal(
    /** @type {any} */ (await runtime.run(JSON.stringify(ownerRefresh(0, 2, true)))).ok,
    true,
  );
  assert.equal((await runtime.provider.invoke(communityTask)).outcome, "success");
});

test("consumer requests cannot invoke owner operations or accept source authority", async (context) => {
  const fixture = await communityFixture(context);
  const created = await createLocalCommunityRuntime(JSON.stringify(fixture.config), { clock });
  assert.ok(created.ok);
  if (!created.ok) return;
  for (const request of [
    { ...communityTask, operation: "delete", input: {} },
    { ...communityTask, input: { ...communityTask.input, sources: fixture.config.sources } },
  ]) {
    const result = await created.value.provider.invoke(request);
    assert.equal(result.outcome, "error");
    assert.doesNotMatch(JSON.stringify(result), /directoryPath|CANARY|root_synthetic/u);
  }
  assert.deepEqual(await readdir(fixture.store), []);
});
