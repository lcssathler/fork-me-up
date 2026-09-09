import assert from "node:assert/strict";
import test from "node:test";
import {
  communityPackageDefinitions,
  createCandidateManifest,
  expectedArtifactFiles,
  validatePackResult,
} from "../../scripts/community-package-dry-run.mjs";

test("the Community package boundary contains only the three client-neutral libraries", () => {
  assert.deepEqual(
    communityPackageDefinitions.map(({ name, workspace }) => ({ name, workspace })),
    [
      { name: "@fork-me-up/protocol", workspace: "packages/protocol" },
      { name: "@fork-me-up/core", workspace: "packages/core" },
      {
        name: "@fork-me-up/community-provider",
        workspace: "packages/community-provider",
      },
    ],
  );
  assert.ok(communityPackageDefinitions.every(({ sources }) => sources.includes("src/index.ts")));
  assert.ok(
    communityPackageDefinitions
      .flatMap(({ sources }) => sources)
      .every((source) => /^src\/[a-z0-9-]+\.ts$/u.test(source)),
  );
});

test("candidate manifests stay private and expose only compiled entry points", () => {
  for (const definition of communityPackageDefinitions) {
    const manifest = createCandidateManifest(definition);
    assert.equal(manifest.private, true);
    assert.equal(manifest.version, "0.0.0");
    assert.equal(manifest.license, "Apache-2.0");
    assert.deepEqual(manifest.files, ["dist/"]);
    assert.deepEqual(manifest.exports, {
      ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
    });
    assert.equal(Object.hasOwn(manifest, "scripts"), false);
    assert.equal(Object.hasOwn(manifest, "publishConfig"), false);
  }
});

test("lifecycle candidate versions apply to the complete internal package graph", () => {
  const version = "0.0.0-m3s05.0";
  const manifests = Object.fromEntries(
    communityPackageDefinitions.map((definition) => [
      definition.name,
      createCandidateManifest(definition, version),
    ]),
  );
  const protocol = manifests["@fork-me-up/protocol"];
  const core = manifests["@fork-me-up/core"];
  const provider = manifests["@fork-me-up/community-provider"];
  assert.ok(protocol);
  assert.ok(core);
  assert.ok(provider);
  assert.equal(protocol.dependencies["ajv"], "8.20.0");
  assert.deepEqual(core.dependencies, {
    "@fork-me-up/protocol": version,
  });
  assert.deepEqual(provider.dependencies, {
    "@fork-me-up/core": version,
    "@fork-me-up/protocol": version,
  });
});

test("pack inspection accepts only the exact package-relative artifact allowlist", () => {
  const definition = communityPackageDefinitions[1];
  assert.ok(definition);
  const files = expectedArtifactFiles(definition).map((path) => ({ path, size: 1, mode: 420 }));
  const valid = [
    {
      id: `${definition.name}@0.0.0`,
      name: definition.name,
      version: "0.0.0",
      size: 100,
      unpackedSize: 200,
      shasum: "synthetic",
      integrity: "sha512-synthetic",
      filename: `${definition.slug}-0.0.0.tgz`,
      files,
      bundled: [],
    },
  ];
  assert.equal(validatePackResult(definition, valid).releaseState, "private-unpublished");
  assert.throws(
    () =>
      validatePackResult(definition, [
        { ...valid[0], files: [...files, { path: "tsconfig.json", size: 1, mode: 420 }] },
      ]),
    /pack-allowlist/u,
  );
  assert.throws(
    () =>
      validatePackResult(definition, [
        { ...valid[0], files: [{ path: "C:\\private\\file", size: 1, mode: 420 }] },
      ]),
    /pack-file/u,
  );
});
