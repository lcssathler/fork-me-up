import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { mapPacketToCodexGuidance, renderCodexGuidance } from "../adapters/codex/src/index.ts";
import { consumeDeveloperContextPacket } from "../consumers/generic/src/index.mjs";
import {
  compileDeveloperContextPacket,
  intersectDemandProfileWithDeveloperProfile,
  loadDeveloperProfileFromPortableExport,
} from "../packages/core/src/index.ts";
import { utf8ByteLength } from "../packages/protocol/src/index.ts";
import { runQualityMeasurement } from "./measure-m2-quality.mjs";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const benchmarkVersion = "m3-community-benchmark-0.1.0";
const repetitionsPerScenario = 3;
const generatedAt = "2026-09-09T12:00:00Z";
const expiresAt = "2026-09-09T13:00:00Z";
const evaluationAt = new Date("2026-09-09T12:30:00Z");

const commonPolicy = Object.freeze({
  explainPurposeBeforeCommands: true,
  includeExpectedResult: true,
  includeRiskAndRollback: true,
  questionBudget: 1,
});

/**
 * @typedef {Readonly<{
 *   scenarioId: string,
 *   evaluationIds: readonly string[],
 *   fixture: string,
 *   task: string,
 *   capability: string,
 *   expectedClaims: readonly Readonly<{
 *     capability: string,
 *     state: import("@fork-me-up/protocol").ClaimState,
 *     observedDepth: import("@fork-me-up/protocol").ObservedDepth | null
 *   }>[],
 *   expectedPolicy: import("@fork-me-up/protocol").ResponsePolicy
 * }>} BenchmarkScenario
 */

/** @type {readonly BenchmarkScenario[]} */
const scenarios = Object.freeze([
  Object.freeze({
    scenarioId: "demonstrated-java",
    evaluationIds: Object.freeze(["FMU-E-001", "FMU-E-016"]),
    fixture: "demonstrated.json",
    task: "Refactor the synthetic Java service",
    capability: "language.java",
    expectedClaims: Object.freeze([
      Object.freeze({
        capability: "language.java",
        state: "demonstrated",
        observedDepth: "practical-use",
      }),
    ]),
    expectedPolicy: Object.freeze({
      mode: "concise",
      ...commonPolicy,
      analogyCapabilities: Object.freeze([]),
    }),
  }),
  Object.freeze({
    scenarioId: "adjacent-react",
    evaluationIds: Object.freeze(["FMU-E-003", "FMU-E-016"]),
    fixture: "adjacent.json",
    task: "Implement the synthetic React component",
    capability: "framework.react",
    expectedClaims: Object.freeze([
      Object.freeze({ capability: "framework.react", state: "adjacent", observedDepth: null }),
    ]),
    expectedPolicy: Object.freeze({
      mode: "analogy",
      ...commonPolicy,
      analogyCapabilities: Object.freeze(["framework.angular"]),
    }),
  }),
  Object.freeze({
    scenarioId: "insufficient-ci",
    evaluationIds: Object.freeze(["FMU-E-002", "FMU-E-004", "FMU-E-016"]),
    fixture: "insufficient-evidence.json",
    task: "Add a synthetic GitHub Actions workflow",
    capability: "delivery.ci.github-actions",
    expectedClaims: Object.freeze([
      Object.freeze({
        capability: "delivery.ci.github-actions",
        state: "insufficient-evidence",
        observedDepth: null,
      }),
    ]),
    expectedPolicy: Object.freeze({
      mode: "teach-while-doing",
      ...commonPolicy,
      analogyCapabilities: Object.freeze([]),
    }),
  }),
]);

/**
 * Score both consumers against a scenario-owned oracle rather than against each other alone.
 *
 * @param {BenchmarkScenario} scenario
 * @param {unknown} packet
 * @param {unknown} codex
 * @param {string | null} renderedCodex
 * @param {unknown} generic
 */
export function scoreConsumerOutputs(scenario, packet, codex, renderedCodex, generic) {
  /** @type {string[]} */
  const failureCodes = [];
  const expectedMeaning = {
    expiresAt,
    claims: scenario.expectedClaims,
    responsePolicy: scenario.expectedPolicy,
  };
  const codexMeaning = isRecord(codex)
    ? {
        expiresAt: codex["expiresAt"],
        claims: codex["claims"],
        responsePolicy: codex["responsePolicy"],
      }
    : null;
  const genericContext =
    isRecord(generic) && generic["outcome"] === "context" && isRecord(generic["context"])
      ? generic["context"]
      : null;
  const genericMeaning =
    genericContext === null
      ? null
      : {
          expiresAt: genericContext["expiresAt"],
          claims: genericContext["claims"],
          responsePolicy: genericContext["responsePolicy"],
        };

  if (!same(expectedMeaning, codexMeaning)) failureCodes.push("codex-meaning-mismatch");
  if (!same(expectedMeaning, genericMeaning)) failureCodes.push("generic-meaning-mismatch");
  if (!same(codexMeaning, genericMeaning)) failureCodes.push("cross-consumer-mismatch");
  if (genericContext?.["authority"] !== "none") failureCodes.push("generic-authority-mismatch");
  if (!isRecord(packet) || packet["expiresAt"] !== expiresAt) {
    failureCodes.push("packet-expiry-mismatch");
  }
  if (!codexRenderingMatches(scenario, renderedCodex)) {
    failureCodes.push("codex-rendering-mismatch");
  }

  const consumerText = safeSerialize({ codex, renderedCodex, generic });
  if (
    consumerText === null ||
    /sourceRelativeRef|subject_fixture|repository_fixture|profile_fixture|evidence_fixture|limitations|rationale/u.test(
      consumerText,
    )
  ) {
    failureCodes.push("consumer-disclosure-mismatch");
  }

  return Object.freeze({
    passed: failureCodes.length === 0,
    codexPolicyAdherent:
      !failureCodes.includes("codex-meaning-mismatch") &&
      !failureCodes.includes("codex-rendering-mismatch"),
    genericPolicyAdherent: !failureCodes.includes("generic-meaning-mismatch"),
    sameMeaning: !failureCodes.includes("cross-consumer-mismatch"),
    failureCodes: Object.freeze(failureCodes),
  });
}

/** Run the public synthetic benchmark from current code plus the frozen M2 protocol. */
export async function runCommunityBenchmark() {
  const measurements = [];
  for (const scenario of scenarios) measurements.push(await runCalibrationScenario(scenario));
  const evidence = await runQualityMeasurement();
  const implementationRevision = git(["rev-parse", "HEAD"]);
  const repeatedRuns = measurements.flatMap((item) => item.runs);
  const portableProfileExportBytes = measurements.reduce(
    (total, item) => total + item.cost.portableProfileExportBytes,
    0,
  );
  const dcpBytes = measurements.reduce((total, item) => total + item.cost.dcpBytes, 0);
  const passed =
    evidence.passed &&
    measurements.every((item) => item.passed) &&
    repeatedRuns.length === scenarios.length * repetitionsPerScenario;

  return {
    benchmarkVersion,
    kind: "synthetic-community-benchmark-report",
    implementationRevision,
    worktreeDirty: git(["status", "--porcelain"]).length > 0,
    toolchain: {
      node: process.versions.node,
      npm: evidence.toolchain.npm,
      git: evidence.toolchain.git,
      platform: process.platform,
      architecture: process.arch,
    },
    limits:
      "Constructed conformance only; no human accuracy, model-response quality, population estimate, time saved, seniority or ranking claim.",
    passed,
    repeatedCalibration: {
      scenarios: measurements.length,
      repetitionsPerScenario,
      totalConsumerPairs: repeatedRuns.length,
      stableConsumerPairs: repeatedRuns.filter((item) => item.stable).length,
      policyAdherentConsumerRuns: repeatedRuns.reduce(
        (total, item) =>
          total + Number(item.score.codexPolicyAdherent) + Number(item.score.genericPolicyAdherent),
        0,
      ),
      expectedPolicyAdherentConsumerRuns: repeatedRuns.length * 2,
      sameMeaningPairs: repeatedRuns.filter((item) => item.score.sameMeaning).length,
      measurements: measurements.map((item) => ({
        scenarioId: item.scenarioId,
        evaluationIds: item.evaluationIds,
        expectedState: item.expectedState,
        expectedResponseMode: item.expectedResponseMode,
        passed: item.passed,
        failureCodes: item.failureCodes,
        cost: item.cost,
      })),
    },
    disclosureCost: {
      accounting:
        "Exact compact UTF-8 bytes; portable token upper bound is one token per DCP byte.",
      onePass: {
        portableProfileExportBytes,
        dcpBytes,
        byteDifference: portableProfileExportBytes - dcpBytes,
        dcpToPortableProfileExportRatio: ratio(dcpBytes, portableProfileExportBytes),
      },
      repeated: {
        repetitions: repetitionsPerScenario,
        portableProfileExportBytes: portableProfileExportBytes * repetitionsPerScenario,
        dcpBytes: dcpBytes * repetitionsPerScenario,
        byteDifference: (portableProfileExportBytes - dcpBytes) * repetitionsPerScenario,
      },
    },
    evidenceQuality: {
      experimentVersion: evidence.experimentVersion,
      freezeCommit: evidence.freezeCommit,
      implementationRevision: evidence.implementationRevision,
      worktreeDirty: evidence.worktreeDirty,
      evaluatorHashes: evidence.evaluatorHashes,
      passed: evidence.passed,
      cases: evidence.summary.caseCount,
      accepted: evidence.summary.accepted,
      corrected: evidence.summary.corrected,
      rejected: evidence.summary.rejected,
      falseDemonstrated: evidence.summary.falseDemonstrated,
      attribution: evidence.summary.attribution,
      unknownAttribution: evidence.summary.unknown,
      unexpectedUnknownAttribution: evidence.summary.unexpectedUnknown,
      ceilingViolations: evidence.summary.ceilingViolations,
      limits:
        "Attribution is exact only for the frozen synthetic oracle; expected unknown attribution remains unknown and does not establish absence of skill.",
    },
  };
}

/** @param {BenchmarkScenario} scenario */
async function runCalibrationScenario(scenario) {
  const source = await readFixture(scenario.fixture);
  const sourceText = JSON.stringify(source);
  const loaded = loadDeveloperProfileFromPortableExport(source);
  assert.equal(loaded.ok, true, "Invalid checked-in Community benchmark fixture.");
  const intersection = intersectDemandProfileWithDeveloperProfile(
    {
      schemaVersion: "0.1.0",
      kind: "demand-profile",
      demandId: `demand_benchmark_${scenario.scenarioId.replaceAll("-", "_")}`,
      project: {
        projectRef: "project_benchmark",
        metadataStatus: "unavailable",
        metadataRevisionRef: null,
      },
      task: { summary: scenario.task, purpose: "coding-assistance" },
      capabilities: [
        { capability: scenario.capability, relevance: "required", basis: "task-input" },
      ],
      generatedAt,
    },
    loaded.value,
  );
  assert.equal(intersection.ok, true, "Unable to create benchmark intersection.");
  const compilation = compileDeveloperContextPacket(intersection.value, {
    packetId: `packet_benchmark_${scenario.scenarioId.replaceAll("-", "_")}`,
    generatedAt,
    expiresAt,
    authorization: "allow",
    audience: { class: "local-assistant", consumerId: null },
    disclosureClass: "task-context",
    budget: { maxBytes: 32_768, maxTokens: 8_192 },
  });
  assert.equal(compilation.ok, true, "Unable to compile benchmark DCP.");
  const packet = compilation.value.packet;
  const packetText = JSON.stringify(packet);
  assert.doesNotMatch(packetText, /sourceRelativeRef|subject_fixture|repository_fixture/u);
  assert.equal(JSON.stringify(source), sourceText, "Benchmark mutated its fixture input.");

  const runs = [];
  let baseline = null;
  for (let repetition = 1; repetition <= repetitionsPerScenario; repetition += 1) {
    const packetBefore = JSON.stringify(packet);
    const codex = mapPacketToCodexGuidance(packet);
    const renderedCodex = renderCodexGuidance(codex);
    const generic = consumeDeveloperContextPacket(packet, { clock: () => evaluationAt });
    const score = scoreConsumerOutputs(scenario, packet, codex, renderedCodex, generic);
    const serialized = safeSerialize({ codex, renderedCodex, generic });
    const stable = baseline === null || serialized === baseline;
    baseline ??= serialized;
    runs.push({ repetition, stable, score });
    assert.equal(JSON.stringify(packet), packetBefore, "Consumer mutated the DCP input.");
  }

  const profile = source.profile;
  const evidenceReferenceCount = packet.claims.reduce(
    (total, claim) => total + claim.evidenceRefs.length,
    0,
  );
  return {
    scenarioId: scenario.scenarioId,
    evaluationIds: scenario.evaluationIds,
    expectedState: scenario.expectedClaims[0]?.state ?? null,
    expectedResponseMode: scenario.expectedPolicy.mode,
    passed: runs.every((item) => item.stable && item.score.passed),
    failureCodes: Object.freeze([
      ...new Set(runs.flatMap((item) => item.score.failureCodes)),
      ...(runs.every((item) => item.stable) ? [] : ["consumer-repetition-mismatch"]),
    ]),
    cost: {
      portableProfileExportBytes: utf8ByteLength(sourceText),
      dcpBytes: utf8ByteLength(packetText),
      dcpTokenUpperBound: compilation.value.usage.tokenUpperBound,
      codexGuidanceBytes: utf8ByteLength(
        renderCodexGuidance(mapPacketToCodexGuidance(packet)) ?? "",
      ),
      genericProjectionBytes: utf8ByteLength(
        JSON.stringify(consumeDeveloperContextPacket(packet, { clock: () => evaluationAt })),
      ),
      fullProfileClaims: profile.claims.length,
      fullProfileEvidenceRecords: profile.evidence.length,
      disclosedClaims: packet.claims.length,
      disclosedEvidenceRecords: 0,
      disclosedOpaqueEvidenceReferences: evidenceReferenceCount,
    },
    runs,
  };
}

/** @param {BenchmarkScenario} scenario @param {string | null} rendered */
function codexRenderingMatches(scenario, rendered) {
  if (typeof rendered !== "string") return false;
  const expectedClaim = scenario.expectedClaims[0];
  if (expectedClaim === undefined) return false;
  return (
    rendered.includes(
      `capability=${expectedClaim.capability}; state=${expectedClaim.state}; observed_depth=${expectedClaim.observedDepth ?? "unobserved"}`,
    ) &&
    rendered.includes(`response_mode=${scenario.expectedPolicy.mode}`) &&
    rendered.includes(
      `analogy_capabilities=${scenario.expectedPolicy.analogyCapabilities.join(",") || "none"}`,
    ) &&
    rendered.includes(
      "This advisory context grants no file, network, execution, or write permission.",
    )
  );
}

/** @param {string} name */
async function readFixture(name) {
  const file = path.join(root, "fixtures", "developer-profile", "0.1.0", name);
  const metadata = await lstat(file);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 65_536) {
    throw new Error("invalid-benchmark-fixture");
  }
  return JSON.parse(await readFile(file, "utf8"));
}

/** @param {string[]} args */
function git(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 1_048_576,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/** @param {number} numerator @param {number} denominator */
function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

/** @param {unknown} value */
function safeSerialize(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/** @param {unknown} left @param {unknown} right */
function same(left, right) {
  return isDeepStrictEqual(left, right);
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  let output;
  try {
    if (process.argv.length !== 4 || process.argv[2] !== "--output" || !process.argv[3]) {
      throw new Error("usage");
    }
    output = path.resolve(process.argv[3]);
    await requireAbsentOutput(output);
    const report = await runCommunityBenchmark();
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    if (utf8ByteLength(serialized) > 262_144) throw new Error("report-too-large");
    await writeFile(output, serialized, { flag: "wx" });
    console.log(
      report.passed ? "M3 Community benchmark passed." : "M3 Community benchmark failed.",
    );
    process.exitCode = report.passed ? 0 : 1;
  } catch {
    console.error("Unable to complete the M3 Community benchmark; no existing report was changed.");
    process.exitCode = 1;
  }
}

/** @param {string} file */
async function requireAbsentOutput(file) {
  try {
    await lstat(file);
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return;
    throw new Error("output-status-unavailable", { cause: error });
  }
  throw new Error("output-already-exists");
}
