import { spawnSync } from "node:child_process";
import {
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runCommunityPackageCandidate } from "./community-package-candidate.mjs";

const maximumOutputBytes = 2 * 1024 * 1024;
const subprocessTimeoutMilliseconds = 60_000;

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

export function runCommunityCompatibilityMatrix() {
  const repositoryRoot = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
  const outputRoot = path.join(repositoryRoot, "build", "community-compatibility");
  resetOutputRoot(repositoryRoot, outputRoot);
  const consumerRoot = mkdtempSync(path.join(os.tmpdir(), "fmu-community-consumer-"));
  try {
    const candidates = runCommunityPackageCandidate();
    const sourceManifest = JSON.parse(
      readFileSync(
        path.join(repositoryRoot, "consumers", "community-compatibility", "package.json"),
        "utf8",
      ),
    );
    const dependencies = Object.fromEntries(
      Object.keys(sourceManifest.dependencies).map((name) => {
        const candidate = candidates.packages.find((entry) => entry.name === name);
        if (candidate === undefined) throw new Error("candidate-set");
        return [
          name,
          fileReference(
            path.join(repositoryRoot, "build", "community-package", candidate.filename),
          ),
        ];
      }),
    );
    writeJson(path.join(consumerRoot, "package.json"), {
      ...sourceManifest,
      dependencies,
    });

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
    mkdirSync(path.join(consumerRoot, "src"));
    cpSync(
      path.join(repositoryRoot, "consumers", "community-compatibility", "src", "main.mjs"),
      path.join(consumerRoot, "src", "main.mjs"),
    );

    const npmCli = process.env["npm_execpath"];
    if (npmCli === undefined) throw new Error("package-manager");
    const installed = spawnSync(
      process.execPath,
      [npmCli, "ci", "--ignore-scripts", "--offline", "--no-audit", "--no-fund"],
      {
        cwd: consumerRoot,
        encoding: "utf8",
        shell: false,
        timeout: subprocessTimeoutMilliseconds,
        maxBuffer: maximumOutputBytes,
      },
    );
    if (installed.status !== 0 || installed.error !== undefined) throw new Error("install");
    const verified = spawnSync(process.execPath, ["src/main.mjs"], {
      cwd: consumerRoot,
      encoding: "utf8",
      shell: false,
      timeout: subprocessTimeoutMilliseconds,
      maxBuffer: maximumOutputBytes,
    });
    if (verified.status !== 0 || verified.error !== undefined) throw new Error("compatibility");
    const results = /** @type {{kind?: unknown, cases?: unknown}} */ (JSON.parse(verified.stdout));
    const cases = Array.isArray(results.cases)
      ? /** @type {Array<Record<string, unknown>>} */ (results.cases)
      : [];
    if (
      results.kind !== "community-artifact-compatibility-results" ||
      cases.length !== 7 ||
      cases.some(
        (entry) =>
          typeof entry !== "object" ||
          entry === null ||
          entry["outcome"] !== "pass" ||
          typeof entry["boundary"] !== "string" ||
          typeof entry["behavior"] !== "string",
      )
    ) {
      throw new Error("compatibility-result");
    }
    const report = {
      schemaVersion: 1,
      kind: "community-artifact-compatibility-matrix",
      releaseState: "local-installable-private-unpublished",
      packages: candidates.packages.map((candidate) => candidate.id),
      cases,
    };
    const serialized = JSON.stringify(report);
    if (
      [repositoryRoot, repositoryRoot.replaceAll("\\", "/")].some((value) =>
        serialized.includes(value),
      )
    ) {
      throw new Error("path-leak");
    }
    writeJson(path.join(outputRoot, "manifest.json"), report);
    return report;
  } catch (error) {
    try {
      rmSync(outputRoot, { recursive: true, force: false });
    } catch {
      // Preserve the bounded compatibility failure rather than cleanup detail.
    }
    throw error;
  } finally {
    rmSync(consumerRoot, { recursive: true, force: true });
  }
}

/** @param {string} left @param {string} right */
function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

const invokedPath = process.argv[1] === undefined ? "" : realpathSync(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = runCommunityCompatibilityMatrix();
    console.log(`Community compatibility matrix: ${String(result.cases.length)} cases passed.`);
  } catch {
    console.error("Community compatibility matrix failed.");
    process.exitCode = 1;
  }
}
