import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createProtocolCandidateManifest,
  expectedProtocolArtifactFiles,
  publicProtocolAssetFiles,
} from "../../scripts/protocol-package-candidate.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

/** @param {string} root @param {string} [relativePath] */
async function listJsonFiles(root, relativePath = "") {
  const directory = relativePath === "" ? root : path.join(root, ...relativePath.split("/"));
  const entries = await readdir(directory, { withFileTypes: true });
  /** @type {string[]} */
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    /** @type {string} */
    const candidate = relativePath === "" ? entry.name : `${relativePath}/${entry.name}`;
    assert.equal(entry.isSymbolicLink(), false, `unexpected symlink: ${candidate}`);
    if (entry.isDirectory()) {
      files.push(...(await listJsonFiles(root, candidate)));
    } else {
      assert.equal(entry.isFile(), true, `unexpected filesystem entry: ${candidate}`);
      if (entry.name.endsWith(".json")) {
        files.push(candidate);
      }
    }
  }
  return files;
}

test("the Protocol candidate exposes exact typed SDK and public asset subpaths", () => {
  const manifest = createProtocolCandidateManifest();
  assert.equal(manifest.private, true);
  assert.equal(manifest.version, "0.0.0");
  assert.deepEqual(manifest.exports["."], {
    types: "./dist/index.d.ts",
    import: "./dist/index.js",
  });
  assert.deepEqual(manifest.exports["./conformance/profile-provider"], {
    types: "./dist/provider-conformance.d.ts",
    import: "./dist/provider-conformance.js",
  });
  assert.equal(
    manifest.exports["./schemas/conformance/profile-provider/0.1.0"],
    "./dist/schemas/conformance/profile-provider/0.1.0.schema.json",
  );
  for (const asset of publicProtocolAssetFiles) {
    if (asset.startsWith("fixtures/") && asset.endsWith(".json")) {
      assert.equal(manifest.exports[`./${asset}`], `./dist/${asset}`);
    }
  }
  assert.equal(Object.hasOwn(manifest, "scripts"), false);
  assert.equal(Object.hasOwn(manifest, "publishConfig"), false);
});

test("the public asset allowlist excludes private Store and fixture-carrier data", () => {
  assert.equal(new Set(publicProtocolAssetFiles).size, publicProtocolAssetFiles.length);
  assert.ok(publicProtocolAssetFiles.every((file) => !file.includes("\\")));
  assert.ok(publicProtocolAssetFiles.every((file) => !file.includes("/internal/")));
  assert.ok(publicProtocolAssetFiles.every((file) => !file.includes("/developer-profile/")));
  assert.ok(
    publicProtocolAssetFiles.every(
      (file) =>
        /^schemas\/(?:[a-z0-9-]+\/)*(?:0\.1\.0)\.schema\.json$/u.test(file) ||
        /^fixtures\/(?:[a-z0-9-]+\/)*(?:0\.1\.0)\/(?:valid|invalid)\/[a-z0-9-]+\.json$/u.test(file),
    ),
  );
  assert.deepEqual(
    expectedProtocolArtifactFiles(),
    [...new Set(expectedProtocolArtifactFiles())].sort((left, right) =>
      left.localeCompare(right, "en"),
    ),
  );
});

test("the public asset allowlist exactly matches the repository inventory", async () => {
  const schemaFiles = (await listJsonFiles(path.join(repositoryRoot, "schemas")))
    .filter((file) => !file.startsWith("internal/"))
    .map((file) => `schemas/${file}`);
  const fixtureFiles = (await listJsonFiles(path.join(repositoryRoot, "fixtures")))
    .filter((file) => !file.startsWith("internal/") && !file.startsWith("developer-profile/"))
    .map((file) => `fixtures/${file}`);
  const inventory = [...schemaFiles, ...fixtureFiles].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  assert.deepEqual(
    [...publicProtocolAssetFiles].sort((left, right) => left.localeCompare(right, "en")),
    inventory,
  );
});
