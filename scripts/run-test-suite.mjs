import { spawnSync } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { evaluateSuitePolicy } from "./test-suite-policy.mjs";

const suiteRoots = {
  unit: "tests/unit",
  integration: "tests/integration",
  eval: "evaluations",
};

const suite = process.argv[2];
const suiteRoot =
  suite === undefined ? undefined : suiteRoots[/** @type {keyof typeof suiteRoots} */ (suite)];

if (suiteRoot === undefined) {
  console.error("Unknown test suite.");
  process.exitCode = 1;
} else {
  try {
    const suiteName = /** @type {keyof typeof suiteRoots} */ (suite);
    const [testFiles, configurationText] = await Promise.all([
      findTestFiles(suiteRoot),
      readBoundedRegularFile(
        new URL("../config/test-suite-exceptions.json", import.meta.url),
        1024 * 1024,
      ),
    ]);
    const policy = evaluateSuitePolicy({
      configuration: JSON.parse(configurationText),
      suite: suiteName,
      testFileCount: testFiles.length,
    });

    if (policy.action === "fail") {
      for (const message of policy.messages) {
        console.error(message);
      }
      process.exitCode = 1;
    } else if (policy.action === "skip") {
      for (const message of policy.messages) {
        console.log(message);
      }
    } else {
      const result = spawnSync(process.execPath, ["--test", ...testFiles], {
        shell: false,
        stdio: "inherit",
      });

      if (result.error !== undefined) {
        console.error(`Unable to start the ${suite} test suite.`);
        process.exitCode = 1;
      } else {
        process.exitCode = result.status ?? 1;
      }
    }
  } catch {
    console.error(`Unable to evaluate the ${suite} test suite.`);
    process.exitCode = 1;
  }
}

/**
 * @param {URL} url
 * @param {number} maximumBytes
 * @returns {Promise<string>}
 */
async function readBoundedRegularFile(url, maximumBytes) {
  const metadata = await lstat(url);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > maximumBytes) {
    throw new Error("Invalid test-suite policy file.");
  }
  return readFile(url, "utf8");
}

/**
 * @param {string} root
 * @returns {Promise<string[]>}
 */
async function findTestFiles(root) {
  /** @type {string[]} */
  const files = [];
  await visit(root, files);
  return files.sort();
}

/**
 * @param {string} directory
 * @param {string[]} files
 * @returns {Promise<void>}
 */
async function visit(directory, files) {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    const fileSystemError = /** @type {NodeJS.ErrnoException} */ (error);
    if (fileSystemError.code === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      await visit(entryPath, files);
    } else if (entry.isFile() && /\.(?:test|spec)\.[cm]?[jt]s$/u.test(entry.name)) {
      files.push(relative(process.cwd(), entryPath));
    }
  }
}
