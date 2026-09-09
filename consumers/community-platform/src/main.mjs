import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { isDeveloperContextPacket, isPortableProfileExport } from "@fork-me-up/protocol";
import { createLocalCommunityRuntime } from "@fork-me-up/community-provider";

const requestedPhase = process.argv[2];
const requestedStateRoot = process.argv[3];
if (!["initial", "updated"].includes(requestedPhase ?? "") || requestedStateRoot === undefined) {
  throw new Error("invalid-invocation");
}
const phase = /** @type {"initial" | "updated"} */ (requestedPhase);
const stateRoot = await validateTestRoot(requestedStateRoot, phase);

const source = path.join(stateRoot, "source");
const store = path.join(stateRoot, "store");
const exportsRoot = path.join(stateRoot, "exports");

if (phase === "initial") {
  await initializeSyntheticSource();
}

const runtimeResult = await createLocalCommunityRuntime(JSON.stringify(configuration()), {
  clock: () => new Date(phase === "initial" ? "2026-09-09T12:00:05Z" : "2026-09-09T12:01:05Z"),
  clearAdapterCache: async () => ({ ok: true }),
  installation: { modules: "available", runtime: "supported" },
});
assert.equal(runtimeResult.ok, true);
if (!runtimeResult.ok) throw new Error("runtime-unavailable");
const runtime = runtimeResult.value;

if (phase === "initial") {
  const refreshed = /** @type {any} */ (
    await runtime.run(JSON.stringify(refresh(null, "2026-09-09T12:00:00Z")))
  );
  assert.equal(refreshed.ok, true);
  assert.equal(refreshed.status, "refreshed");
  assert.equal(refreshed.generation, 0);

  const inspected = /** @type {any} */ (
    await runtime.run(JSON.stringify({ version: "0.1.0", operation: "inspect", claimId: null }))
  );
  assert.equal(inspected.ok, true);
  const claim = inspected.view.find(
    (/** @type {any} */ entry) => entry.projectRef === "project_platform",
  );
  assert.ok(claim);

  const corrected = /** @type {any} */ (
    await runtime.run(
      JSON.stringify({
        version: "0.1.0",
        operation: "reject",
        claimId: claim.claimId,
        expectedGeneration: 0,
        at: "2026-09-09T12:00:01Z",
        summary: "This synthetic assessment is intentionally disputed.",
      }),
    )
  );
  assert.equal(corrected.ok, true);
  assert.equal(corrected.status, "saved");
  assert.equal(corrected.generation, 1);

  const provider = /** @type {any} */ (
    await runtime.run(JSON.stringify(taskRequest("request_platform_initial")))
  );
  assert.equal(provider.ok, true);
  assert.ok(isDeveloperContextPacket(provider.response.data));
  assert.equal(
    provider.response.data.claims.some((/** @type {any} */ entry) => entry.state === "disputed"),
    true,
  );

  const exported = /** @type {any} */ (
    await runtime.run(
      JSON.stringify({
        version: "0.1.0",
        operation: "export",
        at: "2026-09-09T12:00:03Z",
        expectedGeneration: 1,
        exportId: "export_platform_lifecycle",
        destinationDirectory: exportsRoot,
      }),
    )
  );
  assert.equal(exported.ok, true);
  assert.equal(exported.status, "exported");
  assert.equal(typeof exported.fileName, "string");
  const portable = JSON.parse(await readFile(path.join(exportsRoot, exported.fileName), "utf8"));
  assert.ok(isPortableProfileExport(portable));

  emit(["install", "refresh", "correction", "task-context", "export"]);
} else {
  const diagnosed = /** @type {any} */ (
    await runtime.run(
      JSON.stringify({
        version: "0.1.0",
        operation: "doctor",
        at: "2026-09-09T12:01:00Z",
        packet: null,
        maxContextBytes: 32768,
        maxContextTokens: 8192,
      }),
    )
  );
  assert.equal(diagnosed.ok, true);
  assert.equal(diagnosed.status, "diagnosed");
  assert.equal(diagnosed.view.store.generation, 1);

  const refreshed = /** @type {any} */ (
    await runtime.run(JSON.stringify(refresh(1, "2026-09-09T12:01:01Z")))
  );
  assert.equal(refreshed.ok, true);
  assert.equal(refreshed.status, "refreshed");
  assert.equal(refreshed.generation, 2);

  const provider = /** @type {any} */ (
    await runtime.run(JSON.stringify(taskRequest("request_platform_updated")))
  );
  assert.equal(provider.ok, true);
  assert.ok(isDeveloperContextPacket(provider.response.data));
  assert.equal(
    provider.response.data.claims.some((/** @type {any} */ entry) => entry.state === "disputed"),
    true,
  );

  const deleted = /** @type {any} */ (
    await runtime.run(
      JSON.stringify({
        version: "0.1.0",
        operation: "delete",
        confirm: "delete-local-profile",
        cacheScope: "all-local-adapter-caches",
      }),
    )
  );
  assert.equal(deleted.ok, true);
  assert.equal(deleted.status, "deleted");
  assert.deepEqual(await readdir(store), [".community-profile-store.deleted"]);
  assert.match(await readFile(path.join(source, "main.ts"), "utf8"), /SOURCE_CANARY/u);
  const exportedFiles = await readdir(exportsRoot);
  assert.equal(exportedFiles.length, 1);
  const retainedExport = exportedFiles[0];
  assert.ok(retainedExport);
  assert.ok(
    isPortableProfileExport(
      JSON.parse(await readFile(path.join(exportsRoot, retainedExport), "utf8")),
    ),
  );

  emit(["update", "state-reload", "correction-preserved", "delete", "retained-data"]);
}

async function initializeSyntheticSource() {
  for (const directory of [source, store, exportsRoot]) await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(source, "package.json"),
    `${JSON.stringify({ name: "synthetic-platform-source", private: true, type: "module" })}\n`,
    "utf8",
  );
  await writeFile(path.join(source, "main.ts"), "export const SOURCE_CANARY = true;\n", "utf8");
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
    GIT_AUTHOR_DATE: "2026-09-09T11:00:00Z",
    GIT_COMMITTER_DATE: "2026-09-09T11:00:00Z",
    LC_ALL: "C",
    LANG: "C",
    TEMP: stateRoot,
    TMP: stateRoot,
    TMPDIR: stateRoot,
  };
  for (const key of ["SystemRoot", "WINDIR"]) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }
  for (const arguments_ of [
    ["init", "--initial-branch=main"],
    ["add", "--", "."],
    [
      "-c",
      `core.hooksPath=${path.join(stateRoot, "no-hooks")}`,
      "-c",
      "commit.gpgsign=false",
      "-c",
      "user.name=Synthetic Platform User",
      "-c",
      "user.email=platform@example.invalid",
      "commit",
      "-m",
      "synthetic platform fixture",
    ],
  ]) {
    execFileSync("git", arguments_, {
      cwd: source,
      env: environment,
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
      stdio: "ignore",
      windowsHide: true,
    });
  }
}

/** @param {string} requested @param {"initial" | "updated"} selectedPhase */
async function validateTestRoot(requested, selectedPhase) {
  const metadata = await lstat(requested);
  const canonical = await realpath(requested);
  const temporary = await realpath(os.tmpdir());
  const relative = path.relative(temporary, canonical);
  if (
    metadata.isSymbolicLink() ||
    !metadata.isDirectory() ||
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative) ||
    path.basename(canonical) !== "state" ||
    !path.basename(path.dirname(canonical)).startsWith("fmu-community-platform-")
  ) {
    throw new Error("state-root-boundary");
  }
  const marker = path.join(canonical, ".community-platform-lifecycle");
  if (selectedPhase === "initial") {
    if ((await readdir(canonical)).length !== 0) throw new Error("state-root-boundary");
    await writeFile(marker, "synthetic-platform-lifecycle-v1\n", { encoding: "utf8", flag: "wx" });
  } else {
    const markerMetadata = await lstat(marker);
    if (
      markerMetadata.isSymbolicLink() ||
      !markerMetadata.isFile() ||
      (await readFile(marker, "utf8")) !== "synthetic-platform-lifecycle-v1\n"
    ) {
      throw new Error("state-root-boundary");
    }
  }
  return canonical;
}

function nullDevice() {
  return process.platform === "win32" ? "NUL" : "/dev/null";
}

function configuration() {
  return {
    version: "0.1.0",
    sources: {
      configVersion: "0.1.0",
      authorizedRoots: [{ rootId: "root_platform", path: stateRoot }],
      repositories: [
        {
          repositoryId: "repo_platform",
          rootId: "root_platform",
          relativePath: "source",
        },
      ],
      limits: {
        maxRepositories: 1,
        maxFilesPerRepository: 128,
        maxBytesPerFile: 65536,
        maxTotalBytesPerRepository: 524288,
        maxDepth: 8,
        maxDurationMs: 30000,
        maxConcurrency: 1,
      },
    },
    identity: {
      configVersion: "0.1.0",
      subjectRef: "subject_platform",
      identities: [
        {
          role: "developer",
          name: "Synthetic Platform User",
          email: "platform@example.invalid",
        },
      ],
      annotations: [],
    },
    risk: { configVersion: "0.1.0", repositoryAnnotations: [], pathAnnotations: [] },
    refresh: {
      refreshVersion: "0.1.0",
      repositoryProjects: [{ repositoryId: "repo_platform", projectRef: "project_platform" }],
      limits: {
        maxCacheAgeMs: 300000,
        maxCacheBytes: 1048576,
        maxProbeEntries: 1000,
        maxDurationMs: 30000,
        maxCollections: 1,
      },
    },
    store: {
      configVersion: "0.1.0",
      directoryPath: store,
      storeId: "store_platform",
      subjectRef: "subject_platform",
    },
    project: { projectRef: "project_platform", repositoryId: "repo_platform" },
  };
}

/** @param {number | null} expectedGeneration @param {string} at */
function refresh(expectedGeneration, at) {
  return {
    version: "0.1.0",
    operation: "refresh",
    request: {
      refreshVersion: "0.1.0",
      observedAt: at,
      staleBefore: "2026-09-09T11:00:00Z",
      force: false,
    },
    expectedGeneration,
    at,
  };
}

/** @param {string} requestId */
function taskRequest(requestId) {
  return {
    version: "0.1.0",
    operation: "provider",
    request: {
      schemaVersion: "0.1.0",
      kind: "profile-provider-request",
      requestId,
      operation: "get-task-context",
      input: {
        task: "Explain the synthetic TypeScript project.",
        purpose: "coding-assistance",
        maxTokens: 8192,
        requestedCapabilities: ["language.typescript"],
      },
    },
  };
}

/** @param {string[]} cases */
function emit(cases) {
  process.stdout.write(`${JSON.stringify({ kind: "community-platform-phase", phase, cases })}\n`);
}
