import { Ajv2020 } from "ajv/dist/2020.js";
import { readBoundedJson } from "./schema-fixture-files.mjs";

/** @param {string} value */
export function isCanonicalTimestamp(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z(?![\s\S])/u.test(value)) return false;
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value.replace("Z", ".000Z")
  );
}

/**
 * Compile one committed, self-contained authoring schema.
 * @param {URL} schemaUrl
 * @param {string} contractName
 * @param {URL[]} dependencyUrls
 * @returns {Promise<import("ajv").ValidateFunction>}
 */
export async function compileAuthoringSchema(schemaUrl, contractName, dependencyUrls = []) {
  const [schema, ...dependencies] = await Promise.all(
    [schemaUrl, ...dependencyUrls].map((url) => readBoundedJson(url)),
  );
  if (!isSchemaDocument(schema)) {
    throw new Error(`Invalid ${contractName} schema document.`);
  }
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
  ajv.addFormat("date-time", { type: "string", validate: isCanonicalTimestamp });
  for (const dependency of dependencies) {
    if (!isSchemaDocument(dependency)) throw new Error("Invalid dependency schema document.");
    ajv.addSchema(dependency);
  }
  return ajv.compile(schema);
}

/**
 * @param {unknown} value
 * @returns {value is import("ajv").AnySchema}
 */
function isSchemaDocument(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
