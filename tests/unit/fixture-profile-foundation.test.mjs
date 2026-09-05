import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadDeveloperProfileFromPortableExport } from "../../packages/core/src/index.ts";
import { isPortableProfileExport } from "../../packages/protocol/src/index.ts";

const fixtureRoot = new URL("../../fixtures/developer-profile/0.1.0/", import.meta.url);
const fixtureNames = ["demonstrated.json", "adjacent.json", "insufficient-evidence.json"];

/** @param {URL} url */
async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

test("versioned synthetic profile carriers validate and load", async () => {
  const states = [];

  for (const name of fixtureNames) {
    const source = await readJson(new URL(name, fixtureRoot));
    assert.equal(isPortableProfileExport(source), true);
    const result = loadDeveloperProfileFromPortableExport(source);
    assert.equal(result.ok, true);
    const claim = result.value.profile.claims.at(0);
    assert.ok(claim);
    states.push(claim.state);
    assert.equal(result.value.profileVersion, source.profileVersion);
    assert.equal("subjectRef" in result.value, false);
    assert.equal("exportId" in result.value, false);
    assert.equal("generatedAt" in result.value, false);
    assert.equal("exclusions" in result.value, false);
  }

  assert.deepEqual(states, ["demonstrated", "adjacent", "insufficient-evidence"]);
});

test("invalid and cross-boundary envelopes fail with one content-free error", async () => {
  const [dcp, store] = await Promise.all([
    readJson(new URL("../../fixtures/dcp/0.1.0/valid/minimal.json", import.meta.url)),
    readJson(
      new URL(
        "../../fixtures/internal/community-profile-store/0.1.0/valid/empty.json",
        import.meta.url,
      ),
    ),
  ]);

  for (const source of [null, {}, dcp, store]) {
    assert.deepEqual(loadDeveloperProfileFromPortableExport(source), {
      ok: false,
      error: { category: "invalid-input" },
    });
  }
});

test("validation includes reference integrity and evidence timestamp ordering", async () => {
  const duplicateClaim = await readJson(new URL("demonstrated.json", fixtureRoot));
  duplicateClaim.profile.claims.push({ ...duplicateClaim.profile.claims[0] });
  assert.equal(isPortableProfileExport(duplicateClaim), false);

  const danglingEvidence = await readJson(new URL("demonstrated.json", fixtureRoot));
  danglingEvidence.profile.claims[0].basis.evidenceRefs = ["evidence_missing"];
  assert.equal(isPortableProfileExport(danglingEvidence), false);

  const invalidOrder = await readJson(new URL("demonstrated.json", fixtureRoot));
  invalidOrder.profile.evidence[0].freshness.collectedAt = "2026-08-31T00:00:00Z";
  assert.equal(isPortableProfileExport(invalidOrder), false);

  const unknownField = await readJson(new URL("demonstrated.json", fixtureRoot));
  unknownField.profile.instructions = "FMU_SYNTHETIC_CANARY_DO_NOT_FOLLOW";
  assert.equal(isPortableProfileExport(unknownField), false);
});

test("the Core result is detached, deeply immutable and deterministic", async () => {
  const source = await readJson(new URL("demonstrated.json", fixtureRoot));
  const first = loadDeveloperProfileFromPortableExport(source);
  const second = loadDeveloperProfileFromPortableExport(source);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first, second);
  assert.notEqual(first.value.profile, second.value.profile);

  source.profile.claims[0].state = "insufficient-evidence";
  const firstClaim = first.value.profile.claims.at(0);
  assert.ok(firstClaim);
  assert.equal(firstClaim.state, "demonstrated");
  assert.equal(Object.isFrozen(first.value.profile), true);
  assert.equal(Object.isFrozen(first.value.profile.claims), true);
  assert.equal(Object.isFrozen(firstClaim.basis), true);
  assert.throws(
    () => Reflect.apply(Array.prototype.push, first.value.profile.claims, [{}]),
    TypeError,
  );
});

test("workspace manifests enforce the client-neutral dependency direction", async () => {
  const [protocolManifest, coreManifest, lockfile, protocolSource, coreSource] = await Promise.all([
    readJson(new URL("../../packages/protocol/package.json", import.meta.url)),
    readJson(new URL("../../packages/core/package.json", import.meta.url)),
    readJson(new URL("../../package-lock.json", import.meta.url)),
    readFile(new URL("../../packages/protocol/src/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../../packages/core/src/index.ts", import.meta.url), "utf8"),
  ]);

  assert.deepEqual(protocolManifest.dependencies, { ajv: "8.20.0" });
  assert.deepEqual(coreManifest.dependencies, { "@fork-me-up/protocol": "0.0.0" });
  assert.equal(protocolManifest.private, true);
  assert.equal(coreManifest.private, true);
  assert.equal(protocolManifest.license, "Apache-2.0");
  assert.equal(coreManifest.license, "Apache-2.0");
  assert.equal(lockfile.packages["packages/protocol"].name, "@fork-me-up/protocol");
  assert.equal(lockfile.packages["packages/core"].name, "@fork-me-up/core");
  assert.doesNotMatch(protocolSource, /@fork-me-up\/core|codex|openai|mcp/iu);
  assert.match(coreSource, /from "@fork-me-up\/protocol"/u);
  assert.doesNotMatch(coreSource, /codex|openai|mcp/iu);
});
