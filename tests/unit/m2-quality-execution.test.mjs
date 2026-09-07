import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  executeQualityCase,
  qualityControlEnvironment,
} from "../../scripts/measure-m2-quality.mjs";
import { scoreQualityCase } from "../../scripts/m2-quality-scoring.mjs";

test("frozen controls receive no inherited Node test recursion marker", () => {
  const original = {
    NODE_TEST_CONTEXT: "child-v8",
    PATH: "synthetic-path",
    SystemRoot: "synthetic-system",
  };
  const isolated = qualityControlEnvironment(original);
  assert.equal(Object.hasOwn(isolated, "NODE_TEST_CONTEXT"), false);
  assert.equal(isolated["PATH"], original.PATH);
  assert.equal(isolated["SystemRoot"], original.SystemRoot);
  assert.equal(original.NODE_TEST_CONTEXT, "child-v8");
});

test("escaped case exceptions preserve every frozen denominator and redact native errors", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../../docs/evaluations/m2-quality-sample.json", import.meta.url),
      "utf8",
    ),
  );
  const reports = [];
  for (const definition of manifest.cases) {
    const result = await executeQualityCase(definition, manifest, async () => {
      throw new Error("PRIVATE_EXCEPTION_CANARY");
    });
    assert.equal(result.snapshot, null);
    assert.deepEqual(result.failureCodes, ["runner-exception"]);
    assert.equal(
      result.ownerExercise.required,
      manifest.ownerExercises.includes(definition.caseId),
    );
    reports.push(scoreQualityCase(definition, manifest.fixed, result.snapshot));
    assert.doesNotMatch(JSON.stringify(result), /CANARY/u);
  }
  assert.equal(reports.length, 48);
  assert.equal(reports.filter((r) => r.outcome === "accepted").length, 0);
  assert.equal(
    reports.reduce((n, r) => n + r.missingEvidenceCount, 0),
    52,
  );
});
