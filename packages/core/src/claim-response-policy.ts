import type { Claim, ClaimState, ProfilePreferences, ResponsePolicy } from "@fork-me-up/protocol";
import { deepFreeze, immutableCopy, type DeepReadonly } from "./immutable.ts";

export type ClaimPolicyResolution = DeepReadonly<{
  claims: Claim[];
  responsePolicy: ResponsePolicy;
}>;

const behaviorPriority: Readonly<Record<ClaimState, number>> = {
  disputed: 0,
  "insufficient-evidence": 1,
  "self-declared": 2,
  adjacent: 3,
  demonstrated: 4,
};

export function resolveClaimResponsePolicy(
  claims: readonly Claim[],
  preferences: ProfilePreferences,
): ClaimPolicyResolution {
  const preservedClaims = immutableCopy(
    [...claims].sort(
      (left, right) =>
        behaviorPriority[left.state] - behaviorPriority[right.state] ||
        compareText(left.capability, right.capability) ||
        compareText(left.claimId, right.claimId),
    ),
  );
  const mode = selectMode(preservedClaims, preferences);
  const teachWhileDoing = mode === "teach-while-doing";

  return deepFreeze({
    claims: preservedClaims,
    responsePolicy: {
      mode,
      explainPurposeBeforeCommands: teachWhileDoing || preferences.explainPurposeBeforeCommands,
      includeExpectedResult: teachWhileDoing || preferences.includeExpectedResult,
      includeRiskAndRollback: teachWhileDoing || preferences.includeRiskAndRollback,
      analogyCapabilities: collectAnalogyCapabilities(preservedClaims),
      questionBudget: preferences.questionBudget,
    },
  });
}

function selectMode(
  claims: readonly DeepReadonly<Claim>[],
  preferences: ProfilePreferences,
): ResponsePolicy["mode"] {
  if (preferences.explanationMode === "guided" || claims.length === 0) {
    return "teach-while-doing";
  }

  const leadingClaim = claims[0];
  if (leadingClaim?.state === "demonstrated") return "concise";
  if (leadingClaim?.state === "adjacent") return "analogy";
  return "teach-while-doing";
}

function collectAnalogyCapabilities(claims: readonly DeepReadonly<Claim>[]): readonly string[] {
  const capabilities = new Set(
    claims.flatMap((claim) => (claim.state === "adjacent" ? claim.basis.adjacentFrom : [])),
  );
  return [...capabilities].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
