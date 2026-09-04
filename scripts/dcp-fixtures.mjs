import { lstat, opendir } from "node:fs/promises";
import { validateDcp } from "./dcp-schema.mjs";
import { assertNoSymlinkAncestors, readBoundedJson } from "./dcp-fixture-files.mjs";

const maximumFixturesPerGroup = 32;

/**
 * The optional root is a test seam, not a CLI path or packet field.
 * @param {URL} root
 * @returns {Promise<{valid: number, invalid: number}>}
 */
export async function checkDcpFixtures(root = new URL("../fixtures/dcp/0.1.0/", import.meta.url)) {
  await assertNoSymlinkAncestors(root);
  const rootMetadata = await lstat(root);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new Error("Invalid DCP fixture root.");
  }
  const counts = { valid: 0, invalid: 0 };
  for (const group of /** @type {const} */ (["valid", "invalid"])) {
    const directory = new URL(`${group}/`, root);
    const metadata = await lstat(directory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error("Invalid DCP fixture group.");
    }
    const entries = await opendir(directory);
    /** @type {string[]} */
    const files = [];
    for await (const entry of entries) {
      if (!entry.isFile() || !/^[a-z][a-z-]*\.json(?![\s\S])/u.test(entry.name)) {
        throw new Error("Invalid DCP fixture entry.");
      }
      files.push(entry.name);
      if (files.length > maximumFixturesPerGroup) throw new Error("DCP fixture count exceeded.");
    }
    if (files.length === 0) throw new Error("DCP fixture group is empty.");
    for (const file of files.sort()) {
      // Names were restricted above: no traversal, encoding, separators, or remote URLs.
      const value = await readBoundedJson(new URL(file, directory));
      if (validateDcp(value) !== (group === "valid")) {
        throw new Error("DCP fixture expectation failed.");
      }
      counts[group]++;
    }
  }
  return counts;
}
