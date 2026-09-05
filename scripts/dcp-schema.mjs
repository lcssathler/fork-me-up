import { isDeveloperContextPacket } from "../packages/protocol/src/index.ts";

/**
 * Validate JSON-compatible fixture data without mutating it or exposing raw errors.
 * @param {unknown} value
 * @returns {boolean}
 */
export function validateDcp(value) {
  return isDeveloperContextPacket(value);
}
