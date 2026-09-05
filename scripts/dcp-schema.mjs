import { Buffer } from "node:buffer";
import { compileAuthoringSchema } from "./schema-validator.mjs";

// Development-only authoring validation; never a consumer authorization/redaction check.
const validateShape = await compileAuthoringSchema(
  new URL("../schemas/dcp/0.1.0.schema.json", import.meta.url),
  "DCP",
);

/**
 * Validate JSON-compatible fixture data without mutating it or exposing raw errors.
 * @param {unknown} value
 * @returns {boolean}
 */
export function validateDcp(value) {
  if (!validateShape(value)) return false;
  // Narrow only after the complete committed schema has validated the value.
  const packet =
    /** @type {{budget: {maxBytes: number}, generatedAt: string, expiresAt: string}} */ (value);
  return (
    packet.generatedAt < packet.expiresAt &&
    Buffer.byteLength(JSON.stringify(value), "utf8") <= packet.budget.maxBytes
  );
}
