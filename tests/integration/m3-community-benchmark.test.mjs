import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test(
  "M3 Community benchmark reproduces bounded evidence and two-consumer calibration results",
  { timeout: 300_000 },
  async (context) => {
    const directory = await mkdtemp(path.join(tmpdir(), "fmu-m3-benchmark-"));
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
      ["scripts/measure-m3-community-benchmark.mjs", "--output", output],
      { encoding: "utf8", timeout: 280_000, maxBuffer: 1_048_576, windowsHide: true },
    );
    assert.equal(execution.status, 0, execution.stderr);
    assert.equal(execution.stderr, "");
    const content = await readFile(output, "utf8");
    const report = JSON.parse(content);
    assert.equal(report.passed, true);
    assert.equal(report.repeatedCalibration.totalConsumerPairs, 9);
    assert.equal(report.repeatedCalibration.stableConsumerPairs, 9);
    assert.equal(report.repeatedCalibration.policyAdherentConsumerRuns, 18);
    assert.equal(report.repeatedCalibration.sameMeaningPairs, 9);
    assert.equal(report.evidenceQuality.falseDemonstrated.allCases.numerator, 0);
    assert.equal(report.evidenceQuality.attribution.records.denominator, 52);
    assert.equal(report.evidenceQuality.unknownAttribution.numerator, 10);
    assert.match(report.limits, /no human accuracy/u);
    assert.doesNotMatch(content, /sourceRelativeRef|subject_fixture|repository_fixture/u);

    const repeated = spawnSync(
      process.execPath,
      ["scripts/measure-m3-community-benchmark.mjs", "--output", output],
      { encoding: "utf8", timeout: 280_000, maxBuffer: 1_048_576, windowsHide: true },
    );
    assert.equal(repeated.status, 1);
    assert.equal(await readFile(output, "utf8"), content);
  },
);
