import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test(
  "frozen M2 sample passes through real source, owner and consumer boundaries without skipped controls",
  { timeout: 240000 },
  async (context) => {
    const directory = await mkdtemp(path.join(tmpdir(), "fmu-quality-report-"));
    context.after(async () => {
      const target = path.resolve(directory);
      const parent = path.resolve(tmpdir());
      const relative = path.relative(parent, target);
      assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
      await rm(target, { recursive: true, force: true });
    });
    const output = path.join(directory, "report.json");
    const execution = spawnSync(
      process.execPath,
      ["scripts/measure-m2-quality.mjs", "--output", output],
      {
        encoding: "utf8",
        timeout: 220000,
        maxBuffer: 1048576,
        windowsHide: true,
      },
    );
    assert.equal(execution.status, 0, "Frozen measurement failed; inspect its minimized report.");
    assert.equal(execution.stderr, "");
    const content = await readFile(output, "utf8");
    const report = JSON.parse(content);
    assert.equal(report.passed, true);
    assert.equal(report.summary.accepted, 48);
    assert.equal(report.summary.attribution.records.numerator, 52);
    assert.equal(report.invariances.length, 10);
    assert.equal(report.ownerExercises.length, 2);
    assert.equal(report.controls.diagnosticSkip, false);
    assert.equal(report.controls.skippedTests, 0);
    assert.ok(report.controls.tests > 0);
    assert.doesNotMatch(content, /FMU_.*CANARY|example\.invalid|sourceRelativeRef|directoryPath/u);
    const repeated = spawnSync(
      process.execPath,
      ["scripts/measure-m2-quality.mjs", "--output", output],
      {
        encoding: "utf8",
        timeout: 220000,
        maxBuffer: 1048576,
        windowsHide: true,
      },
    );
    assert.equal(repeated.status, 1);
    assert.equal(
      await readFile(output, "utf8"),
      content,
      "An existing result must never be overwritten.",
    );
  },
);
