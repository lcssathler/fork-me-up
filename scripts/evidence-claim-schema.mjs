import { compileAuthoringSchema } from "./schema-validator.mjs";

const validateEvidenceShape = await compileAuthoringSchema(
  new URL("../schemas/evidence/0.1.0.schema.json", import.meta.url),
  "Evidence",
);
const validateClaimShape = await compileAuthoringSchema(
  new URL("../schemas/claim/0.1.0.schema.json", import.meta.url),
  "Claim",
);

/**
 * Validate an Evidence authoring record without mutating it or exposing raw errors.
 * @param {unknown} value
 * @returns {boolean}
 */
export function validateEvidence(value) {
  if (!validateEvidenceShape(value)) return false;
  const evidence = /** @type {{freshness: {observedAt: string, collectedAt: string}}} */ (value);
  return evidence.freshness.observedAt <= evidence.freshness.collectedAt;
}

/**
 * Validate a Claim authoring record without resolving its opaque provenance references.
 * @param {unknown} value
 * @returns {boolean}
 */
export function validateClaim(value) {
  return validateClaimShape(value);
}
