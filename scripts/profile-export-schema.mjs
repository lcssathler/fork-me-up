import { validateClaim, validateEvidence } from "./evidence-claim-schema.mjs";
import { compileAuthoringSchema } from "./schema-validator.mjs";

const evidenceSchemaUrl = new URL("../schemas/evidence/0.1.0.schema.json", import.meta.url);
const claimSchemaUrl = new URL("../schemas/claim/0.1.0.schema.json", import.meta.url);
const exportSchemaUrl = new URL(
  "../schemas/portable-profile-export/0.1.0.schema.json",
  import.meta.url,
);
const validateExportShape = await compileAuthoringSchema(
  exportSchemaUrl,
  "Portable Profile Export",
  [evidenceSchemaUrl, claimSchemaUrl],
);
const validateStoreShape = await compileAuthoringSchema(
  new URL("../schemas/internal/community-profile-store/0.1.0.schema.json", import.meta.url),
  "Community Profile Store",
  [evidenceSchemaUrl, claimSchemaUrl, exportSchemaUrl],
);

/** @typedef {{projectRefs: string[], evidence: Record<string, unknown>[], claims: Record<string, unknown>[], declarations: Record<string, unknown>[], corrections: Record<string, unknown>[]}} ProfilePayload */

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function validatePortableProfileExport(value) {
  if (!validateExportShape(value)) return false;
  const envelope = /** @type {{profile: ProfilePayload}} */ (value);
  return validateProfileReferences(envelope.profile);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function validateCommunityProfileStore(value) {
  if (!validateStoreShape(value)) return false;
  const store =
    /** @type {{profile: ProfilePayload, internalState: {createdAt: string, updatedAt: string, lastValidatedAt: string}}} */ (
      value
    );
  return (
    store.internalState.createdAt <= store.internalState.updatedAt &&
    store.internalState.updatedAt <= store.internalState.lastValidatedAt &&
    validateProfileReferences(store.profile)
  );
}

/** @param {ProfilePayload} profile */
function validateProfileReferences(profile) {
  if (
    !profile.evidence.every(validateEvidence) ||
    !profile.claims.every(validateClaim) ||
    !hasUniqueIds(profile.evidence, "evidenceId") ||
    !hasUniqueIds(profile.claims, "claimId") ||
    !hasUniqueIds(profile.declarations, "declarationId") ||
    !hasUniqueIds(profile.corrections, "correctionId")
  ) {
    return false;
  }

  const evidenceIds = new Set(profile.evidence.map((item) => String(item["evidenceId"])));
  const claims = new Map(profile.claims.map((item) => [String(item["claimId"]), item]));
  const declarations = new Map(
    profile.declarations.map((item) => [String(item["declarationId"]), item]),
  );
  const corrections = new Map(
    profile.corrections.map((item) => [String(item["correctionId"]), item]),
  );
  const projectRefs = new Set(profile.projectRefs);

  for (const claim of profile.claims) {
    const basis = /** @type {Record<string, unknown>} */ (claim["basis"]);
    const evidenceRefs = /** @type {string[]} */ (basis["evidenceRefs"]);
    if (!evidenceRefs.every((reference) => evidenceIds.has(reference))) return false;
    const projectRef = claim["projectRef"];
    if (projectRef !== null && !projectRefs.has(String(projectRef))) return false;

    const declarationRef = basis["declarationRef"];
    if (declarationRef !== null) {
      const declaration = declarations.get(String(declarationRef));
      if (declaration?.["capability"] !== claim["capability"]) return false;
    }
    const correctionRef = basis["correctionRef"];
    if (correctionRef !== null) {
      const correction = corrections.get(String(correctionRef));
      if (correction?.["capability"] !== claim["capability"]) return false;
    }
  }

  for (const correction of profile.corrections) {
    const target = correction["targetClaimRef"];
    if (target === null) continue;
    const claim = claims.get(String(target));
    if (claim?.["capability"] !== correction["capability"]) return false;
  }
  return true;
}

/**
 * @param {Record<string, unknown>[]} items
 * @param {string} key
 */
function hasUniqueIds(items, key) {
  const ids = items.map((item) => String(item[key]));
  return new Set(ids).size === ids.length;
}
