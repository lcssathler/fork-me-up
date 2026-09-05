import { isPortableProfileExport, type ProfilePayload } from "@fork-me-up/protocol";
import { deepFreeze, immutableCopy, type DeepReadonly } from "./immutable.ts";

export { resolveClaimResponsePolicy, type ClaimPolicyResolution } from "./claim-response-policy.ts";
export {
  intersectDemandProfileWithDeveloperProfile,
  type DemandProfileIntersectionResult,
  type DeveloperProfileView,
  type TaskProfileIntersection,
} from "./demand-profile-intersection.ts";
export {
  compileDeveloperContextPacket,
  type DcpCompilationRequest,
  type DcpCompilationResult,
  type DcpReduction,
} from "./dcp-compiler.ts";

export type LoadedDeveloperProfile = DeepReadonly<{
  profileVersion: string;
  profile: ProfilePayload;
}>;

export type DeveloperProfileLoadResult =
  | Readonly<{ ok: true; value: LoadedDeveloperProfile }>
  | Readonly<{
      ok: false;
      error: Readonly<{ category: "invalid-input" }>;
    }>;

const invalidInput = deepFreeze({
  ok: false,
  error: { category: "invalid-input" },
} as const);

export function loadDeveloperProfileFromPortableExport(value: unknown): DeveloperProfileLoadResult {
  if (!isPortableProfileExport(value)) return invalidInput;

  return deepFreeze({
    ok: true,
    value: {
      profileVersion: value.profileVersion,
      profile: immutableCopy(value.profile),
    },
  });
}
