import {
  isDemandProfile,
  type Claim,
  type DemandCapability,
  type DemandProfile,
  type ProfilePayload,
  type ResponsePolicy,
} from "@fork-me-up/protocol";
import { resolveClaimResponsePolicy } from "./claim-response-policy.ts";
import { deepFreeze, immutableCopy, type DeepReadonly } from "./immutable.ts";

export type DeveloperProfileView = DeepReadonly<{
  profileVersion: string;
  profile: ProfilePayload;
}>;

export type TaskProfileIntersection = DeepReadonly<{
  demandId: string;
  profileVersion: string;
  projectRef: string;
  task: DemandProfile["task"];
  capabilities: DemandCapability[];
  claims: Claim[];
  unmatchedCapabilities: DemandCapability[];
  responsePolicy: ResponsePolicy;
}>;

export type DemandProfileIntersectionResult =
  | Readonly<{ ok: true; value: TaskProfileIntersection }>
  | Readonly<{ ok: false; error: Readonly<{ category: "invalid-input" }> }>;

const invalidInput = deepFreeze({
  ok: false,
  error: { category: "invalid-input" },
} as const);

export function intersectDemandProfileWithDeveloperProfile(
  demandInput: unknown,
  developerProfile: DeveloperProfileView,
): DemandProfileIntersectionResult {
  if (!isDemandProfile(demandInput)) return invalidInput;

  const demand = demandInput;
  const capabilities = immutableCopy(
    [...demand.capabilities].sort((left, right) => compareText(left.capability, right.capability)),
  );
  const demandedCapabilities = new Set(capabilities.map((item) => item.capability));
  const relevantClaims = developerProfile.profile.claims.filter(
    (claim) =>
      demandedCapabilities.has(claim.capability) &&
      (claim.scope === "global" || claim.projectRef === demand.project.projectRef),
  );
  const resolution = resolveClaimResponsePolicy(
    relevantClaims,
    developerProfile.profile.preferences,
  );
  const matchedCapabilities = new Set(resolution.claims.map((claim) => claim.capability));

  return deepFreeze({
    ok: true,
    value: {
      demandId: demand.demandId,
      profileVersion: developerProfile.profileVersion,
      projectRef: demand.project.projectRef,
      task: immutableCopy(demand.task),
      capabilities,
      claims: resolution.claims,
      unmatchedCapabilities: immutableCopy(
        capabilities.filter((item) => !matchedCapabilities.has(item.capability)),
      ),
      responsePolicy: resolution.responsePolicy,
    },
  });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
