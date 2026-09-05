import { Ajv2020 } from "ajv/dist/2020.js";
import claimSchema from "../../../schemas/claim/0.1.0.schema.json" with { type: "json" };
import evidenceSchema from "../../../schemas/evidence/0.1.0.schema.json" with { type: "json" };
import portableProfileExportSchema from "../../../schemas/portable-profile-export/0.1.0.schema.json" with { type: "json" };
import type { PortableProfileExport, ProfilePayload } from "./types.ts";

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
ajv.addSchema(evidenceSchema);
ajv.addSchema(claimSchema);
const validateShape = ajv.compile(portableProfileExportSchema);

export function isPortableProfileExport(value: unknown): value is PortableProfileExport {
  if (!validateShape(value)) return false;
  const portableExport = value as unknown as PortableProfileExport;
  return hasValidProfileReferences(portableExport.profile);
}

function isCanonicalTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z(?![\s\S])/u.test(value)) return false;
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value.replace("Z", ".000Z")
  );
}

export function hasValidProfileReferences(profile: ProfilePayload): boolean {
  if (
    !hasUniqueIds(profile.evidence, "evidenceId") ||
    !hasUniqueIds(profile.claims, "claimId") ||
    !hasUniqueIds(profile.declarations, "declarationId") ||
    !hasUniqueIds(profile.corrections, "correctionId") ||
    profile.evidence.some(
      (evidence) => evidence.freshness.observedAt > evidence.freshness.collectedAt,
    )
  ) {
    return false;
  }

  const evidenceIds = new Set(profile.evidence.map((item) => item.evidenceId));
  const claims = new Map(profile.claims.map((item) => [item.claimId, item]));
  const declarations = new Map(profile.declarations.map((item) => [item.declarationId, item]));
  const corrections = new Map(profile.corrections.map((item) => [item.correctionId, item]));
  const projectRefs = new Set(profile.projectRefs);

  for (const claim of profile.claims) {
    if (!claim.basis.evidenceRefs.every((reference) => evidenceIds.has(reference))) return false;
    if (claim.projectRef !== null && !projectRefs.has(claim.projectRef)) return false;

    if (claim.basis.declarationRef !== null) {
      const declaration = declarations.get(claim.basis.declarationRef);
      if (declaration?.capability !== claim.capability) return false;
    }
    if (claim.basis.correctionRef !== null) {
      const correction = corrections.get(claim.basis.correctionRef);
      if (correction?.capability !== claim.capability) return false;
    }
  }

  for (const correction of profile.corrections) {
    if (correction.targetClaimRef === null) continue;
    const claim = claims.get(correction.targetClaimRef);
    if (claim?.capability !== correction.capability) return false;
  }

  return true;
}

function hasUniqueIds<
  Item extends Record<Key, string>,
  Key extends "evidenceId" | "claimId" | "declarationId" | "correctionId",
>(items: readonly Item[], key: Key): boolean {
  const identifiers = items.map((item) => item[key]);
  return new Set(identifiers).size === identifiers.length;
}
