import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { readSelectedGitHubSources } from "@fork-me-up/community-provider";
import { nodeSelectedGitHubPort } from "../../packages/community-provider/src/selected-github-transport.ts";
import {
  selectedConfig,
  selectedFixture,
  currentTime,
  base,
  objectBase,
  tree,
  blob,
} from "../helpers/selected-github-fixture.mjs";

/** @param {ReturnType<typeof selectedConfig>} config @param {ReturnType<typeof selectedFixture>} fixture @param {'discover'|'collect'} [operation] */
function read(config, fixture, operation = "collect") {
  const json = JSON.stringify(config);
  return readSelectedGitHubSources(json, operation, {
    port: fixture.port,
    clock: () => currentTime,
    readAuthority: async () => json,
  });
}
test("selected collection pins objects, skips unsafe sources and never returns prose", async () => {
  const fixture = selectedFixture();
  const result = await read(selectedConfig(), fixture);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.counts.files, 1);
  assert.equal(result.counts.commits, 2);
  assert.equal(result.observations[0]?.coverage, "bounded-sample");
  assert.equal(result.observations[0]?.skippedEntries, 3);
  assert.equal(result.observations[0]?.files[0]?.language, "typescript");
  assert.ok(Object.isFrozen(result.observations[0]?.files));
  assert.doesNotMatch(
    JSON.stringify(result),
    /CANARY|example-owner|main\.ts|synthetic@example|instruction|demonstrated/u,
  );
  assert.ok(
    fixture.calls.every(
      (endpoint) =>
        endpoint === "/user" || endpoint.startsWith(base) || endpoint.startsWith(objectBase),
    ),
  );
});
test("discovery has no content/history requests and supports explicit public selection", async () => {
  const config = selectedConfig();
  assert.ok(config.repositories[0]);
  config.repositories[0].visibility = "public";
  config.repositories[0].content = false;
  config.repositories[0].history = false;
  const fixture = selectedFixture();
  fixture.replies[base] = {
    .../** @type {object} */ (fixture.replies[base]),
    private: false,
    visibility: "public",
  };
  assert.equal((await read(config, fixture, "discover")).ok, true);
  assert.deepEqual(fixture.calls, ["/user", base, base, "/user"]);
  fixture.calls.length = 0;
  assert.equal((await read(config, fixture)).ok, false);
  assert.equal(fixture.calls.length, 0);
});
test("history-only scope does not read trees or blobs; content scope excludes ancestor history", async () => {
  for (const scope of ["content", "history"]) {
    const config = selectedConfig();
    assert.ok(config.repositories[0]);
    config.repositories[0].content = scope === "content";
    config.repositories[0].history = scope === "history";
    const fixture = selectedFixture();
    const result = await read(config, fixture);
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    assert.equal(scope === "history" ? result.counts.files : result.counts.commits, 0);
    if (scope === "history") assert.ok(fixture.calls.every((value) => !/trees|blobs/u.test(value)));
    else assert.equal(fixture.calls.filter((value) => value.includes("/git/commits/")).length, 1);
  }
});
test("invalid, expired, revoked and excluded scope makes zero requests", async () => {
  const config = selectedConfig();
  for (const invalid of [
    "{}",
    JSON.stringify({ ...config, token: "CREDENTIAL_CANARY" }),
    JSON.stringify({ ...config, expiresAt: "2026-09-21T11:30:00.000Z" }),
    JSON.stringify({ ...config, repositories: [{ ...config.repositories[0], metadata: false }] }),
    JSON.stringify({
      ...config,
      repositories: [{ ...config.repositories[0], name: "../excluded" }],
    }),
    JSON.stringify({ ...config, repositories: [config.repositories[0], config.repositories[0]] }),
  ]) {
    const fixture = selectedFixture();
    const result = await readSelectedGitHubSources(invalid, "collect", {
      port: fixture.port,
      clock: () => currentTime,
      readAuthority: async () => invalid,
    });
    assert.equal(result.ok, false);
    assert.equal(fixture.calls.length, 0);
    assert.doesNotMatch(JSON.stringify(result), /CANARY|excluded/u);
  }
  const fixture = selectedFixture();
  const json = JSON.stringify(config);
  const result = await readSelectedGitHubSources(json, "collect", {
    port: fixture.port,
    clock: () => currentTime,
    readAuthority: async () => null,
  });
  assert.equal(result.ok, false);
  assert.equal(fixture.calls.length, 0);
});
test("revocation or expiry during a request discards every observation", async () => {
  for (const mode of ["revoke", "expire"]) {
    const fixture = selectedFixture();
    const json = JSON.stringify(selectedConfig());
    const result = await readSelectedGitHubSources(json, "collect", {
      port: fixture.port,
      clock: () => currentTime + (mode === "expire" && fixture.calls.length > 1 ? 86400000 : 0),
      readAuthority: async () => (mode === "revoke" && fixture.calls.length > 1 ? null : json),
    });
    assert.equal(result.ok, false);
    assert.ok(fixture.calls.length <= 2);
    assert.equal("observations" in result, false);
  }
});
test("account, visibility and repository mismatches stop before source content", async () => {
  for (const patch of [
    { login: "someone-else" },
    { private: false },
    { id: 0 },
    { full_name: "other/excluded" },
  ]) {
    const fixture = selectedFixture();
    const endpoint = "login" in patch ? "/user" : base;
    fixture.replies[endpoint] = { .../** @type {object} */ (fixture.replies[endpoint]), ...patch };
    assert.equal((await read(selectedConfig(), fixture)).ok, false);
    assert.ok(fixture.calls.length <= 2);
  }
});
test("hash mismatch, traversal and truncated trees reject the whole result", async () => {
  for (const kind of ["hash", "path", "truncated", "malformed"]) {
    const fixture = selectedFixture();
    if (kind === "hash")
      fixture.replies[`${objectBase}/git/blobs/${blob}`] = {
        sha: blob,
        size: 99,
        encoding: "base64",
        content: "CANARY",
      };
    else if (kind === "malformed")
      fixture.replies[`${objectBase}/git/trees/${tree}?recursive=1`] = [];
    else
      fixture.replies[`${objectBase}/git/trees/${tree}?recursive=1`] = {
        sha: tree,
        truncated: kind === "truncated",
        tree: [{ path: "../escape.ts", sha: blob }],
      };
    const result = await read(selectedConfig(), fixture);
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /CANARY|escape/u);
  }
});
test("fixed request, response, total and time budgets stop collection", async () => {
  for (const limits of [
    { requests: 1 },
    { responseBytes: 1 },
    { totalBytes: 1 },
    { treeEntries: 1 },
  ]) {
    const fixture = selectedFixture();
    const config = selectedConfig();
    Object.assign(config.limits, limits);
    assert.equal((await read(config, fixture)).ok, false);
    if ("requests" in limits) assert.equal(fixture.calls.length, 1);
  }
  const fixture = selectedFixture();
  const json = JSON.stringify(selectedConfig());
  let ticks = 0;
  assert.equal(
    (
      await readSelectedGitHubSources(json, "collect", {
        port: fixture.port,
        clock: () => currentTime,
        monotonic: () => ticks++ * 60000,
        readAuthority: async () => json,
      })
    ).ok,
    false,
  );
  assert.equal(fixture.calls.length, 0);
});
test("network and parser failures reveal neither upstream diagnostics nor partial state", async () => {
  const json = JSON.stringify(selectedConfig());
  for (const port of [
    {
      get: async () => {
        throw new Error("CREDENTIAL_CANARY");
      },
    },
    { get: async () => ({ ok: true, output: Buffer.from("RAW_CANARY") }) },
    { get: async () => ({ ok: false }) },
  ]) {
    const result = await readSelectedGitHubSources(json, "collect", {
      port: /** @type {import('@fork-me-up/community-provider').SelectedGitHubPort} */ (port),
      clock: () => currentTime,
      readAuthority: async () => json,
    });
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /CANARY/u);
  }
});
test("transport rejects arbitrary endpoints, writes and oversized requests without executing gh", async () => {
  for (const endpoint of [
    "https://evil.test",
    "/user/repos",
    `${base}/issues`,
    `${base}/commits/HEAD`,
    `${base};whoami`,
    `${objectBase}/git/blobs/../../excluded`,
  ])
    assert.deepEqual(
      await nodeSelectedGitHubPort.get({ endpoint, maximumOutputBytes: 1024, timeoutMs: 1000 }),
      { ok: false },
    );
  assert.deepEqual(
    await nodeSelectedGitHubPort.get({
      endpoint: "/user",
      maximumOutputBytes: 2_000_000,
      timeoutMs: 1000,
    }),
    { ok: false },
  );
});

test("configuration and inherited-property extensions never trigger blob reads", async () => {
  for (const path of [
    "config.ts",
    "config/database.ts",
    "webpack.config.js",
    "configuration/app.js",
    "file.constructor",
    "file.__proto__",
  ]) {
    const f = selectedFixture();
    f.replies[`${objectBase}/git/trees/${tree}?recursive=1`] = {
      sha: tree,
      truncated: false,
      tree: [{ path, type: "blob", mode: "100644", sha: blob, size: 1 }],
    };
    const result = await read(selectedConfig(), f);
    assert.equal(result.ok, true);
    assert.ok(f.calls.every((value) => !value.includes("/git/blobs/")));
    if (result.ok) assert.equal(result.counts.files, 0);
  }
});

test("repository replacement at final revalidation discards collected data", async () => {
  const f = selectedFixture();
  const original = f.port.get;
  f.port.get = async (request) => {
    if (request.endpoint === base && f.calls.includes(base))
      f.replies[base] = { .../** @type {object} */ (f.replies[base]), id: 999 };
    return original(request);
  };
  const result = await read(selectedConfig(), f);
  assert.equal(result.ok, false);
  assert.equal("observations" in result, false);
});

test("lowered sampling caps remain explicit and invalid clocks fail closed", async () => {
  const f = selectedFixture();
  const config = selectedConfig();
  Object.assign(config.limits, { files: 1, commits: 1 });
  const result = await read(config, f);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.counts.commits, 1);
    assert.equal(result.observations[0]?.coverage, "bounded-sample");
  }
  for (const monotonic of [
    () => NaN,
    () => -Infinity,
    (() => {
      let count = 2;
      return () => count--;
    })(),
  ]) {
    const f = selectedFixture();
    const json = JSON.stringify(config);
    assert.equal(
      (
        await readSelectedGitHubSources(json, "collect", {
          port: f.port,
          clock: () => currentTime,
          monotonic,
          readAuthority: async () => json,
        })
      ).ok,
      false,
    );
    assert.equal(f.calls.length, 0);
  }
});
