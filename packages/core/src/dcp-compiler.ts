import {
  isDeveloperContextPacket,
  utf8ByteLength,
  type Claim,
  type DcpAudienceClass,
  type DcpClaimSummary,
  type DcpDisclosureClass,
  type DeveloperContextPacket,
} from "@fork-me-up/protocol";
import type { TaskProfileIntersection } from "./demand-profile-intersection.ts";
import { deepFreeze, immutableCopy, type DeepReadonly } from "./immutable.ts";

export type DcpCompilationRequest = DeepReadonly<{
  packetId: string;
  generatedAt: string;
  expiresAt: string;
  authorization: "allow" | "deny";
  audience: {
    class: DcpAudienceClass;
    consumerId: string | null;
  };
  disclosureClass: DcpDisclosureClass;
  budget: {
    maxBytes: number;
    maxTokens: number;
  };
}>;

export type DcpCompilationResult =
  | DeepReadonly<{
      ok: true;
      value: {
        packet: DeveloperContextPacket;
        usage: {
          bytes: number;
          tokenUpperBound: number;
        };
        reductions: DcpReduction[];
      };
    }>
  | DeepReadonly<{
      ok: false;
      error: {
        category: "invalid-input" | "unauthorized" | "budget-exceeded" | "redaction-failed";
      };
    }>;

export type DcpReduction =
  | "claim-limitations"
  | "non-demonstrated-evidence-references"
  | "claim-summaries"
  | "non-material-uncertainties";

const errorResults = {
  invalidInput: deepFreeze({ ok: false, error: { category: "invalid-input" } } as const),
  unauthorized: deepFreeze({ ok: false, error: { category: "unauthorized" } } as const),
  budgetExceeded: deepFreeze({ ok: false, error: { category: "budget-exceeded" } } as const),
  redactionFailed: deepFreeze({ ok: false, error: { category: "redaction-failed" } } as const),
};

const behaviorPriority = {
  disputed: 0,
  "insufficient-evidence": 1,
  "self-declared": 2,
  adjacent: 3,
  demonstrated: 4,
} as const;

const baseRedactions = ["absolute-paths", "private-source-names", "raw-evidence"] as const;
const sensitiveTextReplacement = "Sensitive content redacted";
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const sensitivePatterns = [
  /FMU_[A-Z0-9_]*CANARY[A-Z0-9_]*/u,
  /(?:ghp_|github_pat_|sk-)[A-Za-z0-9_-]{8,}/u,
  /AKIA[0-9A-Z]{16}/u,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /\b(?:password|secret|token)\s*[:=]\s*\S+/iu,
  /(?:^|\s)[A-Za-z]:\\[^\s]+/u,
  /(?:^|\s)\/(?:Users|home|etc|var|tmp)\/[^\s]+/u,
] as const;

export function compileDeveloperContextPacket(
  intersection: TaskProfileIntersection,
  requestInput: unknown,
): DcpCompilationResult {
  if (isDeniedRequest(requestInput)) return errorResults.unauthorized;
  if (!isCompilationRequest(requestInput)) return errorResults.invalidInput;

  const request = requestInput;
  const redactions = new Set<string>(baseRedactions);
  const sanitize = (value: string): string => {
    if (!containsSensitiveText(value)) return value;
    redactions.add("sensitive-free-text");
    return sensitiveTextReplacement;
  };
  const fullClaims = intersection.claims.map((claim) => projectClaim(claim, sanitize));
  const evidenceRefsByClaimId = new Map(
    intersection.claims.map((claim) => [claim.claimId, claim.basis.evidenceRefs]),
  );
  const demandByCapability = new Map(
    intersection.capabilities.map((item) => [item.capability, item]),
  );
  const baselineUncertainties = buildUncertainties(intersection, fullClaims);
  const packetBase = {
    schemaVersion: "0.1.0" as const,
    packetId: request.packetId,
    profileVersion: intersection.profileVersion,
    purpose: intersection.task.purpose,
    audience: request.audience,
    task: {
      summary: sanitize(intersection.task.summary),
      requiredCapabilities: intersection.capabilities
        .filter((item) => item.relevance === "required")
        .map((item) => item.capability),
    },
    budget: { maxBytes: request.budget.maxBytes },
    responsePolicy: intersection.responsePolicy,
    disclosure: {
      class: request.disclosureClass,
      redactionsApplied: [] as string[],
    },
    generatedAt: request.generatedAt,
    expiresAt: request.expiresAt,
  };

  const attempts: {
    claims: DcpClaimSummary[];
    uncertainties: DeveloperContextPacket["uncertainties"];
    reductions: DcpReduction[];
  }[] = [
    { claims: fullClaims, uncertainties: baselineUncertainties, reductions: [] },
    {
      claims: fullClaims.map((claim) => ({ ...claim, limitations: [] })),
      uncertainties: baselineUncertainties,
      reductions: ["claim-limitations"],
    },
    {
      claims: fullClaims.map((claim) => ({
        ...claim,
        limitations: [],
        evidenceRefs: claim.state === "demonstrated" ? claim.evidenceRefs : [],
      })),
      uncertainties: baselineUncertainties,
      reductions: ["claim-limitations", "non-demonstrated-evidence-references"],
    },
  ];

  const compactClaims = attempts.at(-1)?.claims ?? [];
  const materialUncertainties = baselineUncertainties.filter((item) => item.material);
  attempts.push({
    claims: compactClaims,
    uncertainties: materialUncertainties,
    reductions: [
      "claim-limitations",
      "non-demonstrated-evidence-references",
      "non-material-uncertainties",
    ],
  });
  const retentionOrder = [...compactClaims].sort(
    (left, right) =>
      relevancePriority(left.capability, demandByCapability) -
        relevancePriority(right.capability, demandByCapability) ||
      behaviorPriority[left.state] - behaviorPriority[right.state] ||
      compareText(left.capability, right.capability) ||
      compareText(left.claimId, right.claimId),
  );
  for (let keepCount = retentionOrder.length - 1; keepCount >= 0; keepCount--) {
    const retainedIds = new Set(retentionOrder.slice(0, keepCount).map((claim) => claim.claimId));
    const claims = compactClaims.filter((claim) => retainedIds.has(claim.claimId));
    attempts.push({
      claims,
      uncertainties: addBudgetUncertainties(
        materialUncertainties,
        compactClaims,
        claims,
        demandByCapability,
      ).filter((item) => item.material),
      reductions: [
        "claim-limitations",
        "non-demonstrated-evidence-references",
        "non-material-uncertainties",
        "claim-summaries",
      ],
    });
  }

  for (const attempt of attempts) {
    const evidenceCount = new Set(
      attempt.claims.flatMap((claim) => evidenceRefsByClaimId.get(claim.claimId) ?? []),
    ).size;
    const packet = {
      ...packetBase,
      claims: attempt.claims,
      uncertainties: attempt.uncertainties,
      provenanceSummary: { evidenceCount, sourceClasses: [] as string[] },
      disclosure: {
        ...packetBase.disclosure,
        redactionsApplied: [...redactions].sort(compareText),
      },
    };
    const serialized = JSON.stringify(packet);
    if (containsSensitiveText(serialized)) return errorResults.redactionFailed;
    const bytes = utf8ByteLength(serialized);
    if (bytes <= request.budget.maxTokens && isDeveloperContextPacket(packet)) {
      return immutableCopy({
        ok: true,
        value: {
          packet,
          usage: { bytes, tokenUpperBound: bytes },
          reductions: attempt.reductions,
        },
      });
    }
  }

  return errorResults.budgetExceeded;
}

function projectClaim(
  claim: DeepReadonly<Claim>,
  sanitize: (value: string) => string,
): DcpClaimSummary {
  const summary: DcpClaimSummary = {
    claimId: claim.claimId,
    capability: claim.capability,
    state: claim.state,
    observedDepth: claim.observedDepth,
    confidence: claim.confidence,
    scope: claim.scope,
    adjacentFrom: [...claim.basis.adjacentFrom].sort(compareText),
    evidenceRefs: [...claim.basis.evidenceRefs].sort(compareText),
    limitations: claim.limitations.map(sanitize),
    freshness: { ...claim.freshness },
  };
  if (claim.state === "adjacent") {
    return {
      ...summary,
      adjacentRationale: sanitize(claim.basis.rationale ?? "Adjacent transfer"),
    };
  }
  if (claim.state === "disputed") {
    return {
      ...summary,
      correctionRef: claim.basis.correctionRef ?? "correction_redacted",
      correctionSummary: sanitize(claim.basis.correctionSummary ?? "Developer correction applies"),
    };
  }
  return summary;
}

function buildUncertainties(
  intersection: TaskProfileIntersection,
  claims: readonly DcpClaimSummary[],
): DeveloperContextPacket["uncertainties"] {
  return intersection.capabilities.flatMap((demand) => {
    const leadingClaim = claims.find((claim) => claim.capability === demand.capability);
    if (leadingClaim?.state === "demonstrated") return [];
    return [
      {
        capability: demand.capability,
        reason: leadingClaim?.state ?? "insufficient-evidence",
        material: demand.relevance === "required",
      },
    ];
  });
}

function addBudgetUncertainties(
  baseline: DeveloperContextPacket["uncertainties"],
  originalClaims: readonly DcpClaimSummary[],
  retainedClaims: readonly DcpClaimSummary[],
  demandByCapability: ReadonlyMap<string, TaskProfileIntersection["capabilities"][number]>,
): DeveloperContextPacket["uncertainties"] {
  const retainedCapabilities = new Set(retainedClaims.map((claim) => claim.capability));
  const uncertainties = new Map(baseline.map((item) => [item.capability, item]));
  for (const claim of originalClaims) {
    if (retainedCapabilities.has(claim.capability) || uncertainties.has(claim.capability)) continue;
    uncertainties.set(claim.capability, {
      capability: claim.capability,
      reason: "omitted-by-budget",
      material: demandByCapability.get(claim.capability)?.relevance === "required",
    });
  }
  return [...uncertainties.values()].sort((left, right) =>
    compareText(left.capability, right.capability),
  );
}

function relevancePriority(
  capability: string,
  demandByCapability: ReadonlyMap<string, TaskProfileIntersection["capabilities"][number]>,
): number {
  return demandByCapability.get(capability)?.relevance === "required" ? 0 : 1;
}

function isDeniedRequest(value: unknown): boolean {
  return isRecord(value) && value["authorization"] === "deny";
}

function isCompilationRequest(value: unknown): value is DcpCompilationRequest {
  if (
    !hasExactKeys(value, [
      "packetId",
      "generatedAt",
      "expiresAt",
      "authorization",
      "audience",
      "disclosureClass",
      "budget",
    ])
  ) {
    return false;
  }
  if (
    value["authorization"] !== "allow" ||
    !hasExactKeys(value["audience"], ["class", "consumerId"]) ||
    !hasExactKeys(value["budget"], ["maxBytes", "maxTokens"])
  ) {
    return false;
  }
  const audience = value["audience"];
  const budget = value["budget"];
  const disclosure = value["disclosureClass"];
  const consumerId = audience["consumerId"];
  const audienceIsValid =
    (audience["class"] === "local-assistant" &&
      audience["consumerId"] === null &&
      disclosure === "task-context") ||
    (audience["class"] === "external-consumer" &&
      typeof audience["consumerId"] === "string" &&
      disclosure === "consumer-session");
  return (
    audienceIsValid &&
    typeof value["packetId"] === "string" &&
    identifierPattern.test(value["packetId"]) &&
    typeof value["generatedAt"] === "string" &&
    isCanonicalTimestamp(value["generatedAt"]) &&
    typeof value["expiresAt"] === "string" &&
    isCanonicalTimestamp(value["expiresAt"]) &&
    value["generatedAt"] < value["expiresAt"] &&
    (consumerId === null ||
      (typeof consumerId === "string" && identifierPattern.test(consumerId))) &&
    Number.isSafeInteger(budget["maxBytes"]) &&
    Number.isSafeInteger(budget["maxTokens"]) &&
    Number(budget["maxBytes"]) >= 1 &&
    Number(budget["maxBytes"]) <= 32_768 &&
    Number(budget["maxTokens"]) >= 1 &&
    Number(budget["maxTokens"]) <= 8_192
  );
}

function isCanonicalTimestamp(value: string): boolean {
  if (!timestampPattern.test(value)) return false;
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value.replace("Z", ".000Z")
  );
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsSensitiveText(value: string): boolean {
  return sensitivePatterns.some((pattern) => pattern.test(value));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
