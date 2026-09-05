import {
  validateCommunityProfileStore,
  validatePortableProfileExport,
} from "./profile-export-schema.mjs";
import { checkContractFixtures } from "./schema-fixtures.mjs";

export function checkPortableProfileExportFixtures(
  root = new URL("../fixtures/portable-profile-export/0.1.0/", import.meta.url),
) {
  return checkContractFixtures(root, validatePortableProfileExport, "Portable Profile Export");
}

export function checkCommunityProfileStoreFixtures(
  root = new URL("../fixtures/internal/community-profile-store/0.1.0/", import.meta.url),
) {
  return checkContractFixtures(root, validateCommunityProfileStore, "Community Profile Store");
}
