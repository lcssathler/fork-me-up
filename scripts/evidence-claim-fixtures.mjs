import { validateClaim, validateEvidence } from "./evidence-claim-schema.mjs";
import { checkContractFixtures } from "./schema-fixtures.mjs";

export function checkEvidenceFixtures(
  root = new URL("../fixtures/evidence/0.1.0/", import.meta.url),
) {
  return checkContractFixtures(root, validateEvidence, "Evidence");
}

export function checkClaimFixtures(root = new URL("../fixtures/claim/0.1.0/", import.meta.url)) {
  return checkContractFixtures(root, validateClaim, "Claim");
}
