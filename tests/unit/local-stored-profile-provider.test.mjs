import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Readable, Writable } from "node:stream";
import test from "node:test";
import {
  isDeveloperContextPacket,
  isProfileProviderCapabilities,
  isProfileProviderResponse,
} from "@fork-me-up/protocol";
import {
  deleteLocalProfileStore,
  refreshLocalRepositories,
  writeLocalProfileStore,
} from "@fork-me-up/community-provider";
import { createLocalStoredProfileProvider } from "../../packages/community-provider/src/local-stored-profile-provider.ts";
import { serveMcpStdio } from "../../apps/mcp-local/src/mcp-stdio-server.ts";
import { ownerFixture } from "../helpers/owner-profile-fixture.mjs";
import { refreshRequest, refreshValue } from "../helpers/incremental-refresh-fixture.mjs";

/** @param {string} operation @param {unknown} [input] */
function request(operation, input = {}) {
  return {
    schemaVersion: "0.1.0",
    kind: "profile-provider-request",
    requestId: "request_stored",
    operation,
    input,
  };
}
const task = {
  task: "TASK_PRIVATE_CANARY",
  purpose: "coding-assistance",
  maxTokens: 8192,
  requestedCapabilities: ["language.typescript"],
};
/** @param {Awaited<ReturnType<typeof ownerFixture>>} fixture @param {Partial<import('../../packages/community-provider/src/local-stored-profile-provider.ts').LocalStoredProfileProviderOptions>} [overrides] */
function providerFor(fixture, overrides = {}) {
  const projectRef = fixture.initial.profile.claims[0]?.projectRef;
  assert.ok(projectRef);
  return createLocalStoredProfileProvider(fixture.configuration, {
    projectRef,
    repositoryId: projectRef.replace("project_", "repo_"),
    clock: () => new Date("2026-09-07T12:00:02Z"),
    createId: (kind) => `${kind}_stored`,
    maxObservationAgeMs: 86400000,
    ...overrides,
  });
}
/** @param {import('@fork-me-up/protocol').ProfileProviderResponse} response */
function packet(response) {
  assert.equal(response.outcome, "success");
  assert.ok(isDeveloperContextPacket(response.data));
  return response.data;
}

test("stored provider discovers its bounded subset without reading deleted or unavailable profile state", async (context) => {
  const fixture = await ownerFixture(context);
  assert.ok((await deleteLocalProfileStore(fixture.configuration)).ok);
  const provider = providerFor(fixture, {
    clock() {
      throw new Error("CLOCK_CANARY");
    },
    available: () => false,
  });
  const result = await provider.invoke(request("get-provider-capabilities"));
  assert.equal(result.outcome, "success");
  assert.ok(isProfileProviderCapabilities(result.data));
  assert.equal(provider.capabilities.providerId, "provider_local_community");
  assert.deepEqual(provider.capabilities.operations, [
    "get-provider-capabilities",
    "get-profile-metadata",
    "get-task-context",
  ]);
  assert.doesNotMatch(JSON.stringify(result), /CANARY|subject_synthetic|store_synthetic/u);
  assert.equal(
    (await provider.invoke(request("get-profile-metadata"))).error?.category,
    "profile-unavailable",
  );
});

test("each protected invocation reloads corrections and deletion without exposing raw owner content", async (context) => {
  const fixture = await ownerFixture(context);
  const provider = providerFor(fixture);
  const first = packet(await provider.invoke(request("get-task-context", task)));
  assert.notEqual(first.claims[0]?.state, "disputed");
  assert.ok((await fixture.correct("reject", 0)).ok);
  const next = packet(await provider.invoke(request("get-task-context", task)));
  assert.equal(next.claims.length, 1);
  assert.equal(next.claims[0]?.state, "disputed");
  assert.equal(next.responsePolicy.mode, "teach-while-doing");
  assert.notEqual(next.profileVersion, first.profileVersion);
  assert.doesNotMatch(JSON.stringify(next), /CANARY|owner_history_|main.ts|subject_synthetic/u);
  assert.ok((await deleteLocalProfileStore(fixture.configuration)).ok);
  assert.equal(
    (await provider.invoke(request("get-task-context", task))).error?.category,
    "profile-unavailable",
  );
});

test("stored provider applies age limits to a private copy and rejects future or regressing clocks", async (context) => {
  const fixture = await ownerFixture(context);
  let now = new Date("2026-09-07T12:00:02Z");
  const provider = providerFor(fixture, { clock: () => now, maxObservationAgeMs: 1000 });
  assert.ok(
    packet(await provider.invoke(request("get-task-context", task))).claims.every(
      (item) => item.freshness.stale,
    ),
  );
  assert.deepEqual(await fixture.load(), fixture.initial);
  const fractional = providerFor(fixture, {
    clock: () => new Date("2026-09-07T12:00:00.500Z"),
    maxObservationAgeMs: 0,
  });
  assert.ok(
    packet(await fractional.invoke(request("get-task-context", task))).claims.every(
      (item) => item.freshness.stale,
    ),
  );
  const metadata = await provider.invoke(request("get-profile-metadata"));
  assert.ok(metadata.outcome === "success");
  assert.equal(
    /** @type {import('@fork-me-up/protocol').ProfileMetadata} */ (metadata.data).freshnessStatus,
    "stale",
  );
  now = new Date("2026-09-07T12:00:01Z");
  assert.equal((await provider.invoke(request("get-profile-metadata"))).outcome, "error");
  now = new Date("invalid");
  assert.equal((await provider.invoke(request("get-task-context", task))).outcome, "error");
  const future = providerFor(fixture, { clock: () => new Date("2026-09-07T11:00:00Z") });
  assert.equal(
    (await future.invoke(request("get-task-context", task))).error?.category,
    "profile-unavailable",
  );
});

test("stored provider rejects malformed, unsupported, arbitrary-subject and excessive requests before disclosure", async (context) => {
  const fixture = await ownerFixture(context);
  const provider = providerFor(fixture);
  for (const value of [
    null,
    { ...request("get-profile-metadata"), subjectRef: "PRIVATE_CANARY" },
    { ...request("get-task-context", task), requestId: "REQUEST_CANARY" },
    request("get-task-context", { ...task, maxTokens: 8193 }),
    request("get-task-context", { ...task, task: "a".repeat(1025) }),
    request("get-task-context", {
      ...task,
      requestedCapabilities: Array.from({ length: 33 }, (_, index) => `language.x${index}`),
    }),
  ]) {
    const result = await provider.invoke(value);
    assert.equal(result.outcome, "error");
    assert.ok(isProfileProviderResponse(result));
    assert.doesNotMatch(JSON.stringify(result), /CANARY|subjectRef/u);
  }
  assert.equal(
    (await provider.invoke({ ...request("get-provider-capabilities"), schemaVersion: "1.0.0" }))
      .error?.category,
    "unsupported-version",
  );
  assert.equal(
    (
      await provider.invoke(
        request("get-capability-evidence", { capability: "language.typescript" }),
      )
    ).error?.category,
    "unsupported-operation",
  );
  assert.equal(
    (await provider.invoke(request("get-task-context", { ...task, maxTokens: 1 }))).error?.category,
    "budget-too-small",
  );
});

test("stored provider honors source scope and availability while null metadata uses explicit capabilities", async (context) => {
  const fixture = await ownerFixture(context);
  const snapshot = refreshValue(
    await refreshLocalRepositories(fixture.session, refreshRequest("2026-09-07T12:00:02Z")),
  );
  const source = snapshot.filesystemSnapshots[0];
  assert.ok(source);
  const repositoryId = source.repositories[0]?.repositoryId;
  assert.ok(repositoryId);
  const provider = providerFor(fixture, { repositoryId, source: () => source });
  assert.ok(
    packet(
      await provider.invoke(request("get-task-context", { ...task, requestedCapabilities: [] })),
    ).claims.length > 0,
  );
  const missing = providerFor(fixture, { source: () => source, repositoryId: "repo_missing" });
  assert.equal(
    (await missing.invoke(request("get-task-context", task))).error?.category,
    "profile-unavailable",
  );
  const forged = providerFor(fixture, { source: () => ({ ...source }) });
  assert.equal((await forged.invoke(request("get-task-context", task))).outcome, "error");
  const explicit = providerFor(fixture);
  assert.equal(
    packet(
      await explicit.invoke(
        request("get-task-context", { ...task, requestedCapabilities: ["language.unknown"] }),
      ),
    ).claims.length,
    0,
  );
  let available = false;
  const gated = providerFor(fixture, { available: () => available });
  assert.equal((await gated.invoke(request("get-profile-metadata"))).outcome, "error");
  available = true;
  assert.equal((await gated.invoke(request("get-profile-metadata"))).outcome, "success");
});

test("stored provider rejects future profile records and invalid construction without native details", async (context) => {
  const fixture = await ownerFixture(context);
  const provider = providerFor(fixture);
  const candidate = {
    ...fixture.initial,
    internalState: { ...fixture.initial.internalState, generation: 1 },
    profile: {
      ...fixture.initial.profile,
      claims: fixture.initial.profile.claims.map((claim) => ({
        ...claim,
        freshness: { ...claim.freshness, observedThrough: "2026-09-08T00:00:00Z" },
      })),
    },
  };
  assert.ok(
    (
      await writeLocalProfileStore(fixture.configuration, JSON.stringify(candidate), {
        expectedGeneration: 0,
      })
    ).ok,
  );
  assert.equal(
    (await provider.invoke(request("get-profile-metadata"))).error?.category,
    "profile-unavailable",
  );
  for (const maxObservationAgeMs of [-1, 86400001, NaN])
    assert.throws(
      () => providerFor(fixture, { maxObservationAgeMs }),
      /Invalid local provider configuration/u,
    );
  assert.throws(
    () => createLocalStoredProfileProvider({ ...fixture.configuration }, /** @type {never} */ ({})),
    /Invalid local provider configuration/u,
  );
});

test("MCP awaits asynchronous stored responses and catches asynchronous provider failures", async (context) => {
  const fixture = await ownerFixture(context);
  for (const provider of [
    providerFor(fixture),
    {
      capabilities: providerFor(fixture).capabilities,
      async invoke() {
        throw new Error("PROVIDER_CANARY");
      },
    },
  ]) {
    const input = Readable.from([
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "test", version: "1" },
        },
      }) + "\n",
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n",
      JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "get_profile_metadata", arguments: {} },
      }) + "\n",
    ]);
    let text = "";
    const output = new Writable({
      write(chunk, _encoding, callback) {
        text += String(chunk);
        callback();
      },
    });
    await serveMcpStdio(provider, input, output);
    const response = JSON.parse(text.trim().split("\n")[1] ?? "{}");
    assert.ok(
      response.result?.structuredContent?.outcome === "success" || response.error?.code === -32603,
    );
    assert.doesNotMatch(text, /CANARY/u);
  }
});

test("stored provider owns no source collection, persistence, network or subprocess authority", async () => {
  const source = await readFile(
    new URL(
      "../../packages/community-provider/src/local-stored-profile-provider.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /node:(?:fs|http|net|child_process)|writeLocalProfileStore|collectFilesystem|collectGit|refreshLocalRepositories|fetch\(|console\./u,
  );
});
