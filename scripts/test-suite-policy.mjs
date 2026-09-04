const suites = new Set(["unit", "integration", "eval"]);
const invisibleCharacterPattern = /[\p{Cc}\p{Cf}]/u;

/** @typedef {Record<string, unknown>} UnknownRecord */

/**
 * @param {{ configuration: unknown; suite: string; testFileCount: number }} input
 * @returns {{ action: "run" | "skip" | "fail"; messages: string[] }}
 */
export function evaluateSuitePolicy({ configuration, suite, testFileCount }) {
  /** @type {string[]} */
  const messages = [];

  if (!suites.has(suite)) {
    return { action: "fail", messages: ["Unknown test suite."] };
  }

  if (!Number.isSafeInteger(testFileCount) || testFileCount < 0) {
    return { action: "fail", messages: ["Test file count must be a non-negative integer."] };
  }

  if (!isRecord(configuration) || configuration["schemaVersion"] !== 1) {
    return { action: "fail", messages: ["The test-suite exception file is invalid."] };
  }

  const exceptions = configuration["exceptions"];
  if (!isRecord(exceptions)) {
    return { action: "fail", messages: ["The test-suite exceptions must be an object."] };
  }

  for (const [exceptionSuite, exception] of Object.entries(exceptions)) {
    if (!suites.has(exceptionSuite) || exceptionSuite === "unit" || !isValidException(exception)) {
      messages.push("Invalid bootstrap exception entry.");
    }
  }

  if (messages.length > 0) {
    return { action: "fail", messages: messages.sort() };
  }

  const exception = exceptions[suite];

  if (testFileCount === 0) {
    if (suite === "unit") {
      return { action: "fail", messages: ["The unit test suite must not be empty."] };
    }
    if (!isValidException(exception)) {
      return {
        action: "fail",
        messages: [`The empty ${suite} suite requires an explicit bootstrap exception.`],
      };
    }
    return {
      action: "skip",
      messages: [
        `[bootstrap-not-applicable] ${suite}: ${exception.reason} Exception ends when: ${exception.endsWhen}`,
      ],
    };
  }

  if (exception !== undefined) {
    return {
      action: "fail",
      messages: [`Remove the stale ${suite} bootstrap exception now that tests exist.`],
    };
  }

  return { action: "run", messages: [] };
}

/**
 * @param {unknown} value
 * @returns {value is UnknownRecord}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {value is { status: "bootstrap-not-applicable"; milestone: "M0"; reason: string; endsWhen: string }}
 */
function isValidException(value) {
  return (
    isRecord(value) &&
    value["status"] === "bootstrap-not-applicable" &&
    value["milestone"] === "M0" &&
    isBoundedPolicyText(value["reason"]) &&
    isBoundedPolicyText(value["endsWhen"])
  );
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isBoundedPolicyText(value) {
  return (
    typeof value === "string" &&
    value.length <= 1000 &&
    value.trim().length > 0 &&
    !invisibleCharacterPattern.test(value)
  );
}
