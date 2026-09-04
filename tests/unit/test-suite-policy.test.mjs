import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSuitePolicy } from "../../scripts/test-suite-policy.mjs";

const validConfiguration = {
  schemaVersion: 1,
  exceptions: {
    integration: {
      status: "bootstrap-not-applicable",
      milestone: "M0",
      reason: "No integration boundary exists.",
      endsWhen: "The first integration boundary is implemented.",
    },
  },
};

test("the unit suite can never be empty", () => {
  const result = evaluateSuitePolicy({
    configuration: { schemaVersion: 1, exceptions: {} },
    suite: "unit",
    testFileCount: 0,
  });

  assert.equal(result.action, "fail");
});

test("an empty non-unit suite needs a complete bootstrap exception", () => {
  assert.equal(
    evaluateSuitePolicy({
      configuration: validConfiguration,
      suite: "integration",
      testFileCount: 0,
    }).action,
    "skip",
  );
  assert.equal(
    evaluateSuitePolicy({
      configuration: { schemaVersion: 1, exceptions: {} },
      suite: "integration",
      testFileCount: 0,
    }).action,
    "fail",
  );
});

test("a bootstrap exception becomes stale as soon as tests exist", () => {
  const result = evaluateSuitePolicy({
    configuration: validConfiguration,
    suite: "integration",
    testFileCount: 1,
  });

  assert.equal(result.action, "fail");
});

test("malformed or unit-suite exceptions fail closed", () => {
  assert.equal(
    evaluateSuitePolicy({ configuration: {}, suite: "eval", testFileCount: 0 }).action,
    "fail",
  );
  assert.equal(
    evaluateSuitePolicy({
      configuration: {
        schemaVersion: 1,
        exceptions: {
          unit: {
            status: "bootstrap-not-applicable",
            milestone: "M0",
            reason: "Not permitted.",
            endsWhen: "Never.",
          },
        },
      },
      suite: "unit",
      testFileCount: 1,
    }).action,
    "fail",
  );
});

test("untrusted exception text cannot forge policy output", () => {
  const attackerText = "hidden\u200B\n::error file=C:/Users/path-canary::";
  const result = evaluateSuitePolicy({
    configuration: {
      schemaVersion: 1,
      exceptions: {
        [attackerText]: {
          status: "bootstrap-not-applicable",
          milestone: "M0",
          reason: attackerText,
          endsWhen: attackerText,
        },
      },
    },
    suite: "eval",
    testFileCount: 0,
  });
  const output = result.messages.join("\n");

  assert.equal(result.action, "fail");
  assert.doesNotMatch(output, /path-canary|::error|C:\/Users/u);
});
