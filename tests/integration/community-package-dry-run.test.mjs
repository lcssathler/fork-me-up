import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { communityPackageDefinitions } from "../../scripts/community-package-dry-run.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

function runDryRun() {
  const npmCli = process.env["npm_execpath"];
  assert.ok(npmCli);
  const result = spawnSync(process.execPath, [npmCli, "run", "--silent", "package:dry-run"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: false,
    timeout: 60_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  return readFileSync(path.join(repositoryRoot, "build", "package-dry-run", "manifest.json"));
}

test("the package dry-run is deterministic and discloses only package-relative allowlisted files", () => {
  const first = runDryRun();
  const second = runDryRun();
  assert.deepEqual(second, first);

  const text = second.toString("utf8");
  const result =
    /** @type {{
     * kind: string,
     * releaseState: string,
     * packages: Array<{
     *   name: string,
     *   version: string,
     *   releaseState: string,
     *   private: boolean,
     *   entrypoints: Record<string, unknown>,
     *   files: Array<{path: string}>
     * }>
     * }} */ (JSON.parse(text));
  assert.equal(result.kind, "community-package-dry-run");
  assert.equal(result.releaseState, "private-unpublished");
  assert.deepEqual(
    result.packages.map((candidate) => candidate.name),
    communityPackageDefinitions.map((candidate) => candidate.name),
  );
  assert.doesNotMatch(text, /(?:[A-Za-z]:[\\/]|\\Users\\|\/Users\/|\/home\/)/u);
  assert.doesNotMatch(text, /(?:tsconfig|tests\/|scripts\/|adapters\/|fixtures\/)/u);
  for (const candidate of result.packages) {
    assert.equal(candidate.version, "0.0.0");
    assert.equal(candidate.releaseState, "private-unpublished");
    assert.equal(candidate.private, true);
    assert.deepEqual(candidate.entrypoints, {
      ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
    });
    assert.ok(candidate.files.every((file) => !path.isAbsolute(file.path)));
    assert.ok(
      candidate.files.every((file) => !file.path.endsWith(".ts") || file.path.endsWith(".d.ts")),
    );
  }
});
