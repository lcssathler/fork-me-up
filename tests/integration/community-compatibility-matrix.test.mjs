import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

test("released-artifact candidates pass the bounded Community compatibility matrix", () => {
  const npmCli = process.env["npm_execpath"];
  assert.ok(npmCli);
  const result = spawnSync(process.execPath, [npmCli, "run", "--silent", "compatibility:check"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: false,
    timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const reportText = readFileSync(
    path.join(repositoryRoot, "build", "community-compatibility", "manifest.json"),
    "utf8",
  );
  const report =
    /** @type {{
     * kind: string,
     * releaseState: string,
     * packages: string[],
     * cases: Array<{boundary: string, behavior: string, outcome: string}>
     * }} */ (JSON.parse(reportText));
  assert.equal(report.kind, "community-artifact-compatibility-matrix");
  assert.equal(report.releaseState, "local-installable-private-unpublished");
  assert.deepEqual(report.packages, [
    "@fork-me-up/protocol@0.0.0",
    "@fork-me-up/core@0.0.0",
    "@fork-me-up/community-provider@0.0.0",
  ]);
  assert.deepEqual(
    report.cases.map((entry) => [entry.boundary, entry.behavior, entry.outcome]),
    [
      ["provider", "supported-and-unsupported-operations", "pass"],
      ["dcp", "supported-version-and-unsupported-version-rejection", "pass"],
      ["export", "owner-export-import-round-trip", "pass"],
      ["store", "private-envelope-and-update-conflict", "pass"],
      ["store", "explicit-legacy-migration", "pass"],
      ["store", "newest-invalid-generation-recovery", "pass"],
      ["boundaries", "store-export-dcp-non-conflation", "pass"],
    ],
  );
  assert.doesNotMatch(reportText, /(?:[A-Za-z]:[\\/]|\\Users\\|\/Users\/|\/home\/|CANARY)/u);

  const packageReport =
    /** @type {{kind: string, packages: Array<{id: string, private: boolean, releaseState: string, filename: string}>}} */ (
      JSON.parse(
        readFileSync(
          path.join(repositoryRoot, "build", "community-package", "manifest.json"),
          "utf8",
        ),
      )
    );
  assert.equal(packageReport.kind, "community-package-candidate");
  assert.deepEqual(
    packageReport.packages.map((candidate) => [
      candidate.id,
      candidate.private,
      candidate.releaseState,
      candidate.filename,
    ]),
    [
      [
        "@fork-me-up/protocol@0.0.0",
        true,
        "local-installable-private-unpublished",
        "fork-me-up-protocol-0.0.0.tgz",
      ],
      [
        "@fork-me-up/core@0.0.0",
        true,
        "local-installable-private-unpublished",
        "fork-me-up-core-0.0.0.tgz",
      ],
      [
        "@fork-me-up/community-provider@0.0.0",
        true,
        "local-installable-private-unpublished",
        "fork-me-up-community-provider-0.0.0.tgz",
      ],
    ],
  );
});
