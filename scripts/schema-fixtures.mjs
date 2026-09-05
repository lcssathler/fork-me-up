import { lstat, opendir } from "node:fs/promises";
import { assertNoSymlinkAncestors, readBoundedJson } from "./schema-fixture-files.mjs";

const maximumFixturesPerGroup = 32;

/**
 * The root is a test seam, not a CLI path or contract field.
 * @param {URL} root
 * @param {(value: unknown) => boolean} validate
 * @param {string} contractName
 * @returns {Promise<{valid: number, invalid: number}>}
 */
export async function checkContractFixtures(root, validate, contractName) {
  await assertNoSymlinkAncestors(root);
  const rootMetadata = await lstat(root);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new Error(`Invalid ${contractName} fixture root.`);
  }
  const counts = { valid: 0, invalid: 0 };
  for (const group of /** @type {const} */ (["valid", "invalid"])) {
    const directory = new URL(`${group}/`, root);
    const metadata = await lstat(directory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error(`Invalid ${contractName} fixture group.`);
    }
    const entries = await opendir(directory);
    /** @type {string[]} */
    const files = [];
    for await (const entry of entries) {
      if (!entry.isFile() || !/^[a-z][a-z-]*\.json(?![\s\S])/u.test(entry.name)) {
        throw new Error(`Invalid ${contractName} fixture entry.`);
      }
      files.push(entry.name);
      if (files.length > maximumFixturesPerGroup) {
        throw new Error(`${contractName} fixture count exceeded.`);
      }
    }
    if (files.length === 0) throw new Error(`${contractName} fixture group is empty.`);
    for (const file of files.sort()) {
      const value = await readBoundedJson(new URL(file, directory));
      if (validate(value) !== (group === "valid")) {
        throw new Error(`${contractName} fixture expectation failed.`);
      }
      counts[group]++;
    }
  }
  return counts;
}
