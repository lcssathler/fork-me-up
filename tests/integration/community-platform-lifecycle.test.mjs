import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { communityPlatformCandidateVersions } from "../../scripts/community-package-candidate.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

test("exact artifacts complete the Community lifecycle and uninstall on the current platform", () => {
  const npmCli = process.env["npm_execpath"];
  assert.ok(npmCli);
  const result = spawnSync(process.execPath, [npmCli, "run", "--silent", "lifecycle:check"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: false,
    timeout: 180_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const reportText = readFileSync(
    path.join(repositoryRoot, "build", "community-platform-lifecycle", "manifest.json"),
    "utf8",
  );
  const report = JSON.parse(reportText);
  assert.equal(report.kind, "community-platform-lifecycle");
  assert.equal(report.releaseState, "private-unpublished");
  assert.equal(report.platform, process.platform);
  assert.equal(report.architecture, process.arch);
  assert.equal(report.packageManager, "npm@11.19.0");
  assert.equal(report.install, "lockfile-derived-offline-without-lifecycle-scripts");
  assert.deepEqual(report.candidates, [
    communityPlatformCandidateVersions.initial,
    communityPlatformCandidateVersions.update,
  ]);
  assert.deepEqual(report.cases, [
    "state-root-boundary",
    "install",
    "refresh",
    "correction",
    "task-context",
    "export",
    "update",
    "state-reload",
    "correction-preserved",
    "delete",
    "retained-data",
    "uninstall",
  ]);
  assert.doesNotMatch(reportText, /(?:[A-Za-z]:[\\/]|\\Users\\|\/Users\/|\/home\/|CANARY)/u);
});
