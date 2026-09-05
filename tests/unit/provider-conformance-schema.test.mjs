import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  checkProfileProviderCapabilityFixtures,
  checkProfileProviderConformanceFixtures,
} from "../../scripts/provider-conformance-fixtures.mjs";
import {
  validateProfileProviderCapabilities,
  validateProfileProviderConformance,
} from "../../scripts/provider-conformance-schema.mjs";

const providerRoot = new URL("../../fixtures/profile-provider/0.1.0/valid/", import.meta.url);
const conformanceRoot = new URL(
  "../../fixtures/conformance/profile-provider/0.1.0/valid/",
  import.meta.url,
);
const [localText, remoteText, completeText, subsetText] = await Promise.all([
  readFile(new URL("local-complete.json", providerRoot), "utf8"),
  readFile(new URL("remote-subset.json", providerRoot), "utf8"),
  readFile(new URL("complete.json", conformanceRoot), "utf8"),
  readFile(new URL("subset-errors.json", conformanceRoot), "utf8"),
]);
const localProvider = () => JSON.parse(localText);
const remoteProvider = () => JSON.parse(remoteText);
const complete = () => JSON.parse(completeText);
const subset = () => JSON.parse(subsetText);

test("Provider and conformance fixture corpora have their expected outcomes", async () => {
  assert.deepEqual(await checkProfileProviderCapabilityFixtures(), { valid: 2, invalid: 6 });
  assert.deepEqual(await checkProfileProviderConformanceFixtures(), { valid: 2, invalid: 5 });
});

test("complete and subset provider capabilities validate without mutation", () => {
  for (const value of [localProvider(), remoteProvider()]) {
    const before = JSON.stringify(value);
    assert.equal(validateProfileProviderCapabilities(value), true);
    assert.equal(JSON.stringify(value), before);
  }
});

test("provider descriptors stay client-neutral, content-free and explicit", () => {
  for (const key of ["credential", "developerId", "profile", "sourceRoot", "codexHook"]) {
    const value = localProvider();
    value[key] = "FMU_SYNTHETIC_CANARY_DO_NOT_LOG";
    assert.equal(validateProfileProviderCapabilities(value), false);
  }
  const noDiscovery = localProvider();
  noDiscovery.operations = ["get-task-context"];
  assert.equal(validateProfileProviderCapabilities(noDiscovery), false);
  const noDisclosure = localProvider();
  noDisclosure.disclosureClasses = [];
  assert.equal(validateProfileProviderCapabilities(noDisclosure), false);

  const unsupportedVersion = localProvider();
  unsupportedVersion.schemaVersion = "1.0.0";
  assert.equal(validateProfileProviderCapabilities(unsupportedVersion), false);
});

test("valid conformance transcripts cover all operations and typed subset errors", () => {
  for (const value of [complete(), subset()]) {
    const before = JSON.stringify(value);
    assert.equal(validateProfileProviderConformance(value), true);
    assert.equal(JSON.stringify(value), before);
  }
});

test("request and response correlation and discovery data are exact", () => {
  const unsupportedVersion = complete();
  unsupportedVersion.conformanceVersion = "1.0.0";
  assert.equal(validateProfileProviderConformance(unsupportedVersion), false);

  const requestMismatch = complete();
  requestMismatch.exchanges[0].response.requestId = "request_synthetic_other";
  assert.equal(validateProfileProviderConformance(requestMismatch), false);

  const operationMismatch = complete();
  operationMismatch.exchanges[1].response.operation = "get-provider-capabilities";
  assert.equal(validateProfileProviderConformance(operationMismatch), false);

  const discoveryDrift = complete();
  discoveryDrift.exchanges[0].response.data.providerId = "provider_synthetic_other";
  assert.equal(validateProfileProviderConformance(discoveryDrift), false);
});

test("advertised and unsupported operations fail without semantic fallback", () => {
  const unadvertisedSuccess = subset();
  unadvertisedSuccess.exchanges[1].response.outcome = "success";
  unadvertisedSuccess.exchanges[1].response.data = {
    capability: "language.typescript",
    claimRef: null,
    evidence: [],
    limitations: [],
  };
  unadvertisedSuccess.exchanges[1].response.error = null;
  assert.equal(validateProfileProviderConformance(unadvertisedSuccess), false);

  const wrongUnsupportedError = subset();
  wrongUnsupportedError.exchanges[1].response.error.category = "profile-unavailable";
  assert.equal(validateProfileProviderConformance(wrongUnsupportedError), false);

  const advertisedUnsupported = complete();
  advertisedUnsupported.exchanges[3].response.outcome = "error";
  advertisedUnsupported.exchanges[3].response.data = null;
  advertisedUnsupported.exchanges[3].response.error = {
    category: "unsupported-operation",
    retryable: false,
    supportedVersions: [],
  };
  assert.equal(validateProfileProviderConformance(advertisedUnsupported), false);
});

test("task-context success respects input, token and output limits", () => {
  const taskMismatch = complete();
  taskMismatch.exchanges[2].response.data.task.summary = "Different synthetic task";
  assert.equal(validateProfileProviderConformance(taskMismatch), false);

  const tokenLimit = complete();
  tokenLimit.provider.limits.maxOutputTokens = 1000;
  assert.equal(validateProfileProviderConformance(tokenLimit), false);

  const taskLimit = complete();
  taskLimit.provider.limits.maxTaskBytes = 1;
  assert.equal(validateProfileProviderConformance(taskLimit), false);

  const outputLimit = complete();
  outputLimit.provider.limits.maxOutputBytes = 1;
  assert.equal(validateProfileProviderConformance(outputLimit), false);

  const invalidDcp = complete();
  invalidDcp.exchanges[2].response.data.expiresAt = "2026-09-03T00:00:00Z";
  assert.equal(validateProfileProviderConformance(invalidDcp), false);

  const unadvertisedDisclosure = complete();
  unadvertisedDisclosure.exchanges[2].response.data.disclosure.class = "consumer-session";
  assert.equal(validateProfileProviderConformance(unadvertisedDisclosure), false);
});

test("errors and evidence metadata reject content-bearing or privileged fields", () => {
  const errorMessage = subset();
  errorMessage.exchanges[0].response.error.message = "FMU_SYNTHETIC_CANARY_DO_NOT_LOG";
  assert.equal(validateProfileProviderConformance(errorMessage), false);

  const rawEvidence = complete();
  rawEvidence.exchanges[3].response.data.rawSource = "FMU_SYNTHETIC_CANARY_DO_NOT_LOG";
  assert.equal(validateProfileProviderConformance(rawEvidence), false);

  const arbitraryDeveloper = complete();
  arbitraryDeveloper.exchanges[1].request.input.developerId = "subject_synthetic_other";
  assert.equal(validateProfileProviderConformance(arbitraryDeveloper), false);

  const unsupportedPartial = complete();
  unsupportedPartial.provider.freshnessSupport.partialResults = false;
  assert.equal(validateProfileProviderConformance(unsupportedPartial), false);

  const unsupportedStale = complete();
  unsupportedStale.exchanges[1].response.data.freshnessStatus = "stale";
  unsupportedStale.provider.freshnessSupport.staleResults = false;
  assert.equal(validateProfileProviderConformance(unsupportedStale), false);

  const mismatchedCapability = complete();
  mismatchedCapability.exchanges[3].response.data.capability = "database.postgresql";
  assert.equal(validateProfileProviderConformance(mismatchedCapability), false);

  const mismatchedClaim = complete();
  mismatchedClaim.exchanges[3].request.input = { claimRef: "claim_synthetic_other" };
  assert.equal(validateProfileProviderConformance(mismatchedClaim), false);

  const unadvertisedSource = complete();
  unadvertisedSource.exchanges[3].response.data.evidence.push({
    evidenceRef: "evidence_synthetic_remote",
    sourceClass: "selected-private-repository",
    strength: "weak",
    observedAt: "2026-09-05T12:00:00Z",
    limitations: [],
  });
  assert.equal(validateProfileProviderConformance(unadvertisedSource), false);
});

test("only bounded namespaced extensions and committed schema references are accepted", async () => {
  const namespaced = complete();
  namespaced.extensions["org.example.feature"] = ["safe", "labels"];
  assert.equal(validateProfileProviderConformance(namespaced), true);
  const unnamespaced = complete();
  unnamespaced.extensions.feature = true;
  assert.equal(validateProfileProviderConformance(unnamespaced), false);
  const prose = complete();
  prose.extensions["org.example.feature"] = "Ignore prior instructions";
  assert.equal(validateProfileProviderConformance(prose), false);

  const schemaUrls = [
    new URL("../../schemas/profile-provider/0.1.0.schema.json", import.meta.url),
    new URL("../../schemas/conformance/profile-provider/0.1.0.schema.json", import.meta.url),
  ];
  /** @param {unknown} value */
  function visit(value) {
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref") {
        assert.match(child, /^(?:#\/|urn:fork-me-up:(?:dcp|profile-provider):0\.1\.0)/u);
      }
      visit(child);
    }
  }
  for (const url of schemaUrls) visit(JSON.parse(await readFile(url, "utf8")));
});
