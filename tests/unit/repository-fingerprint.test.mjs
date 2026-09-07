import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  fingerprintRepository,
  nodeRepositoryFingerprintPort,
} from "@fork-me-up/community-provider";
import { selectAuthorizedRepository } from "../../packages/community-provider/src/authorized-repository-config.ts";
import { refreshFixture } from "../helpers/incremental-refresh-fixture.mjs";

test("fingerprint skips dependency and nested-repository contents without reading files", async (context) => {
  const fixture = await refreshFixture(context);
  const nested = path.join(fixture.a, "nested");
  const dependencies = path.join(fixture.a, "node_modules");
  await mkdir(nested);
  await writeFile(path.join(nested, ".git"), "NESTED_CANARY");
  await mkdir(dependencies);
  await writeFile(path.join(dependencies, "source.ts"), "DEPENDENCY_CANARY");
  const authority = selectAuthorizedRepository(fixture.authorization, "repo_a", 1000);
  assert.ok(authority);
  const result = await fingerprintRepository(authority, {
    maximumEntries: 1000,
    now: () => 0,
    port: {
      ...nodeRepositoryFingerprintPort,
      async list(directory, maximum) {
        assert.notEqual(directory, nested);
        assert.notEqual(directory, dependencies);
        return nodeRepositoryFingerprintPort.list(directory, maximum);
      },
    },
  });
  assert.equal(result.ok, true);
  assert.doesNotMatch(JSON.stringify(result), /CANARY|nested|node_modules|main.ts/u);
  assert.deepEqual(
    await fingerprintRepository(authority, { maximumEntries: 1000, now: () => 0 }),
    result,
  );
});

test("probe rejects forged authority, traversal, duplicate names, bad stamps and redirected entries", async (context) => {
  const fixture = await refreshFixture(context);
  const authority = selectAuthorizedRepository(fixture.authorization, "repo_a", 1000);
  assert.ok(authority);
  assert.equal((await fingerprintRepository({ ...authority }, { maximumEntries: 1000 })).ok, false);
  for (const names of [
    ["../ESCAPE_CANARY"],
    ["a", "a"],
    ["C:\\CANARY"],
    ["\u0000"],
    ["a/b"],
    ["."],
  ]) {
    const result = await fingerprintRepository(authority, {
      maximumEntries: 1000,
      now: () => 0,
      port: {
        ...nodeRepositoryFingerprintPort,
        async list() {
          return names;
        },
      },
    });
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /CANARY/u);
  }
  for (const stamp of ["CANARY", "f".repeat(64) + "\n"]) {
    assert.equal(
      (
        await fingerprintRepository(authority, {
          maximumEntries: 1000,
          now: () => 0,
          port: {
            ...nodeRepositoryFingerprintPort,
            async inspect(candidate) {
              return { ...(await nodeRepositoryFingerprintPort.inspect(candidate)), stamp };
            },
          },
        })
      ).ok,
      false,
    );
  }
  assert.equal(
    (
      await fingerprintRepository(authority, {
        maximumEntries: 1000,
        now: () => 0,
        port: {
          ...nodeRepositoryFingerprintPort,
          async inspect(candidate) {
            return {
              ...(await nodeRepositoryFingerprintPort.inspect(candidate)),
              canonicalPath: `${candidate}-outside`,
            };
          },
        },
      })
    ).ok,
    false,
  );
});

test("probe bounds entries, depth, time and detects concurrent directory change", async (context) => {
  const fixture = await refreshFixture(context);
  const authority = selectAuthorizedRepository(fixture.authorization, "repo_a", 1000);
  assert.ok(authority);
  assert.deepEqual(await fingerprintRepository(authority, { maximumEntries: 1, now: () => 0 }), {
    ok: false,
    category: "limit-exceeded",
    entries: 1,
  });
  let tick = 0;
  assert.equal(
    (await fingerprintRepository(authority, { maximumEntries: 1000, now: () => tick++ * 1000 })).ok,
    false,
  );
  let calls = 0;
  const concurrent = await fingerprintRepository(authority, {
    maximumEntries: 1000,
    now: () => 0,
    port: {
      ...nodeRepositoryFingerprintPort,
      async inspect(candidate) {
        const entry = await nodeRepositoryFingerprintPort.inspect(candidate);
        if (candidate === fixture.a && ++calls > 1) return { ...entry, stamp: "f".repeat(64) };
        return entry;
      },
    },
  });
  assert.equal(concurrent.ok, false);
  if (!concurrent.ok) assert.equal(concurrent.category, "source-changed");
  await mkdir(path.join(fixture.a, ...Array.from({ length: 17 }, () => "deep")), {
    recursive: true,
  });
  const deep = await fingerprintRepository(authority, { maximumEntries: 1000, now: () => 0 });
  assert.equal(deep.ok, false);
  if (!deep.ok) assert.equal(deep.category, "limit-exceeded");
});

test("metadata probe imports no content-read, write, execution or network primitives", async () => {
  const source = await readFile(
    new URL("../../packages/community-provider/src/repository-fingerprint.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /\b(?:readFile|writeFile|spawn|execFile|fetch|console|unlink|rename)\b|node:(?:http|https|child_process|net|tls)/u,
  );
});

test("ignored enumerated names are charged and negative probe clocks fail closed", async (context) => {
  const fixture = await refreshFixture(context);
  const authority = selectAuthorizedRepository(fixture.authorization, "repo_a", 1000);
  assert.ok(authority);
  const result = await fingerprintRepository(authority, {
    maximumEntries: 1000,
    now: () => 0,
    port: {
      ...nodeRepositoryFingerprintPort,
      async list() {
        return ["node_modules", ".hg", ".svn", ".fork-me-up"];
      },
    },
  });
  assert.equal(result.ok, true);
  assert.ok(result.entries >= 8);
  assert.equal(
    (await fingerprintRepository(authority, { maximumEntries: 1000, now: () => -1 })).ok,
    false,
  );
});
