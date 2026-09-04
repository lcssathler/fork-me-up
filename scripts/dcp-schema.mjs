import { Ajv2020 } from "ajv/dist/2020.js";
import { Buffer } from "node:buffer";
import { readBoundedJson } from "./dcp-fixture-files.mjs";

// Development-only authoring validation; never a consumer authorization/redaction check.
const schema = await readBoundedJson(new URL("../schemas/dcp/0.1.0.schema.json", import.meta.url));
const ajv = new Ajv2020({
  strict: true,
  allErrors: false,
  verbose: false,
  logger: false,
  $data: false,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
});

ajv.addFormat("date-time", {
  type: "string",
  validate: isCanonicalTimestamp,
});

if (schema === null || typeof schema !== "object" || Array.isArray(schema)) {
  throw new Error("Invalid DCP schema document.");
}
const validateShape = ajv.compile(schema);

/** @param {string} value */
function isCanonicalTimestamp(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z(?![\s\S])/u.test(value)) return false;
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value.replace("Z", ".000Z")
  );
}

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
