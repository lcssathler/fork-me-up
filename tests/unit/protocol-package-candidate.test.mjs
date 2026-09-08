import assert from "node:assert/strict";
import test from "node:test";
import {
  createProtocolCandidateManifest,
  expectedProtocolArtifactFiles,
  publicProtocolAssetFiles,
} from "../../scripts/protocol-package-candidate.mjs";

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
        /^fixtures\/(?:[a-z0-9-]+\/)*(?:0\.1\.0)\/(?:README\.md|(?:valid|invalid)\/[a-z0-9-]+\.json)$/u.test(
          file,
        ),
    ),
  );
  assert.deepEqual(
    expectedProtocolArtifactFiles(),
    [...new Set(expectedProtocolArtifactFiles())].sort((left, right) =>
      left.localeCompare(right, "en"),
    ),
  );
});
