import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assessGitAuthorship,
  classifyEvidenceSourceRisk,
  deriveEvidenceClaims,
  evidenceClaimDerivationHardLimits,
  isIssuedEvidenceClaimDerivation,
  isIssuedEvidenceSourceRiskSnapshot,
  resolveDeveloperIdentityConfig,
  resolveEvidenceSourceRiskConfig,
} from "@fork-me-up/community-provider";
import { isPortableProfileExport } from "@fork-me-up/protocol";

const observedAt = "2026-09-05T12:00:00Z";
const derivedAt = "2026-09-05T12:01:00Z";
const staleBefore = "2026-09-01T00:00:00Z";
const repositoryId = "repo_synthetic";
const rootId = "root_synthetic";
const subjectRef = "subject_synthetic";
const projectRef = "project_synthetic";
const objectId = "1".padStart(40, "0");

/** @param {number} value */
const digest = (value) => value.toString(16).padStart(64, "0");

/** @param {string} relativePath @param {string} language @param {number} value */
function source(relativePath, language, value) {
  return {
    relativePath,
    bytes: value + 1,
    digest: { algorithm: "sha256", value: digest(value + 1) },
    lineCount: 1,
    category: "source",
    language,
    testFile: relativePath.includes("test"),
  };
}

/** @param {string} relativePath @param {number} value */
function document(relativePath, value) {
  return {
    relativePath,
    bytes: value + 1,
    digest: { algorithm: "sha256", value: digest(value + 1) },
    lineCount: 1,
    category: "document",
    format: "markdown",
    headingCount: 1,
    codeFenceCount: 0,
  };
}

/**
 * @param {Array<ReturnType<typeof source> | ReturnType<typeof document>>} files
 * @param {{mode?: "direct" | "coauthored" | "bot" | "unknown", changedPaths?: string[], commitObjectId?: string, repositoryFlags?: string[], pathFlags?: Array<{repositoryId: string, sourceRelativeRef: string, riskFlags: string[]}>}} [options]
 */
function buildRisk(files, options = {}) {
  const identity = resolveDeveloperIdentityConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      subjectRef,
      identities: [
        { role: "developer", name: "Synthetic Developer", email: "developer@example.invalid" },
        { role: "bot", name: "Synthetic Bot", email: "bot@example.invalid" },
      ],
      annotations: [],
    }),
  );
  assert.equal(identity.ok, true);
  if (!identity.ok) throw new Error("identity configuration failed");
  const developerDigest = identity.value.identities.find(
    (item) => item.role === "developer",
  )?.identityDigest;
  const botDigest = identity.value.identities.find((item) => item.role === "bot")?.identityDigest;
  assert.ok(developerDigest);
  assert.ok(botDigest);
  const mode = options.mode ?? "direct";
  const unknownDigest = "f".repeat(64);
  const authorIdentityDigest =
    mode === "direct" ? developerDigest : mode === "bot" ? botDigest : unknownDigest;
  const coauthorIdentityDigests = mode === "coauthored" ? [developerDigest] : [];
  const currentObjectId = options.commitObjectId ?? objectId;
  const git = {
    kind: "git-metadata-snapshot",
    snapshotVersion: "0.1.0",
    repositories: [
      {
        repositoryId,
        rootId,
        objectFormat: "sha1",
        headObjectId: currentObjectId,
        shallow: false,
        historyTruncated: false,
        totalCommitBytes: 100,
        commits: [
          {
            objectId: currentObjectId,
            parentObjectIds: [],
            authoredAt: "2026-09-05T11:59:59.000Z",
            committedAt: "2026-09-05T12:00:00.000Z",
            authorIdentityDigest,
            committerIdentityDigest: authorIdentityDigest,
            coauthorIdentityDigests,
            changedPaths: options.changedPaths ?? files.map((file) => file.relativePath),
          },
        ],
      },
    ],
  };
  const authorship = assessGitAuthorship(git, identity.value);
  assert.equal(authorship.ok, true);
  if (!authorship.ok) throw new Error("authorship assessment failed");
  const filesystem = {
    kind: "filesystem-metadata-snapshot",
    snapshotVersion: "0.1.0",
    repositories: [
      {
        repositoryId,
        rootId,
        visitedEntryCount: files.length,
        ignoredDirectoryCount: 0,
        unsupportedFileCount: 0,
        bytesRead: files.reduce((sum, file) => sum + file.bytes, 0),
        files,
      },
    ],
  };
  const riskConfiguration = resolveEvidenceSourceRiskConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      repositoryAnnotations:
        options.repositoryFlags === undefined
          ? []
          : [{ repositoryId, riskFlags: options.repositoryFlags }],
      pathAnnotations: options.pathFlags ?? [],
    }),
  );
  assert.equal(riskConfiguration.ok, true);
  if (!riskConfiguration.ok) throw new Error("risk configuration failed");
  const risk = classifyEvidenceSourceRisk(
    filesystem,
    git,
    authorship.value,
    riskConfiguration.value,
  );
  assert.equal(risk.ok, true);
  if (!risk.ok) throw new Error("risk classification failed");
  return risk.value;
}

/**
 * @param {Partial<import("@fork-me-up/community-provider").EvidenceClaimDerivationRequest>} [override]
 * @returns {import("@fork-me-up/community-provider").EvidenceClaimDerivationRequest}
 */
function request(override = {}) {
  return {
    kind: "evidence-claim-derivation-request",
    derivationVersion: "0.1.0",
    sourceObservedAt: observedAt,
    derivedAt,
    staleBefore,
    repositoryProjects: [{ repositoryId, projectRef }],
    ...override,
  };
}

/** @param {import("@fork-me-up/community-provider").EvidenceClaimDerivationSnapshot} value */
function profileEnvelope(value) {
  return {
    schemaVersion: "0.1.0",
    kind: "portable-profile-export",
    exportId: "export_unit_derivation",
    profileVersion: "profile_unit_derivation",
    subjectRef: value.subjectRef,
    generatedAt: value.derivedAt,
    profile: {
      projectRefs: value.projectRefs,
      evidence: value.evidence,
      claims: value.claims,
      declarations: [],
      corrections: [],
      preferences: {
        explanationMode: "balanced",
        explainPurposeBeforeCommands: true,
        includeExpectedResult: true,
        includeRiskAndRollback: true,
        questionBudget: 1,
      },
    },
    exclusions: {
      credentials: true,
      rawSource: true,
      sourceGrants: true,
      sharingGrants: true,
      internalState: true,
    },
  };
}

test("derives exact project-scoped Evidence and conservative Claims deterministically", () => {
  const risk = buildRisk([
    source("src/main.ts", "typescript", 1),
    source("src/helper.ts", "typescript", 2),
    source("src/tool.py", "python", 3),
    document("README.md", 4),
  ]);
  assert.equal(isIssuedEvidenceSourceRiskSnapshot(risk), true);
  assert.equal(
    risk.repositories[0]?.records.find((item) => item.sourceCategory === "document")
      ?.sourceLanguage,
    null,
  );
  const first = deriveEvidenceClaims(risk, request());
  const second = deriveEvidenceClaims(risk, request());
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.deepEqual(first.value, second.value);
  assert.equal(isIssuedEvidenceClaimDerivation(first.value), true);
  assert.equal(first.value.evidence.length, 3);
  assert.equal(first.value.claims.length, 2);
  assert.deepEqual(first.value.projectRefs, [projectRef]);
  assert.equal(isPortableProfileExport(profileEnvelope(first.value)), true);
  const typescript = first.value.claims.find((claim) => claim.capability === "language.typescript");
  const python = first.value.claims.find((claim) => claim.capability === "language.python");
  assert.ok(typescript);
  assert.ok(python);
  assert.equal(typescript.state, "demonstrated");
  assert.equal(typescript.observedDepth, "practical-use");
  assert.equal(typescript.confidence, "medium");
  assert.equal(typescript.scope, "project");
  assert.equal(typescript.projectRef, projectRef);
  assert.equal(python.observedDepth, "exposure");
  assert.equal(python.confidence, "medium");
  assert.ok(first.value.evidence.every((item) => item.authorAssessment.state === "attributed"));
  assert.ok(first.value.evidence.every((item) => item.strength === "moderate"));
  assert.ok(first.value.evidence.every((item) => item.invalidation.rule === "source-changed"));
  assert.ok(first.value.claims.every((item) => item.confidence !== "high"));
  assert.ok(first.value.claims.every((item) => item.observedDepth !== "demonstrated-depth"));
  assert.deepEqual(first.value.invalidation, {
    previousDerivationVersion: null,
    evidence: [],
    claims: [],
  });
  assert.equal(Object.isFrozen(first.value), true);
  assert.equal(Object.isFrozen(first.value.evidence), true);
  assert.equal(Object.isFrozen(first.value.claims[0]?.basis), true);
});

test("preserves weak, collaborative, bot, and unknown authorship ceilings", () => {
  const cleanCoauthored = deriveEvidenceClaims(
    buildRisk([source("src/one.ts", "typescript", 40), source("src/two.ts", "typescript", 41)], {
      mode: "coauthored",
    }),
    request(),
  );
  assert.equal(cleanCoauthored.ok, true);
  if (!cleanCoauthored.ok) return;
  assert.ok(cleanCoauthored.value.evidence.every((item) => item.strength === "moderate"));
  assert.equal(cleanCoauthored.value.claims[0]?.observedDepth, "exposure");
  assert.equal(cleanCoauthored.value.claims[0]?.confidence, "low");

  const weakCoauthored = deriveEvidenceClaims(
    buildRisk([source("generated/component.ts", "typescript", 1)], {
      mode: "coauthored",
      repositoryFlags: ["fork"],
    }),
    request(),
  );
  assert.equal(weakCoauthored.ok, true);
  if (!weakCoauthored.ok) return;
  assert.equal(weakCoauthored.value.evidence[0]?.authorAssessment.state, "coauthored");
  assert.equal(weakCoauthored.value.evidence[0]?.strength, "weak");
  assert.ok(weakCoauthored.value.evidence[0]?.limitations.includes("source-risk-fork"));
  assert.equal(weakCoauthored.value.claims[0]?.state, "demonstrated");
  assert.equal(weakCoauthored.value.claims[0]?.observedDepth, "exposure");
  assert.equal(weakCoauthored.value.claims[0]?.confidence, "low");
  assert.ok(weakCoauthored.value.claims[0]?.limitations.includes("source-risk-fork"));

  for (const mode of /** @type {const} */ (["bot", "unknown"])) {
    const result = deriveEvidenceClaims(
      buildRisk([source(`src/${mode}.ts`, "typescript", mode === "bot" ? 2 : 3)], { mode }),
      request(),
    );
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    assert.equal(result.value.evidence[0]?.authorAssessment.state, mode);
    assert.equal(result.value.evidence[0]?.authorAssessment.subjectRef, null);
    assert.equal(result.value.claims[0]?.state, "insufficient-evidence");
    assert.equal(result.value.claims[0]?.observedDepth, null);
    assert.equal(result.value.claims[0]?.confidence, "low");
    assert.ok(result.value.claims[0]?.limitations.includes("no-attributable-evidence"));
  }
});

test("caps references and limitations without hiding truncation", () => {
  const files = Array.from({ length: 33 }, (_, index) =>
    source(`src/file-${String(index).padStart(2, "0")}.ts`, "typescript", index + 1),
  );
  const result = deriveEvidenceClaims(buildRisk(files), request());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.evidence.length, 33);
  assert.equal(
    result.value.claims[0]?.basis.evidenceRefs.length,
    evidenceClaimDerivationHardLimits.maximumEvidenceReferencesPerClaim,
  );
  assert.ok(result.value.claims[0]?.limitations.includes("evidence-reference-limit-reached"));

  const limited = deriveEvidenceClaims(
    buildRisk([source("generated/component.ts", "typescript", 50)], {
      mode: "coauthored",
      repositoryFlags: ["fork", "template", "tutorial", "uncertain"],
      pathFlags: [
        {
          repositoryId,
          sourceRelativeRef: "generated/component.ts",
          riskFlags: ["generated", "vendored"],
        },
      ],
    }),
    request(),
  );
  assert.equal(limited.ok, true);
  if (!limited.ok) return;
  assert.equal(
    limited.value.evidence[0]?.limitations.length,
    evidenceClaimDerivationHardLimits.maximumLimitations,
  );
  assert.equal(limited.value.evidence[0]?.limitations.at(-1), "additional-limitations-omitted");
});

test("reports changed, unavailable, no-longer-supported, and evidence invalidation", () => {
  const initialRisk = buildRisk([
    source("src/main.ts", "typescript", 1),
    source("src/tool.py", "python", 2),
  ]);
  const initial = deriveEvidenceClaims(initialRisk, request());
  assert.equal(initial.ok, true);
  if (!initial.ok) return;
  const refreshedRisk = buildRisk([
    source("src/main.ts", "typescript", 9),
    source("src/helper.ts", "typescript", 3),
  ]);
  const refreshed = deriveEvidenceClaims(
    refreshedRisk,
    request({ sourceObservedAt: "2026-09-05T12:02:00Z", derivedAt: "2026-09-05T12:03:00Z" }),
    initial.value,
  );
  assert.equal(refreshed.ok, true);
  if (!refreshed.ok) return;
  assert.deepEqual(refreshed.value.invalidation.evidence.map((item) => item.reason).sort(), [
    "fingerprint-changed",
    "source-unavailable",
  ]);
  assert.deepEqual(refreshed.value.invalidation.claims.map((item) => item.reason).sort(), [
    "evidence-invalidated",
    "no-longer-supported",
  ]);
  const stableMainId = initial.value.evidence.find(
    (item) => item.source.sourceRelativeRef === "src/main.ts",
  )?.evidenceId;
  assert.equal(
    refreshed.value.evidence.find((item) => item.source.sourceRelativeRef === "src/main.ts")
      ?.evidenceId,
    stableMainId,
  );
});

test("distinguishes new support and freshness changes from source invalidation", () => {
  const oneSourceRisk = buildRisk([source("src/main.ts", "typescript", 1)]);
  const initial = deriveEvidenceClaims(oneSourceRisk, request());
  assert.equal(initial.ok, true);
  if (!initial.ok) return;
  const moreSupport = deriveEvidenceClaims(
    buildRisk([source("src/main.ts", "typescript", 1), source("src/helper.ts", "typescript", 2)]),
    request({ sourceObservedAt: "2026-09-05T12:02:00Z", derivedAt: "2026-09-05T12:03:00Z" }),
    initial.value,
  );
  assert.equal(moreSupport.ok, true);
  if (!moreSupport.ok) return;
  assert.deepEqual(moreSupport.value.invalidation.evidence, []);
  assert.deepEqual(
    moreSupport.value.invalidation.claims.map((item) => item.reason),
    ["support-changed"],
  );

  const stale = deriveEvidenceClaims(
    oneSourceRisk,
    request({
      derivedAt: "2026-09-06T12:00:00Z",
      staleBefore: "2026-09-06T00:00:00Z",
    }),
    initial.value,
  );
  assert.equal(stale.ok, true);
  if (!stale.ok) return;
  assert.deepEqual(stale.value.invalidation.evidence, []);
  assert.deepEqual(
    stale.value.invalidation.claims.map((item) => item.reason),
    ["freshness-changed"],
  );
  assert.equal(stale.value.claims[0]?.freshness.stale, true);
});

test("unrelated head movement and a newer observation do not invalidate unchanged source", () => {
  const firstRisk = buildRisk([source("src/main.ts", "typescript", 1)]);
  const first = deriveEvidenceClaims(firstRisk, request());
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const movedHeadRisk = buildRisk([source("src/main.ts", "typescript", 1)], {
    commitObjectId: "2".padStart(40, "0"),
  });
  const movedHead = deriveEvidenceClaims(
    movedHeadRisk,
    request({ sourceObservedAt: "2026-09-05T12:02:00Z", derivedAt: "2026-09-05T12:03:00Z" }),
    first.value,
  );
  assert.equal(movedHead.ok, true);
  if (!movedHead.ok) return;
  assert.notEqual(
    first.value.evidence[0]?.source.revisionRef,
    movedHead.value.evidence[0]?.source.revisionRef,
  );
  assert.equal(
    first.value.evidence[0]?.invalidation.fingerprint,
    movedHead.value.evidence[0]?.invalidation.fingerprint,
  );
  assert.deepEqual(movedHead.value.invalidation.evidence, []);
  assert.deepEqual(movedHead.value.invalidation.claims, []);
});

test("forged state, mismatched mappings, backward time, and unknown fields fail closed", () => {
  const risk = buildRisk([source("src/main.ts", "typescript", 1)]);
  const forgedRisk = globalThis.structuredClone(risk);
  assert.deepEqual(deriveEvidenceClaims(forgedRisk, request()), {
    ok: false,
    error: { category: "not-derived", retryable: false },
  });
  assert.deepEqual(
    deriveEvidenceClaims(
      risk,
      request({ repositoryProjects: [{ repositoryId: "repo_other", projectRef }] }),
    ),
    { ok: false, error: { category: "mapping-mismatch", retryable: false } },
  );
  assert.deepEqual(
    deriveEvidenceClaims(
      risk,
      request({ sourceObservedAt: "2026-09-05T12:02:00Z", derivedAt: observedAt }),
    ),
    { ok: false, error: { category: "invalid-input", retryable: false } },
  );
  const withExtra = { ...request(), instructions: "token=FMU_DERIVATION_CANARY" };
  assert.deepEqual(deriveEvidenceClaims(risk, withExtra), {
    ok: false,
    error: { category: "invalid-input", retryable: false },
  });
  const first = deriveEvidenceClaims(risk, request());
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.deepEqual(deriveEvidenceClaims(risk, request(), globalThis.structuredClone(first.value)), {
    ok: false,
    error: { category: "previous-mismatch", retryable: false },
  });
  assert.deepEqual(
    deriveEvidenceClaims(
      risk,
      request({ sourceObservedAt: "2026-09-05T11:00:00Z", derivedAt }),
      first.value,
    ),
    { ok: false, error: { category: "previous-mismatch", retryable: false } },
  );
  assert.doesNotMatch(JSON.stringify(withExtra), /C:\\Users|private\.key/u);
});

test("pure derivation source has no filesystem, process, network, model, or logging authority", async () => {
  const implementation = await readFile(
    new URL("../../packages/community-provider/src/evidence-claim-derivation.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    implementation,
    /node:(?:fs|child_process|net|http|https)|\bfetch\s*\(|\bspawn\s*\(|\bexec\s*\(|console\.|openai|anthropic|model/iu,
  );
});
