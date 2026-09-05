import { validateDcp } from "./dcp-schema.mjs";
import { checkContractFixtures } from "./schema-fixtures.mjs";

/**
 * The optional root is a test seam, not a CLI path or packet field.
 * @param {URL} root
 * @returns {Promise<{valid: number, invalid: number}>}
 */
export async function checkDcpFixtures(root = new URL("../fixtures/dcp/0.1.0/", import.meta.url)) {
  return checkContractFixtures(root, validateDcp, "DCP");
}
