import { compileAuthoringSchema } from "./schema-validator.mjs";

const validateShape = await compileAuthoringSchema(
  new URL("../schemas/demand-profile/0.1.0.schema.json", import.meta.url),
  "Demand Profile",
);

/**
 * Validate a draft Demand Profile without deriving demand or mutating input.
 * @param {unknown} value
 * @returns {boolean}
 */
export function validateDemandProfile(value) {
  if (!validateShape(value)) return false;
  const demand =
    /** @type {{project: {metadataStatus: string}, capabilities: {capability: string, basis: string}[]}} */ (
      value
    );
  const capabilities = demand.capabilities.map((item) => item.capability);
  return (
    new Set(capabilities).size === capabilities.length &&
    (demand.project.metadataStatus !== "unavailable" ||
      demand.capabilities.every((item) => item.basis === "task-input"))
  );
}
