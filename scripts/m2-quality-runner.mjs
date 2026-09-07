import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assessGitAuthorship,
  classifyEvidenceSourceRisk,
  collectFilesystemMetadata,
  collectGitMetadata,
  createLocalStoredProfileProvider,
  deriveEvidenceClaims,
  loadLocalProfileStore,
  resolveAuthorizedRepositoryConfig,
  resolveDeveloperIdentityConfig,
  resolveEvidenceSourceRiskConfig,
  resolveLocalProfileStoreConfig,
  runOwnerDiagnostics,
  runOwnerProfileOperation,
  saveOwnerDerivation,
} from "@fork-me-up/community-provider";
import { isDeveloperContextPacket, isProfileProviderResponse } from "@fork-me-up/protocol";

/** @typedef {typeof import('../docs/evaluations/m2-quality-sample.json')} Manifest */
/** @typedef {Manifest['cases'][number]} CaseDefinition */
/** @typedef {import('@fork-me-up/community-provider').EvidenceClaimDerivationSnapshot} Snapshot */
/** @typedef {import('@fork-me-up/community-provider').ResolvedLocalProfileStoreConfig} Store */
/** @typedef {import('@fork-me-up/community-provider').CommunityProfileStore} Stored */
/** @typedef {{passed: boolean, failureCodes: string[]}} CheckResult */

const outputLimit = 1_048_576;
let running = false;

/**
 * Execute one frozen recipe. Snapshots are private caller input, never report data.
 * Calls are serialized because direct library stdout/stderr is captured for disclosure checks.
 * @param {CaseDefinition} definition
 * @param {Manifest} manifest
 * @returns {Promise<{snapshot: Snapshot|null, publicChecks: CheckResult, ownerExercise: CheckResult & {required:boolean}, failureCodes:string[]}>}
 */
export async function runQualityCase(definition, manifest) {
  /** @type {Snapshot|null} */
  let snapshot = null;
  const required = manifest.ownerExercises.includes(definition.caseId);
  const publicChecks = { passed: false, failureCodes: /** @type {string[]} */ ([]) };
  const ownerExercise = { required, passed: !required, failureCodes: /** @type {string[]} */ ([]) };
  /** @type {string[]} */
  const failureCodes = [];
  if (running) {
    return {
      snapshot,
      publicChecks: { passed: false, failureCodes: ["runner-busy"] },
      ownerExercise: { required, passed: !required, failureCodes: required ? ["not-reached"] : [] },
      failureCodes: ["runner-busy"],
    };
  }
  running = true;
  const capture = captureOutput();
  let stage = "setup-failed";
  let root = "";
  let temporaryParent = "";
  let rootIdentity = "";
  try {
    temporaryParent = await realpath(tmpdir());
    root = await mkdtemp(path.join(temporaryParent, "fork-me-up-m2-quality-"));
    root = await realpath(root);
    rootIdentity = identity(await lstat(root));
    ensure(isDirectTemporaryChild(temporaryParent, root));
    const sources = path.join(root, "sources");
    const template = path.join(root, "empty-template");
    const hooks = path.join(root, "empty-hooks");
    const storeDirectory = path.join(root, "store");
    for (const directory of [sources, template, hooks, storeDirectory]) await mkdir(directory);
    const fixed = manifest.fixed;
    const repositories = [
      { repositoryId: fixed.repositoryId, projectRef: fixed.projectRef, relativePath: "primary" },
      ...(definition.duplicatePeer
        ? [
            {
              repositoryId: fixed.peerRepositoryId,
              projectRef: fixed.peerProjectRef,
              relativePath: "peer",
            },
          ]
        : []),
    ];
    let sourceCommit = "";
    for (const repository of repositories) {
      const directory = path.join(sources, repository.relativePath);
      await mkdir(directory);
      const environment = gitEnvironment(root, definition, fixed.commitAt);
      const settings = [
        "-c",
        `core.hooksPath=${hooks}`,
        "-c",
        "core.autocrlf=false",
        "-c",
        "core.safecrlf=false",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "core.fsmonitor=false",
        "-c",
        "core.attributesFile=" + nullDevice(),
        "-c",
        "commit.cleanup=verbatim",
      ];
      const git = /** @param {string[]} args */ (args) =>
        privateGit(directory, [...settings, ...args], environment);
      git(["init", "--template=" + template, "--object-format=sha1", "--initial-branch=main"]);
      await writeRecipeFile(directory, definition.initialReadme);
      git(["add", "--", definition.initialReadme.path]);
      git(["commit", "--cleanup=verbatim", "-m", fixed.initialCommitMessage]);
      for (const file of definition.files) await writeRecipeFile(directory, file);
      if (definition.sourceCommitted) {
        git(["add", "--", ...definition.files.map((file) => file.path)]);
        git(["commit", "--cleanup=verbatim", "-m", definition.commitMessage]);
        const commit = git(["rev-parse", "HEAD"]).trim();
        ensure(/^[a-f0-9]{40}$/u.test(commit));
        if (repository.repositoryId === fixed.repositoryId) sourceCommit = commit;
      }
    }
    stage = "configuration-failed";
    const authorization = unwrap(
      await resolveAuthorizedRepositoryConfig(
        JSON.stringify({
          configVersion: "0.1.0",
          authorizedRoots: [{ rootId: "root_quality", path: sources }],
          repositories: repositories.map(({ repositoryId, relativePath }) => ({
            repositoryId,
            rootId: "root_quality",
            relativePath,
          })),
          limits: fixed.collectionLimits,
        }),
      ),
    );
    const identities = unwrap(
      resolveDeveloperIdentityConfig(
        JSON.stringify({
          configVersion: "0.1.0",
          subjectRef: fixed.subjectRef,
          identities: definition.identities,
          annotations: definition.annotations.map((kind) => ({
            repositoryId: fixed.repositoryId,
            commitObjectId: sourceCommit,
            kind,
          })),
        }),
      ),
    );
    const riskConfiguration = unwrap(
      resolveEvidenceSourceRiskConfig(
        JSON.stringify({
          configVersion: "0.1.0",
          repositoryAnnotations:
            definition.repositoryRiskFlags.length === 0
              ? []
              : [{ repositoryId: fixed.repositoryId, riskFlags: definition.repositoryRiskFlags }],
          pathAnnotations: [],
        }),
      ),
    );
    stage = "filesystem-collection-failed";
    const filesystem = unwrap(await collectFilesystemMetadata(authorization));
    stage = "git-collection-failed";
    const gitMetadata = unwrap(await collectGitMetadata(authorization));
    stage = "authorship-failed";
    const authorship = unwrap(assessGitAuthorship(gitMetadata, identities));
    stage = "source-risk-failed";
    const risk = unwrap(
      classifyEvidenceSourceRisk(filesystem, gitMetadata, authorship, riskConfiguration),
    );
    /** @type {import('@fork-me-up/community-provider').EvidenceClaimDerivationRequest} */
    const derivationRequest = {
      kind: "evidence-claim-derivation-request",
      derivationVersion: "0.1.0",
      sourceObservedAt: fixed.observedAt,
      derivedAt: fixed.observedAt,
      staleBefore: fixed.staleBefore,
      repositoryProjects: repositories.map(({ repositoryId, projectRef }) => ({
        repositoryId,
        projectRef,
      })),
    };
    stage = "derivation-failed";
    snapshot = unwrap(deriveEvidenceClaims(risk, derivationRequest));
    stage = "store-configuration-failed";
    const store = unwrap(
      await resolveLocalProfileStoreConfig(
        JSON.stringify({
          configVersion: "0.1.0",
          directoryPath: storeDirectory,
          storeId: "store_quality",
          subjectRef: fixed.subjectRef,
        }),
      ),
    );
    stage = "initial-persistence-failed";
    ensure((await saveOwnerDerivation(store, snapshot, saveRequest(null, fixed.observedAt))).ok);
    const initial = await loadedStore(store);
    ensure(JSON.stringify(initial.profile.claims) === JSON.stringify(snapshot.claims));
    ensure(JSON.stringify(initial.profile.evidence) === JSON.stringify(snapshot.evidence));
    const secrets = disclosureNeedles(definition, manifest, root);
    publicChecks.failureCodes.push(
      ...(await publicExercise(
        store,
        definition,
        manifest,
        snapshot,
        "2026-09-07T12:00:01Z",
        secrets,
      )),
    );
    publicChecks.passed = publicChecks.failureCodes.length === 0;
    if (required) {
      stage = "owner-exercise-failed";
      try {
        const primary = snapshot.claims.filter(
          (claim) =>
            claim.projectRef === fixed.projectRef && claim.capability === definition.capability,
        );
        ensure(primary.length === 1);
        const original = primary[0];
        ensure(original !== undefined);
        let current = initial;
        let prior = snapshot;
        const steps = [
          {
            operation: "correct",
            at: "2026-09-07T12:01:00Z",
            refreshAt: "2026-09-07T12:02:00Z",
            summary: "Synthetic owner correction.",
            count: 1,
          },
          {
            operation: "reject",
            at: "2026-09-07T12:03:00Z",
            refreshAt: "2026-09-07T12:04:00Z",
            summary: "Synthetic owner rejection.",
            count: 2,
          },
        ];
        for (const step of steps) {
          ensure(
            (
              await runOwnerProfileOperation(
                store,
                JSON.stringify({
                  version: "0.1.0",
                  operation: step.operation,
                  claimId: original.claimId,
                  expectedGeneration: current.internalState.generation,
                  at: step.at,
                  summary: step.summary,
                }),
              )
            ).ok,
          );
          current = await loadedStore(store);
          verifyOwnerState(current, original, snapshot, step.count);
          ownerExercise.failureCodes.push(
            ...(await publicExercise(
              store,
              definition,
              manifest,
              snapshot,
              plusSecond(step.at),
              secrets,
              current,
            )),
          );
          const refreshed = unwrap(
            deriveEvidenceClaims(risk, { ...derivationRequest, derivedAt: step.refreshAt }, prior),
          );
          ensure(
            refreshed.invalidation.evidence.length === 0 &&
              refreshed.invalidation.claims.length === 0,
          );
          ensure(
            JSON.stringify(refreshed.evidence) ===
              JSON.stringify(
                snapshot.evidence.map((item) => ({
                  ...item,
                  freshness: { ...item.freshness, collectedAt: step.refreshAt },
                })),
              ),
          );
          ensure(
            JSON.stringify(refreshed.claimFingerprints) ===
              JSON.stringify(snapshot.claimFingerprints),
          );
          ensure(
            (
              await saveOwnerDerivation(
                store,
                refreshed,
                saveRequest(current.internalState.generation, step.refreshAt),
              )
            ).ok,
          );
          current = await loadedStore(store);
          verifyOwnerState(current, original, snapshot, step.count);
          ownerExercise.failureCodes.push(
            ...(await publicExercise(
              store,
              definition,
              manifest,
              snapshot,
              plusSecond(step.refreshAt),
              secrets,
              current,
            )),
          );
          prior = refreshed;
        }
        ownerExercise.passed = ownerExercise.failureCodes.length === 0;
      } catch {
        ownerExercise.failureCodes.push("owner-exercise-failed");
      }
    }
    if (capture.exceeded() || leaks(capture.text(), secrets)) {
      publicChecks.failureCodes.push(
        capture.exceeded() ? "output-limit-exceeded" : "public-output-disclosure",
      );
      publicChecks.passed = false;
    }
  } catch {
    failureCodes.push(stage);
  } finally {
    capture.restore();
    if (root !== "") {
      try {
        const entry = await lstat(root);
        ensure(entry.isDirectory() && !entry.isSymbolicLink());
        ensure(identity(entry) === rootIdentity && (await realpath(root)) === root);
        ensure(isDirectTemporaryChild(temporaryParent, root));
        await rm(root, { recursive: true, force: false });
      } catch {
        failureCodes.push("cleanup-failed");
      }
    }
    running = false;
  }
  if (!publicChecks.passed && publicChecks.failureCodes.length === 0)
    publicChecks.failureCodes.push("not-reached");
  if (required && !ownerExercise.passed && ownerExercise.failureCodes.length === 0)
    ownerExercise.failureCodes.push("not-reached");
  return { snapshot, publicChecks, ownerExercise, failureCodes };
}

/** @param {Store} store @param {CaseDefinition} definition @param {Manifest} manifest @param {Snapshot} initial @param {string} at @param {string[]} secrets @param {Stored} [ownerState] */
async function publicExercise(store, definition, manifest, initial, at, secrets, ownerState) {
  /** @type {string[]} */
  const failures = [];
  try {
    const provider = createLocalStoredProfileProvider(store, {
      projectRef: manifest.fixed.projectRef,
      repositoryId: manifest.fixed.repositoryId,
      clock: () => new Date(at),
      createId: (kind) => `${kind}_quality`,
      maxObservationAgeMs: 86_400_000,
    });
    const response = await provider.invoke({
      schemaVersion: "0.1.0",
      kind: "profile-provider-request",
      requestId: "request_quality",
      operation: "get-task-context",
      input: {
        task: "Explain this project language.",
        purpose: "coding-assistance",
        maxTokens: 8192,
        requestedCapabilities: [definition.capability],
      },
    });
    ensure(
      isProfileProviderResponse(response) &&
        response.error === null &&
        isDeveloperContextPacket(response.data),
    );
    const packet = response.data;
    ensure(Buffer.byteLength(JSON.stringify(response), "utf8") <= 32_768);
    const allowed = new Map(
      initial.claims
        .filter((claim) => claim.projectRef === manifest.fixed.projectRef)
        .map((claim) => [claim.claimId, claim]),
    );
    const peerEvidence = new Set(
      initial.evidence
        .filter((item) => item.source.repositoryRef === manifest.fixed.peerRepositoryId)
        .map((item) => item.evidenceId),
    );
    ensure(
      packet.claims.every(
        (claim) =>
          allowed.has(claim.claimId) &&
          claim.capability === definition.capability &&
          claim.scope === "project" &&
          claim.evidenceRefs.every((ref) => !peerEvidence.has(ref)),
      ),
    );
    if (ownerState === undefined) {
      ensure(packet.claims.length === allowed.size);
      ensure(packet.claims.every((claim) => claim.state === allowed.get(claim.claimId)?.state));
    } else {
      const archived = new Set(ownerState.profile.corrections.map((item) => item.targetClaimRef));
      ensure(
        packet.claims.every((claim) => claim.state === "disputed" && !archived.has(claim.claimId)),
      );
    }
    const doctor = await runOwnerDiagnostics(
      store,
      JSON.stringify({
        version: "0.1.0",
        operation: "doctor",
        at,
        packet,
        maxContextBytes: 32_768,
        maxContextTokens: 8192,
      }),
    );
    const evidence = await runOwnerDiagnostics(
      store,
      JSON.stringify({
        version: "0.1.0",
        operation: "get-capability-evidence",
        capability: definition.capability,
        limit: 8,
      }),
    );
    ensure(doctor.ok && evidence.ok);
    ensure(
      record(doctor.view) &&
        record(doctor.view["store"]) &&
        doctor.view["store"]["schema"] === "valid",
    );
    ensure(record(doctor.view["context"]) && doctor.view["context"]["state"] === "within-budget");
    ensure(
      record(evidence.view) &&
        Array.isArray(evidence.view["claims"]) &&
        evidence.view["claims"].length > 0,
    );
    ensure(!leaks(JSON.stringify([response, doctor, evidence]), secrets));
  } catch {
    failures.push(
      ownerState === undefined
        ? "public-projection-or-diagnostics-failed"
        : "owner-public-projection-failed",
    );
  }
  return failures;
}

/** @param {Stored} current @param {import('@fork-me-up/protocol').Claim} original @param {Snapshot} snapshot @param {number} count */
function verifyOwnerState(current, original, snapshot, count) {
  ensure(current.profile.corrections.length === count);
  const effective = current.profile.claims.find((claim) => claim.claimId === original.claimId);
  ensure(
    effective !== undefined && effective.state === "disputed" && effective.confidence === "low",
  );
  ensure(effective.observedDepth === original.observedDepth && effective.basis.kind === "dispute");
  const correction = current.profile.corrections.find(
    (item) => item.correctionId === effective.basis.correctionRef,
  );
  ensure(
    correction !== undefined && correction.kind === (count === 1 ? "adjustment" : "rejection"),
  );
  const archived = current.profile.claims.find(
    (claim) => claim.claimId === correction.targetClaimRef,
  );
  ensure(archived !== undefined && archived.claimId !== effective.claimId);
  ensure(
    JSON.stringify(archived) ===
      JSON.stringify({
        ...original,
        claimId: archived.claimId,
        basis: { ...original.basis, evidenceRefs: archived.basis.evidenceRefs },
      }),
  );
  ensure(archived.basis.evidenceRefs.length === original.basis.evidenceRefs.length);
  ensure(
    JSON.stringify(archived.basis.evidenceRefs) === JSON.stringify(effective.basis.evidenceRefs),
  );
  for (const [index, item] of current.profile.corrections.entries()) {
    ensure(item.targetClaimRef === archived.claimId && item.capability === original.capability);
    ensure(item.kind === (index === 0 ? "adjustment" : "rejection"));
    ensure(
      item.summary === (index === 0 ? "Synthetic owner correction." : "Synthetic owner rejection."),
    );
    ensure(item.createdAt === (index === 0 ? "2026-09-07T12:01:00Z" : "2026-09-07T12:03:00Z"));
  }
  for (const ref of archived.basis.evidenceRefs) {
    const historical = current.profile.evidence.find((item) => item.evidenceId === ref);
    ensure(historical !== undefined);
    ensure(
      snapshot.evidence.some(
        (item) =>
          JSON.stringify({ ...item, evidenceId: historical.evidenceId }) ===
          JSON.stringify(historical),
      ),
    );
  }
}

/** @param {Store} store */
async function loadedStore(store) {
  const result = await loadLocalProfileStore(store);
  ensure(result.ok && result.value !== null && result.status === "active");
  return result.value;
}

/** @param {number|null} expectedGeneration @param {string} at */
function saveRequest(expectedGeneration, at) {
  return JSON.stringify({ version: "0.1.0", expectedGeneration, at });
}
/** @param {string} at */
function plusSecond(at) {
  return new Date(Date.parse(at) + 1000).toISOString().replace(".000Z", "Z");
}
/** @template T @param {{ok:true, value:T}|{ok:false}} result @returns {T} */
function unwrap(result) {
  ensure(result.ok);
  return result.value;
}
/** @param {unknown} condition @returns {asserts condition} */
function ensure(condition) {
  if (!condition) throw new Error("Quality case failed.");
}
/** @param {unknown} value @returns {value is Record<string, unknown>} */
function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {string} directory @param {{path:string, content:string}} file */
async function writeRecipeFile(directory, file) {
  ensure(
    file.path.length <= 2048 &&
      !/[\\:]/u.test(file.path) &&
      !Array.from(file.path).some((character) => character.charCodeAt(0) < 32),
  );
  ensure(
    file.path
      .split("/")
      .every(
        (segment) =>
          segment !== "" && segment !== "." && segment !== ".." && segment.toLowerCase() !== ".git",
      ),
  );
  const destination = path.resolve(directory, file.path);
  ensure(contained(directory, destination) && Buffer.byteLength(file.content, "utf8") <= 65_536);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, file.content, { encoding: "utf8", flag: "wx" });
}

/** @param {string} root @param {CaseDefinition} definition @param {string} at @returns {NodeJS.ProcessEnv} */
function gitEnvironment(root, definition, at) {
  /** @type {NodeJS.ProcessEnv} */
  const environment = {
    PATH: process.env["PATH"] ?? "",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_SYSTEM: nullDevice(),
    GIT_CONFIG_GLOBAL: nullDevice(),
    GIT_ATTR_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_NO_LAZY_FETCH: "1",
    GIT_PROTOCOL_FROM_USER: "0",
    GIT_AUTHOR_NAME: definition.author.name,
    GIT_AUTHOR_EMAIL: definition.author.email,
    GIT_AUTHOR_DATE: at,
    GIT_COMMITTER_NAME: definition.committer.name,
    GIT_COMMITTER_EMAIL: definition.committer.email,
    GIT_COMMITTER_DATE: at,
    LC_ALL: "C",
    LANG: "C",
    TEMP: root,
    TMP: root,
    TMPDIR: root,
  };
  for (const key of ["SystemRoot", "WINDIR"])
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  return environment;
}
function nullDevice() {
  return process.platform === "win32" ? "NUL" : "/dev/null";
}
/** Native setup output is a private buffer like collected Git metadata, never emitted or returned. @param {string} directory @param {string[]} args @param {NodeJS.ProcessEnv} environment */
function privateGit(directory, args, environment) {
  return execFileSync("git", args, {
    cwd: directory,
    env: environment,
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: outputLimit,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
/** @param {string} parent @param {string} child */
function contained(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}
/** @param {string} parent @param {string} child */
function isDirectTemporaryChild(parent, child) {
  return (
    path.dirname(child) === parent &&
    path.basename(child).startsWith("fork-me-up-m2-quality-") &&
    contained(parent, child)
  );
}
/** @param {import('node:fs').Stats} entry */
function identity(entry) {
  return `${entry.dev}:${entry.ino}`;
}

/** @param {CaseDefinition} definition @param {Manifest} manifest @param {string} root */
function disclosureNeedles(definition, manifest, root) {
  return [
    ...new Set([
      "FMU_SOURCE_CANARY",
      "FMU_SECOND_SOURCE_CANARY",
      definition.author.name,
      definition.author.email,
      definition.committer.name,
      definition.committer.email,
      ...definition.identities.flatMap((item) => [item.name, item.email]),
      ...[definition.commitMessage, manifest.fixed.initialCommitMessage].flatMap((message) =>
        message.split("\n").filter(Boolean),
      ),
      ...[
        root,
        root.replaceAll("\\", "/"),
        ...["sources", "store"].map((name) => path.join(root, name)),
      ].flatMap((value) => [value, JSON.stringify(value).slice(1, -1)]),
    ]),
  ];
}
/** @param {string} value @param {string[]} needles */
function leaks(value, needles) {
  return needles.some((needle) => value.includes(needle));
}

function captureOutput() {
  /** @type {Buffer[]} */
  const chunks = [];
  let bytes = 0;
  let exceeded = false;
  const originals = [process.stdout.write, process.stderr.write];
  /** @param {string|Uint8Array} chunk @param {BufferEncoding|((error?:Error|null)=>void)} [encodingOrCallback] @param {(error?:Error|null)=>void} [callback] */
  const write = (chunk, encodingOrCallback, callback) => {
    const encoding = typeof encodingOrCallback === "string" ? encodingOrCallback : "utf8";
    bytes += typeof chunk === "string" ? Buffer.byteLength(chunk, encoding) : chunk.byteLength;
    if (bytes <= outputLimit)
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk, encoding) : Buffer.from(chunk));
    else exceeded = true;
    const done = typeof encodingOrCallback === "function" ? encodingOrCallback : callback;
    if (done !== undefined) process.nextTick(() => done());
    return true;
  };
  process.stdout.write = write;
  process.stderr.write = write;
  return {
    text: () => Buffer.concat(chunks).toString("utf8"),
    exceeded: () => exceeded,
    restore() {
      [process.stdout.write, process.stderr.write] = /** @type {[typeof write, typeof write]} */ (
        originals
      );
    },
  };
}
