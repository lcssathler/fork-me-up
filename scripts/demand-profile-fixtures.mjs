import { validateDemandProfile } from "./demand-profile-schema.mjs";
import { checkContractFixtures } from "./schema-fixtures.mjs";

export function checkDemandProfileFixtures(
  root = new URL("../fixtures/demand-profile/0.1.0/", import.meta.url),
) {
  return checkContractFixtures(root, validateDemandProfile, "Demand Profile");
}
