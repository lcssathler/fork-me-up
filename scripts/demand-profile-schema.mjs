import { isDemandProfile } from "../packages/protocol/src/index.ts";

/**
 * Validate a draft Demand Profile without deriving demand or mutating input.
 * @param {unknown} value
 * @returns {boolean}
 */
export function validateDemandProfile(value) {
  return isDemandProfile(value);
}
