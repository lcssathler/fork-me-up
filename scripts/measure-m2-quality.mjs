import { execFileSync, spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runQualityCase } from "./m2-quality-runner.mjs";
import { scoreQualityCase } from "./m2-quality-scoring.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const freezeCommit = "3bf29ea6c8ba5671ed673c128acb8d2f8b855db0";
const freezePath = "docs/evaluations/m2-quality-freeze.json";
const samplePath = "docs/evaluations/m2-quality-sample.json";
/** @param {string[]} args */
function git(args) {
  return execFileSync(
    "git",
    ["-c", `safe.directory=${root.replaceAll("\\", "/").replace(/\/$/u, "")}`, ...args],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 10000,
      maxBuffer: 1048576,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();
}
/** @param {string | Uint8Array} value */
const hash = (value) => createHash("sha256").update(value).digest("hex");
/** @param {string} file */
async function boundedFile(file) {
  if (!/^[a-zA-Z0-9_./-]+$/u.test(file) || file.split("/").includes("..") || path.isAbsolute(file))
    throw new Error("invalid-frozen-path");
  const target = path.join(root, file);
  const metadata = await lstat(target);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 524288)
    throw new Error("invalid-frozen-file");
  return readFile(target);
}

/** Run only the integrated, hash-verified synthetic experiment. No snapshot escapes this boundary. */
export async function runQualityMeasurement() {
  const bytes = await boundedFile(freezePath);
  const committed = execFileSync(
    "git",
    [
      "-c",
      `safe.directory=${root.replaceAll("\\", "/").replace(/\/$/u, "")}`,
      "show",
      `${freezeCommit}:${freezePath}`,
    ],
    {
      cwd: root,
      timeout: 10000,
      maxBuffer: 524288,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (hash(bytes) !== hash(committed)) throw new Error("freeze-record-mismatch");
  git(["merge-base", "--is-ancestor", freezeCommit, "HEAD"]);
  const freeze = JSON.parse(bytes.toString("utf8"));
  for (const [file, expected] of Object.entries(freeze.files)) {
    if (hash(await boundedFile(file)) !== expected) throw new Error("frozen-file-mismatch");
  }
  const manifest = JSON.parse((await boundedFile(samplePath)).toString("utf8"));
  if (manifest.experimentVersion !== "m2-quality-0.2.0" || manifest.cases.length !== 48)
    throw new Error("invalid-frozen-sample");
  const implementationRevision = git(["rev-parse", "HEAD"]);
  const npmVersion = execFileSync(
    process.execPath,
    [path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"), "--version"],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 10000,
      maxBuffer: 4096,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();
  if (process.versions.node !== "24.20.0" || npmVersion !== "11.19.0")
    throw new Error("unsupported-measurement-toolchain");
  const worktreeDirty = git(["status", "--porcelain"]).length !== 0;
  /** @type {Record<string,string>} */
  const evaluatorHashes = {};
  for (const name of ["measure-m2-quality", "m2-quality-runner", "m2-quality-scoring"])
    evaluatorHashes[name] = hash(await boundedFile(`scripts/${name}.mjs`));
  /** @type {Array<ReturnType<typeof scoreQualityCase> & {publicChecks:{passed:boolean,failureCodes:string[]},executionFailures:string[]}>} */
  const cases = [];
  const ownerExercises = [];
  for (const definition of manifest.cases) {
    const execution = await runQualityCase(definition, manifest);
    const scored = scoreQualityCase(definition, manifest.fixed, execution.snapshot);
    cases.push({
      ...scored,
      publicChecks: execution.publicChecks,
      executionFailures: execution.failureCodes,
    });
    if (execution.ownerExercise.required)
      ownerExercises.push({ caseId: definition.caseId, ...execution.ownerExercise });
  }
  const invariances = manifest.invariances.map(
    (/** @type {{baseline:string,variant:string}} */ pair) => {
      const baseline = cases.find((item) => item.caseId === pair.baseline)?.actual;
      const variant = cases.find((item) => item.caseId === pair.variant)?.actual;
      return {
        ...pair,
        passed:
          baseline != null &&
          variant != null &&
          JSON.stringify(baseline) === JSON.stringify(variant),
      };
    },
  );
  const control = spawnSync(
    process.execPath,
    ["--test", "--test-reporter=tap", ...manifest.controls],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 180000,
      maxBuffer: 4194304,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const controlText = `${control.stdout ?? ""}\n${control.stderr ?? ""}`;
  /** @param {string} label */
  const count = (label) =>
    Number(new RegExp(`^# ${label} (\\d+)$`, "mu").exec(controlText)?.[1] ?? -1);
  const diagnosticSkip = controlText
    .split(/\r?\n/u)
    .some((line) => /\bskip(?:ped|ping)?\b/iu.test(line) && !/^# skipped 0$/u.test(line));
  const controls = {
    revision: manifest.fixed.controlRevision,
    files: manifest.controls,
    tests: count("tests"),
    passedTests: count("pass"),
    failedTests: count("fail"),
    skippedTests: count("skipped"),
    cancelledTests: count("cancelled"),
    diagnosticSkip,
    passed:
      control.status === 0 &&
      control.error === undefined &&
      count("tests") > 0 &&
      count("fail") === 0 &&
      count("skipped") === 0 &&
      count("cancelled") === 0 &&
      !diagnosticSkip,
  };
  /** @param {number} numerator @param {number} denominator */
  const fraction = (numerator, denominator) => ({
    numerator,
    denominator,
    rate: denominator === 0 ? null : numerator / denominator,
  });
  const accepted = cases.filter((item) => item.outcome === "accepted").length;
  const corrected = cases.filter((item) => item.outcome === "corrected").length;
  const rejected = cases.filter((item) => item.outcome === "rejected").length;
  const falseDemonstrated = cases.filter((item) => item.falseDemonstrated).length;
  const demonstrated = cases.filter((item) => item.actual?.state === "demonstrated").length;
  const actualEvidence = cases.reduce((n, item) => n + item.actualEvidenceCount, 0);
  const unknownEvidence = cases.reduce((n, item) => n + item.unknownEvidenceCount, 0);
  const summary = {
    caseCount: cases.length,
    accepted,
    corrected,
    rejected,
    falseDemonstrated: {
      allCases: fraction(falseDemonstrated, 48),
      demonstratedOutputs: fraction(falseDemonstrated, demonstrated),
      oracleInsufficient: fraction(
        falseDemonstrated,
        manifest.cases.filter(
          (/** @type {any} */ c) => c.expected.state === "insufficient-evidence",
        ).length,
      ),
    },
    correctionNeeded: fraction(corrected + rejected, 48),
    rejection: fraction(rejected, 48),
    attribution: {
      cases: fraction(cases.filter((item) => item.attributionCorrect).length, 48),
      records: fraction(
        cases.reduce((n, item) => n + item.matchedEvidenceCount, 0),
        52,
      ),
      missing: cases.reduce((n, item) => n + item.missingEvidenceCount, 0),
      extra: cases.reduce((n, item) => n + item.extraEvidenceCount, 0),
    },
    unknown: fraction(unknownEvidence, actualEvidence),
    unexpectedUnknown: cases.reduce((n, item) => n + item.unexpectedUnknownCount, 0),
    ceilingViolations: cases.reduce((n, item) => n + item.ceilingViolations, 0),
    byLanguage: manifest.taxonomy.map((/** @type {string} */ capability) => ({
      capability,
      cases: cases.filter((c) => c.capability === capability).length,
      accepted: cases.filter((c) => c.capability === capability && c.outcome === "accepted").length,
    })),
  };
  const passed =
    accepted === 48 &&
    summary.attribution.records.numerator === 52 &&
    invariances.every((/** @type {{passed:boolean}} */ item) => item.passed) &&
    ownerExercises.length === 2 &&
    ownerExercises.every((item) => item.passed) &&
    controls.passed &&
    cases.every((item) => item.publicChecks.passed && item.executionFailures.length === 0);
  return {
    experimentVersion: manifest.experimentVersion,
    kind: "synthetic-evidence-conformance-report",
    freezeCommit,
    implementationRevision,
    worktreeDirty,
    sampleSha256: freeze.files[samplePath],
    freezeSha256: hash(bytes),
    evaluatorHashes,
    toolchain: {
      node: process.versions.node,
      npm: npmVersion,
      git: git(["--version"]),
      platform: process.platform,
      architecture: process.arch,
    },
    limits: "Constructed conformance cases; no population accuracy or human acceptance estimate.",
    passed,
    summary,
    cases,
    invariances,
    ownerExercises,
    controls,
  };
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  let output;
  try {
    if (process.argv.length !== 4 || process.argv[2] !== "--output" || !process.argv[3])
      throw new Error("invalid-arguments");
    output = path.resolve(process.argv[3]);
    const existing = await lstat(output).catch((error) => {
      if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") throw error;
      return null;
    });
    if (existing !== null) throw new Error("output-already-exists");
    const report = await runQualityMeasurement();
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    if (
      Buffer.byteLength(serialized) > 262144 ||
      /FMU_.*CANARY|example\.invalid|Synthetic Developer|Synthetic Bot|Synthetic Other/u.test(
        serialized,
      )
    )
      throw new Error("invalid-report");
    await writeFile(output, serialized, { flag: "wx" });
    console.log(
      report.passed
        ? "Frozen quality measurement passed."
        : "Frozen quality measurement failed; report retained.",
    );
    process.exitCode = report.passed ? 0 : 1;
  } catch {
    if (output !== undefined)
      await writeFile(
        output,
        `${JSON.stringify({ passed: false, reason: "measurement-unavailable" })}\n`,
        { flag: "wx" },
      ).catch(() => {});
    console.error("Quality measurement unavailable or output already exists.");
    process.exitCode = 1;
  }
}
