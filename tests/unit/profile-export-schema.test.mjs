import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  checkCommunityProfileStoreFixtures,
  checkPortableProfileExportFixtures,
} from "../../scripts/profile-export-fixtures.mjs";
import {
  validateCommunityProfileStore,
  validatePortableProfileExport,
} from "../../scripts/profile-export-schema.mjs";
import { validateDcp } from "../../scripts/dcp-schema.mjs";

const exportRoot = new URL("../../fixtures/portable-profile-export/0.1.0/valid/", import.meta.url);
const storeRoot = new URL(
  "../../fixtures/internal/community-profile-store/0.1.0/valid/",
  import.meta.url,
);
const [emptyExportText, completeExportText, emptyStoreText, populatedStoreText, dcpText] =
  await Promise.all([
    readFile(new URL("empty.json", exportRoot), "utf8"),
    readFile(new URL("complete.json", exportRoot), "utf8"),
    readFile(new URL("empty.json", storeRoot), "utf8"),
    readFile(new URL("populated.json", storeRoot), "utf8"),
    readFile(new URL("../../fixtures/dcp/0.1.0/valid/minimal.json", import.meta.url), "utf8"),
  ]);
const emptyExport = () => JSON.parse(emptyExportText);
const completeExport = () => JSON.parse(completeExportText);
const emptyStore = () => JSON.parse(emptyStoreText);
const populatedStore = () => JSON.parse(populatedStoreText);
const dcp = () => JSON.parse(dcpText);

test("the Store and Export fixture corpora have their expected outcomes", async () => {
  assert.deepEqual(await checkCommunityProfileStoreFixtures(), { valid: 2, invalid: 5 });
  assert.deepEqual(await checkPortableProfileExportFixtures(), { valid: 2, invalid: 5 });
});

test("empty and populated profile envelopes validate without mutation", () => {
  for (const [value, validate] of [
    [emptyExport(), validatePortableProfileExport],
    [completeExport(), validatePortableProfileExport],
    [emptyStore(), validateCommunityProfileStore],
    [populatedStore(), validateCommunityProfileStore],
  ]) {
    const before = JSON.stringify(value);
    assert.equal(validate(value), true);
    assert.equal(JSON.stringify(value), before);
  }
});

test("Store, Export and DCP envelopes reject one another", () => {
  assert.equal(validateCommunityProfileStore(emptyExport()), false);
  assert.equal(validateCommunityProfileStore(dcp()), false);
  assert.equal(validatePortableProfileExport(emptyStore()), false);
  assert.equal(validatePortableProfileExport(dcp()), false);
  assert.equal(validateDcp(emptyExport()), false);
  assert.equal(validateDcp(emptyStore()), false);
});

test("Portable Export requires explicit fixed exclusions and rejects sensitive fields", () => {
  for (const key of [
    "credentials",
    "rawSource",
    "sourceGrants",
    "sharingGrants",
    "internalState",
  ]) {
    const missing = emptyExport();
    Reflect.deleteProperty(missing.exclusions, key);
    assert.equal(validatePortableProfileExport(missing), false);
    const falseValue = emptyExport();
    falseValue.exclusions[key] = false;
    assert.equal(validatePortableProfileExport(falseValue), false);
  }
  for (const key of [
    "credentials",
    "rawSource",
    "sourceGrants",
    "sharingGrants",
    "internalState",
  ]) {
    const value = emptyExport();
    value[key] = "FMU_SYNTHETIC_CANARY_DO_NOT_LOG";
    assert.equal(validatePortableProfileExport(value), false);
  }
});

test("profile references must be unique, present and capability-consistent", () => {
  const duplicateEvidence = completeExport();
  duplicateEvidence.profile.evidence.push(duplicateEvidence.profile.evidence[0]);
  assert.equal(validatePortableProfileExport(duplicateEvidence), false);

  const danglingEvidence = completeExport();
  danglingEvidence.profile.claims[0].basis.evidenceRefs = ["evidence_missing"];
  assert.equal(validatePortableProfileExport(danglingEvidence), false);

  const danglingDeclaration = completeExport();
  danglingDeclaration.profile.claims[1].basis.declarationRef = "declaration_missing";
  assert.equal(validatePortableProfileExport(danglingDeclaration), false);

  const mismatchedCorrection = completeExport();
  mismatchedCorrection.profile.corrections[0].capability = "database.postgresql";
  assert.equal(validatePortableProfileExport(mismatchedCorrection), false);
});

test("project-scoped claims resolve to an exported project reference", () => {
  const value = populatedStore();
  value.profile.projectRefs = [];
  assert.equal(validateCommunityProfileStore(value), false);
});

test("nested Evidence semantic checks still apply inside Store and Export", () => {
  const value = completeExport();
  value.profile.evidence[0].freshness.observedAt = "2026-09-03T00:00:00Z";
  value.profile.evidence[0].freshness.collectedAt = "2026-09-02T00:00:00Z";
  assert.equal(validatePortableProfileExport(value), false);
});

test("internal Store timestamps are canonical and monotonically ordered", () => {
  const value = emptyStore();
  value.internalState.updatedAt = "2026-09-05T09:59:59Z";
  assert.equal(validateCommunityProfileStore(value), false);
  const validationBeforeUpdate = emptyStore();
  validationBeforeUpdate.internalState.lastValidatedAt = "2026-09-05T09:59:59Z";
  assert.equal(validateCommunityProfileStore(validationBeforeUpdate), false);
});

test("only committed local URNs or fragments are used as schema references", async () => {
  const schemaUrls = [
    new URL("../../schemas/portable-profile-export/0.1.0.schema.json", import.meta.url),
    new URL("../../schemas/internal/community-profile-store/0.1.0.schema.json", import.meta.url),
  ];
  /** @param {unknown} value */
  function visit(value) {
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref") {
        assert.match(
          child,
          /^(?:#\/|urn:fork-me-up:(?:evidence|claim|portable-profile-export):0\.1\.0)/u,
        );
      }
      visit(child);
    }
  }
  for (const url of schemaUrls) visit(JSON.parse(await readFile(url, "utf8")));
});
