import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { baselineChecks } from "../../scripts/baseline-checks.mjs";

const [packageJsonText, lockfileText, prettierConfigText, TypeScriptConfigText, workflowText] =
  await Promise.all([
    readFile(new URL("../../package.json", import.meta.url), "utf8"),
    readFile(new URL("../../package-lock.json", import.meta.url), "utf8"),
    readFile(new URL("../../.prettierrc.json", import.meta.url), "utf8"),
    readFile(new URL("../../tsconfig.base.json", import.meta.url), "utf8"),
    readFile(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8"),
  ]);

const packageJson = JSON.parse(packageJsonText);
const lockfile = JSON.parse(lockfileText);
const prettierConfig = JSON.parse(prettierConfigText);
const TypeScriptConfig = JSON.parse(TypeScriptConfigText);

test("the package retains the accepted license and publication safeguard", () => {
  assert.equal(packageJson.private, true);
  assert.equal(packageJson.license, "Apache-2.0");
  assert.equal(lockfile.packages[""].license, "Apache-2.0");
});

test("the manifest and aggregate expose the declared baseline and DCP schema checks", () => {
  assert.deepEqual(packageJson.scripts, {
    format: 'prettier --write "**/*.{json,jsonc,yaml,yml,js,cjs,mjs,ts,cts,mts}"',
    "format:check": 'prettier --check "**/*.{json,jsonc,yaml,yml,js,cjs,mjs,ts,cts,mts}"',
    lint: "eslint . --max-warnings=0",
    typecheck: "tsc --project tsconfig.json --pretty false",
    test: "node scripts/run-test-suite.mjs unit",
    "test:integration": "node scripts/run-test-suite.mjs integration",
    eval: "node scripts/run-test-suite.mjs eval",
    check: "node scripts/run-checks.mjs",
    "schema:check": "node scripts/check-dcp-schema.mjs",
  });
  assert.deepEqual(baselineChecks, [
    "format:check",
    "lint",
    "typecheck",
    "test",
    "schema:check",
    "test:integration",
    "eval",
  ]);
  assert.deepEqual(lockfile.packages[""].devDependencies, packageJson.devDependencies);
});

test("formatter and TypeScript strictness are explicit", () => {
  assert.equal(prettierConfig.endOfLine, "lf");
  assert.equal(TypeScriptConfig.compilerOptions.strict, true);
  assert.equal(TypeScriptConfig.compilerOptions.noUncheckedIndexedAccess, true);
  assert.equal(TypeScriptConfig.compilerOptions.exactOptionalPropertyTypes, true);
  assert.equal(TypeScriptConfig.compilerOptions.skipLibCheck, false);
});

test("CI uses immutable actions and least privilege", () => {
  const actionReferences = [...workflowText.matchAll(/^\s*uses:\s*([^\s#]+)/gmu)].map(
    (match) => match[1],
  );

  assert.deepEqual(actionReferences, [
    "actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd",
    "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
  ]);
  assert.ok(actionReferences.every((reference) => /@[0-9a-f]{40}$/u.test(reference)));
  assert.match(workflowText, /^permissions:\r?\n {2}contents: read$/mu);
  assert.doesNotMatch(workflowText, /pull_request_target/u);
  assert.match(workflowText, /persist-credentials: false/u);
  assert.match(workflowText, /node-version-file: \.nvmrc/u);
  assert.match(workflowText, /^ {4}runs-on: windows-latest$/mu);
  assert.match(workflowText, /^ {4}timeout-minutes: 15$/mu);
  assert.deepEqual(
    [...workflowText.matchAll(/^\s*run:\s*(.+)$/gmu)].map((match) => match[1]),
    ["npm ci --ignore-scripts", "npm run check"],
  );
});
