import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  communityPlatformCandidateVersions,
  runCommunityPackageCandidate,
} from "./community-package-candidate.mjs";

const maximumOutputBytes = 2 * 1024 * 1024;
const subprocessTimeoutMilliseconds = 120_000;
const packageNames = Object.freeze([
  "@fork-me-up/protocol",
  "@fork-me-up/core",
  "@fork-me-up/community-provider",
]);
const expectedPhaseCases = Object.freeze({
  initial: Object.freeze(["install", "refresh", "correction", "task-context", "export"]),
  updated: Object.freeze([
    "update",
    "state-reload",
    "correction-preserved",
    "delete",
    "retained-data",
  ]),
});

/**
 * @param {Record<string, {link?: boolean, dependencies?: Record<string, string>}>} lockPackages
 * @param {Record<string, string>} dependencies
 */
function collectLockedDependencyEntries(lockPackages, dependencies) {
  /** @type {Record<string, {link?: boolean, dependencies?: Record<string, string>}>} */
  const selected = {};
  const pending = Object.keys(dependencies).sort(compareText);
  while (pending.length > 0) {
    const dependency = pending.shift();
    if (dependency === undefined) throw new Error("dependency-lock");
    if (dependency.startsWith("@fork-me-up/")) continue;
    const lockPath = `node_modules/${dependency}`;
    if (Object.hasOwn(selected, lockPath)) continue;
    const entry = lockPackages[lockPath];
    if (entry === undefined || entry.link === true) throw new Error("dependency-lock");
    selected[lockPath] = entry;
    pending.push(...Object.keys(entry.dependencies ?? {}));
  }
  return selected;
}

/** @param {string} value */
function fileReference(value) {
  return `file:${path.resolve(value).replaceAll("\\", "/")}`;
}

/** @param {string} file @param {unknown} value */
function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/** @param {string} repositoryRoot @param {string} outputRoot */
function resetOutputRoot(repositoryRoot, outputRoot) {
  const buildRoot = path.join(repositoryRoot, "build");
  mkdirSync(buildRoot, { recursive: true });
  const metadata = lstatSync(buildRoot);
  if (
    metadata.isSymbolicLink() ||
    !metadata.isDirectory() ||
    realpathSync(buildRoot) !== path.resolve(buildRoot)
  ) {
    throw new Error("output-boundary");
  }
  const relative = path.relative(buildRoot, outputRoot);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("output-boundary");
  }
  try {
    rmSync(outputRoot, { recursive: true, force: false });
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") throw error;
  }
  mkdirSync(outputRoot, { recursive: true });
}

/**
 * @param {string} repositoryRoot
 * @param {string} consumerRoot
 * @param {ReturnType<typeof runCommunityPackageCandidate>} candidates
 * @param {string} candidateDirectory
 */
function writeConsumerManifests(repositoryRoot, consumerRoot, candidates, candidateDirectory) {
  const sourceManifest = JSON.parse(
    readFileSync(
      path.join(repositoryRoot, "consumers", "community-platform", "package.json"),
      "utf8",
    ),
  );
  const dependencies = Object.fromEntries(
    packageNames.map((name) => {
      const candidate = candidates.packages.find((entry) => entry.name === name);
      if (candidate === undefined) throw new Error("candidate-set");
      return [
        name,
        fileReference(path.join(repositoryRoot, "build", candidateDirectory, candidate.filename)),
      ];
    }),
  );
  writeJson(path.join(consumerRoot, "package.json"), { ...sourceManifest, dependencies });

  const repositoryLock = JSON.parse(
    readFileSync(path.join(repositoryRoot, "package-lock.json"), "utf8"),
  );
  if (repositoryLock.lockfileVersion !== 3) throw new Error("dependency-lock");
  const externalDependencies = Object.assign(
    {},
    ...candidates.packages.map((candidate) =>
      collectLockedDependencyEntries(repositoryLock.packages, candidate.dependencies),
    ),
  );
  const localPackages = Object.fromEntries(
    candidates.packages.map((candidate) => [
      `node_modules/${candidate.name}`,
      {
        version: candidate.version,
        resolved: dependencies[String(candidate.name)],
        integrity: candidate.integrity,
        license: "Apache-2.0",
        dependencies: candidate.dependencies,
        engines: { node: ">=24.20.0 <25", npm: "11.19.0" },
      },
    ]),
  );
  writeJson(path.join(consumerRoot, "package-lock.json"), {
    name: sourceManifest.name,
    version: sourceManifest.version,
    lockfileVersion: 3,
    requires: true,
    packages: {
      "": {
        name: sourceManifest.name,
        version: sourceManifest.version,
        license: sourceManifest.license,
        dependencies,
      },
      ...localPackages,
      ...externalDependencies,
    },
  });
}

/** @param {string[]} arguments_ @param {string} cwd */
function runNpm(arguments_, cwd) {
  const npmCli = process.env["npm_execpath"];
  if (npmCli === undefined) throw new Error("package-manager");
  const result = spawnSync(process.execPath, [npmCli, ...arguments_], {
    cwd,
    encoding: "utf8",
    shell: false,
    timeout: subprocessTimeoutMilliseconds,
    maxBuffer: maximumOutputBytes,
  });
  if (result.status !== 0 || result.error !== undefined) throw new Error("package-manager");
}

/** @param {string} consumerRoot @param {"initial" | "updated"} phase @param {string} stateRoot */
function runPhase(consumerRoot, phase, stateRoot) {
  const result = spawnSync(process.execPath, ["src/main.mjs", phase, stateRoot], {
    cwd: consumerRoot,
    encoding: "utf8",
    shell: false,
    timeout: subprocessTimeoutMilliseconds,
    maxBuffer: maximumOutputBytes,
  });
  if (result.status !== 0 || result.error !== undefined || result.stderr !== "") {
    throw new Error("lifecycle-phase");
  }
  const value = JSON.parse(result.stdout);
  if (
    value.kind !== "community-platform-phase" ||
    value.phase !== phase ||
    JSON.stringify(value.cases) !== JSON.stringify(expectedPhaseCases[phase])
  ) {
    throw new Error("lifecycle-result");
  }
  return value.cases;
}

/** @param {string} consumerRoot @param {string} rejectedRoot */
function verifyRejectedStateRoot(consumerRoot, rejectedRoot) {
  const result = spawnSync(process.execPath, ["src/main.mjs", "initial", rejectedRoot], {
    cwd: consumerRoot,
    encoding: "utf8",
    shell: false,
    timeout: subprocessTimeoutMilliseconds,
    maxBuffer: maximumOutputBytes,
  });
  if (result.status === 0 || result.error !== undefined) throw new Error("state-root-boundary");
}

/** @param {string} consumerRoot @param {string} version */
function verifyInstalledVersions(consumerRoot, version) {
  for (const name of packageNames) {
    const manifest = JSON.parse(
      readFileSync(
        path.join(consumerRoot, "node_modules", ...name.split("/"), "package.json"),
        "utf8",
      ),
    );
    if (manifest.name !== name || manifest.version !== version || manifest.private !== true) {
      throw new Error("installed-candidate");
    }
  }
}

export function runCommunityPlatformLifecycle() {
  const repositoryRoot = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
  const outputRoot = path.join(repositoryRoot, "build", "community-platform-lifecycle");
  resetOutputRoot(repositoryRoot, outputRoot);
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "fmu-community-platform-"));
  const consumerRoot = path.join(temporaryRoot, "consumer");
  const stateRoot = path.join(temporaryRoot, "state");
  mkdirSync(path.join(consumerRoot, "src"), { recursive: true });
  mkdirSync(stateRoot, { recursive: true });
  cpSync(
    path.join(repositoryRoot, "consumers", "community-platform", "src", "main.mjs"),
    path.join(consumerRoot, "src", "main.mjs"),
  );
  try {
    const initial = runCommunityPackageCandidate({
      version: communityPlatformCandidateVersions.initial,
    });
    writeConsumerManifests(repositoryRoot, consumerRoot, initial, "community-platform-initial");
    runNpm(["ci", "--ignore-scripts", "--offline", "--no-audit", "--no-fund"], consumerRoot);
    verifyInstalledVersions(consumerRoot, communityPlatformCandidateVersions.initial);
    verifyRejectedStateRoot(consumerRoot, repositoryRoot);
    const initialCases = runPhase(consumerRoot, "initial", stateRoot);

    const update = runCommunityPackageCandidate({
      version: communityPlatformCandidateVersions.update,
    });
    writeConsumerManifests(repositoryRoot, consumerRoot, update, "community-platform-update");
    runNpm(["ci", "--ignore-scripts", "--offline", "--no-audit", "--no-fund"], consumerRoot);
    verifyInstalledVersions(consumerRoot, communityPlatformCandidateVersions.update);
    const updateCases = runPhase(consumerRoot, "updated", stateRoot);

    runNpm(
      ["uninstall", "--ignore-scripts", "--offline", "--no-audit", "--no-fund", ...packageNames],
      consumerRoot,
    );
    if (
      packageNames.some((name) =>
        existsSync(path.join(consumerRoot, "node_modules", ...name.split("/"))),
      )
    ) {
      throw new Error("uninstall");
    }
    const uninstalledManifest = JSON.parse(
      readFileSync(path.join(consumerRoot, "package.json"), "utf8"),
    );
    const uninstalledLock = JSON.parse(
      readFileSync(path.join(consumerRoot, "package-lock.json"), "utf8"),
    );
    if (
      Object.keys(uninstalledManifest.dependencies ?? {}).length !== 0 ||
      Object.keys(uninstalledLock.packages[""]?.dependencies ?? {}).length !== 0
    ) {
      throw new Error("uninstall");
    }
    const storeEntries = readdirSync(path.join(stateRoot, "store"));
    const exportEntries = readdirSync(path.join(stateRoot, "exports"));
    if (
      JSON.stringify(storeEntries) !== JSON.stringify([".community-profile-store.deleted"]) ||
      exportEntries.length !== 1 ||
      !readFileSync(path.join(stateRoot, "source", "main.ts"), "utf8").includes("SOURCE_CANARY")
    ) {
      throw new Error("retained-data");
    }

    const report = {
      schemaVersion: 1,
      kind: "community-platform-lifecycle",
      releaseState: "private-unpublished",
      platform: process.platform,
      architecture: process.arch,
      packageManager: "npm@11.19.0",
      install: "lockfile-derived-offline-without-lifecycle-scripts",
      candidates: [
        communityPlatformCandidateVersions.initial,
        communityPlatformCandidateVersions.update,
      ],
      cases: ["state-root-boundary", ...initialCases, ...updateCases, "uninstall"],
    };
    const serialized = JSON.stringify(report);
    if (
      [
        repositoryRoot,
        temporaryRoot,
        repositoryRoot.replaceAll("\\", "/"),
        temporaryRoot.replaceAll("\\", "/"),
      ].some((value) => serialized.includes(value))
    ) {
      throw new Error("path-leak");
    }
    writeJson(path.join(outputRoot, "manifest.json"), report);
    return report;
  } catch (error) {
    try {
      rmSync(outputRoot, { recursive: true, force: false });
    } catch {
      // Preserve the bounded lifecycle failure rather than replacing it with cleanup detail.
    }
    throw error;
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

/** @param {string} left @param {string} right */
function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

const invokedPath = process.argv[1] === undefined ? "" : realpathSync(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = runCommunityPlatformLifecycle();
    console.log(
      `Community platform lifecycle: ${String(result.cases.length)} cases passed on ${result.platform}.`,
    );
  } catch {
    console.error("Community platform lifecycle failed.");
    process.exitCode = 1;
  }
}
