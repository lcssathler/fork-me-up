import {
  hasValidProfileReferences,
  isPortableProfileExport,
} from "../packages/protocol/src/portable-profile-export.ts";
import { compileAuthoringSchema } from "./schema-validator.mjs";

const evidenceSchemaUrl = new URL("../schemas/evidence/0.1.0.schema.json", import.meta.url);
const claimSchemaUrl = new URL("../schemas/claim/0.1.0.schema.json", import.meta.url);
const exportSchemaUrl = new URL(
  "../schemas/portable-profile-export/0.1.0.schema.json",
  import.meta.url,
);
const validateStoreShape = await compileAuthoringSchema(
  new URL("../schemas/internal/community-profile-store/0.1.0.schema.json", import.meta.url),
  "Community Profile Store",
  [evidenceSchemaUrl, claimSchemaUrl, exportSchemaUrl],
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function validatePortableProfileExport(value) {
  return isPortableProfileExport(value);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function validateCommunityProfileStore(value) {
  if (!validateStoreShape(value)) return false;
  const store =
    /** @type {{profile: import("../packages/protocol/src/types.ts").ProfilePayload, internalState: {createdAt: string, updatedAt: string, lastValidatedAt: string}}} */ (
      value
    );
  return (
    store.internalState.createdAt <= store.internalState.updatedAt &&
    store.internalState.updatedAt <= store.internalState.lastValidatedAt &&
    hasValidProfileReferences(store.profile)
  );
}
