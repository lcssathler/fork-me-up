import { isDeveloperContextPacket, utf8ByteLength } from "@fork-me-up/protocol";

const maximumContextBytes = 8_192;

/** @type {GenericNoContextResult} */
const noContextResult = deepFreeze({
  schemaVersion: 1,
  kind: "generic-conformance-consumer-result",
  outcome: "no-context",
  reason: "invalid-or-unavailable",
});

/**
 * @typedef {Readonly<{
 *   schemaVersion: 1,
 *   kind: "generic-conformance-consumer-result",
 *   outcome: "context",
 *   context: Readonly<{
 *     expiresAt: string,
 *     claims: readonly Readonly<{
 *       capability: string,
 *       state: import("@fork-me-up/protocol").ClaimState,
 *       observedDepth: import("@fork-me-up/protocol").ObservedDepth | null
 *     }>[],
 *     responsePolicy: import("@fork-me-up/protocol").ResponsePolicy,
 *     authority: "none"
 *   }>
 * }>} GenericContextResult
 */

/**
 * @typedef {Readonly<{
 *   schemaVersion: 1,
 *   kind: "generic-conformance-consumer-result",
 *   outcome: "no-context",
 *   reason: "invalid-or-unavailable"
 * }>} GenericNoContextResult
 */

/**
 * Validate a DCP at the consumer boundary and retain only structured advisory fields.
 *
 * @param {unknown} value
 * @param {Readonly<{clock?: () => Date, consumerId?: string | null}>} [options]
 * @returns {GenericContextResult | GenericNoContextResult}
 */
export function consumeDeveloperContextPacket(value, options = {}) {
  try {
    const candidate = globalThis.structuredClone(value);
    if (!isDeveloperContextPacket(candidate)) return noContextResult;

    const now = options.clock?.() ?? new Date();
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return noContextResult;
    if (Date.parse(candidate.expiresAt) <= now.getTime()) return noContextResult;
    if (!matchesAudience(candidate, options.consumerId ?? null)) return noContextResult;

    /** @type {GenericContextResult} */
    const result = deepFreeze({
      schemaVersion: 1,
      kind: "generic-conformance-consumer-result",
      outcome: "context",
      context: {
        expiresAt: candidate.expiresAt,
        claims: candidate.claims
          .map((claim) => ({
            capability: claim.capability,
            state: claim.state,
            observedDepth: claim.observedDepth,
          }))
          .sort((left, right) => compareText(left.capability, right.capability)),
        responsePolicy: {
          mode: candidate.responsePolicy.mode,
          explainPurposeBeforeCommands: candidate.responsePolicy.explainPurposeBeforeCommands,
          includeExpectedResult: candidate.responsePolicy.includeExpectedResult,
          includeRiskAndRollback: candidate.responsePolicy.includeRiskAndRollback,
          analogyCapabilities: [...candidate.responsePolicy.analogyCapabilities].sort(compareText),
          questionBudget: candidate.responsePolicy.questionBudget,
        },
        authority: "none",
      },
    });

    return utf8ByteLength(JSON.stringify(result)) <= maximumContextBytes ? result : noContextResult;
  } catch {
    return noContextResult;
  }
}

/**
 * @param {import("@fork-me-up/protocol").DeveloperContextPacket} packet
 * @param {string | null} consumerId
 */
function matchesAudience(packet, consumerId) {
  if (packet.audience.class === "local-assistant") return consumerId === null;
  return consumerId !== null && packet.audience.consumerId === consumerId;
}

/** @param {string} left @param {string} right */
function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** @template Value @param {Value} value @returns {Value} */
function deepFreeze(value) {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
