import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createLocalFixtureProfileProvider } from "@fork-me-up/community-provider";
import {
  isDeveloperContextPacket,
  isProfileProviderCapabilities,
  isProfileProviderResponse,
} from "@fork-me-up/protocol";
import { validateProfileProviderConformance } from "../../scripts/provider-conformance-schema.mjs";

const profileText = await readFile(
  new URL("../../fixtures/developer-profile/0.1.0/adjacent.json", import.meta.url),
  "utf8",
);

function createProvider(profile = JSON.parse(profileText)) {
  let sequence = 0;
  return createLocalFixtureProfileProvider({
    profile,
    clock: () => new Date("2026-09-05T12:34:56.789Z"),
    createId: (kind) => `${kind}_unit_${String(++sequence)}`,
  });
}

/**
 * @param {import("@fork-me-up/protocol").ProfileProviderOperation} operation
 * @param {unknown} input
 * @param {Record<string, unknown>} [overrides]
 */
function request(operation, input, overrides = {}) {
  return {
    schemaVersion: "0.1.0",
    kind: "profile-provider-request",
    requestId: "request_unit",
    operation,
    input,
    ...overrides,
  };
}

test("the local provider advertises a client-neutral bounded read subset", () => {
  const provider = createProvider();
  const response = provider.invoke(request("get-provider-capabilities", {}));

  assert.equal(isProfileProviderCapabilities(provider.capabilities), true);
  assert.equal(isProfileProviderResponse(response), true);
  assert.deepEqual(response.data, provider.capabilities);
  assert.deepEqual(provider.capabilities.operations, [
    "get-provider-capabilities",
    "get-profile-metadata",
    "get-task-context",
  ]);
  assert.equal(provider.capabilities.deployment, "local");
  assert.deepEqual(provider.capabilities.disclosureClasses, ["task-context"]);
  assert.equal(Object.isFrozen(provider.capabilities), true);
  assert.doesNotMatch(JSON.stringify(provider.capabilities), /profile_fixture|subject_fixture/u);
});

test("new workspaces preserve the accepted dependency direction without external additions", async () => {
  const [providerManifest, applicationManifest, lockfile] = await Promise.all(
    [
      "../../packages/community-provider/package.json",
      "../../apps/mcp-local/package.json",
      "../../package-lock.json",
    ].map(async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"))),
  );

  assert.deepEqual(providerManifest.dependencies, {
    "@fork-me-up/core": "0.0.0",
    "@fork-me-up/protocol": "0.0.0",
  });
  assert.deepEqual(applicationManifest.dependencies, {
    "@fork-me-up/community-provider": "0.0.0",
  });
  assert.equal(lockfile.packages["node_modules/@fork-me-up/community-provider"].link, true);
  assert.equal(lockfile.packages["node_modules/@fork-me-up/mcp-local"].link, true);
});

test("unadvertised optional operations return unsupported without semantic fallback", () => {
  const response = createProvider().invoke(
    request("get-capability-evidence", { capability: "framework.react" }),
  );

  assert.equal(response.outcome, "error");
  assert.ok(response.error !== null);
  assert.equal(response.error.category, "unsupported-operation");
  assert.equal(response.data, null);
});

test("runtime exchanges satisfy the public provider conformance contract", () => {
  const provider = createProvider();
  const requests = [
    request("get-provider-capabilities", {}),
    request("get-profile-metadata", {}),
    request("get-task-context", {
      task: "Implement a synthetic React component",
      purpose: "coding-assistance",
      maxTokens: 8192,
      requestedCapabilities: ["framework.react"],
    }),
    request("get-capability-evidence", { capability: "framework.react" }),
  ];
  const transcript = {
    conformanceVersion: "0.1.0",
    kind: "profile-provider-conformance",
    provider: provider.capabilities,
    exchanges: requests.map((providerRequest) => ({
      request: providerRequest,
      response: provider.invoke(providerRequest),
    })),
  };

  assert.equal(validateProfileProviderConformance(transcript), true);
});

test("metadata is bounded and contains no complete profile or claims", () => {
  const response = createProvider().invoke(request("get-profile-metadata", {}));

  assert.equal(isProfileProviderResponse(response), true);
  assert.equal(response.outcome, "success");
  assert.deepEqual(response.data, {
    profileVersion: "profile_fixture_angular_react_adjacent",
    freshnessStatus: "fresh",
    observedThrough: "2026-09-01T00:00:00Z",
    claimCount: 2,
    evidenceCount: 1,
  });
  assert.doesNotMatch(JSON.stringify(response), /claim_fixture|src\/app/u);
});

test("task context is deterministic under injected time and identifiers", () => {
  const input = {
    task: "Implement a synthetic React component",
    purpose: "coding-assistance",
    maxTokens: 8192,
    requestedCapabilities: ["framework.react"],
  };
  const first = createProvider().invoke(request("get-task-context", input));
  const second = createProvider().invoke(request("get-task-context", input));

  assert.deepEqual(first, second);
  assert.equal(first.outcome, "success");
  assert.equal(isDeveloperContextPacket(first.data), true);
  assert.equal(isProfileProviderResponse(first), true);
  const packet = /** @type {import("@fork-me-up/protocol").DeveloperContextPacket} */ (first.data);
  assert.deepEqual(packet.task.requiredCapabilities, ["framework.react"]);
  assert.deepEqual(
    packet.claims.map((claim) => claim.capability),
    ["framework.react"],
  );
  assert.equal(packet.generatedAt, "2026-09-05T12:34:56Z");
  assert.equal(packet.expiresAt, "2026-09-05T13:34:56Z");
  assert.equal(Object.isFrozen(first), true);
});

test("invalid, incompatible, unavailable and budget-limited states are content-free", () => {
  const canary = "FMU_PROVIDER_CANARY_DO_NOT_LOG";
  const provider = createProvider();
  const invalid = provider.invoke(
    request("get-task-context", {
      task: canary,
      purpose: "coding-assistance",
      maxTokens: 8192,
      requestedCapabilities: [],
      developerId: canary,
    }),
  );
  const missingVersion = provider.invoke({
    kind: "profile-provider-request",
    requestId: "request_unit",
    operation: "get-profile-metadata",
    input: {},
  });
  const incompatible = provider.invoke(request("get-task-context", {}, { schemaVersion: "1.0.0" }));
  const unavailable = createProvider(null).invoke(request("get-profile-metadata", {}));
  const unavailableInvalid = createProvider(null).invoke(
    request("get-task-context", {
      task: "Synthetic task",
      purpose: "coding-assistance",
      maxTokens: 8193,
      requestedCapabilities: [],
    }),
  );
  const budgetLimited = provider.invoke(
    request("get-task-context", {
      task: "Synthetic task",
      purpose: "coding-assistance",
      maxTokens: 1,
      requestedCapabilities: [],
    }),
  );

  for (const response of [
    invalid,
    missingVersion,
    incompatible,
    unavailable,
    unavailableInvalid,
    budgetLimited,
  ]) {
    assert.equal(isProfileProviderResponse(response), true);
    assert.equal(response.outcome, "error");
    assert.equal(response.data, null);
    assert.doesNotMatch(JSON.stringify(response), /CANARY|developerId|Synthetic task/u);
  }
  assert.ok(invalid.error !== null);
  assert.ok(missingVersion.error !== null);
  assert.ok(incompatible.error !== null);
  assert.ok(unavailable.error !== null);
  assert.ok(unavailableInvalid.error !== null);
  assert.ok(budgetLimited.error !== null);
  assert.equal(invalid.error.category, "invalid-input");
  assert.equal(missingVersion.error.category, "invalid-input");
  assert.deepEqual(incompatible.error, {
    category: "unsupported-version",
    retryable: false,
    supportedVersions: ["0.1.0"],
  });
  assert.equal(unavailable.error.category, "profile-unavailable");
  assert.equal(unavailableInvalid.error.category, "invalid-input");
  assert.equal(budgetLimited.error.category, "budget-too-small");
});

test("invalid fixture data fails closed without reflecting its content", () => {
  const fixture = JSON.parse(profileText);
  fixture.profile.claims[0].capability = "FMU_FIXTURE_CANARY";

  assert.throws(
    () => createProvider(fixture),
    (error) => error instanceof TypeError && error.message === "Invalid fixture profile.",
  );
});
