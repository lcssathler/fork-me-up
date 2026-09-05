import {
  validateProfileProviderCapabilities,
  validateProfileProviderConformance,
} from "./provider-conformance-schema.mjs";
import { checkContractFixtures } from "./schema-fixtures.mjs";

export function checkProfileProviderCapabilityFixtures(
  root = new URL("../fixtures/profile-provider/0.1.0/", import.meta.url),
) {
  return checkContractFixtures(root, validateProfileProviderCapabilities, "Profile Provider");
}

export function checkProfileProviderConformanceFixtures(
  root = new URL("../fixtures/conformance/profile-provider/0.1.0/", import.meta.url),
) {
  return checkContractFixtures(
    root,
    validateProfileProviderConformance,
    "Profile Provider conformance",
  );
}
