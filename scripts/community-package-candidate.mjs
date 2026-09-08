import { spawnSync } from "node:child_process";
import { lstatSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  communityPackageDefinitions,
  createCandidateManifest,
  expectedArtifactFiles,
  runCommunityPackageDryRun,
  validatePackResult,
} from "./community-package-dry-run.mjs";
import {
  copyPublicAssets,
  createProtocolCandidateManifest,
  expectedProtocolArtifactFiles,
  validateProtocolCandidateContents,
} from "./protocol-package-candidate.mjs";

const maximumPackOutputBytes = 2 * 1024 * 1024;
const subprocessTimeoutMilliseconds = 30_000;

/** @param {string} root @param {string} candidate */
function ensureContained(root, candidate) {
  const relative = path.relative(root, candidate);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("path-boundary");
  }
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
  ensureContained(repositoryRoot, buildRoot);
  ensureContained(buildRoot, outputRoot);
  removeDirectoryIfPresent(outputRoot);
  mkdirSync(outputRoot, { recursive: true });
}

/** @param {string} directory */
function removeDirectoryIfPresent(directory) {
  try {
    const metadata = lstatSync(directory);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error("output-boundary");
    rmSync(directory, { recursive: true, force: false });
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") throw error;
  }
}

/** @param {string} file @param {unknown} value */
function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function runCommunityPackageCandidate() {
  const repositoryRoot = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
  const stagingRoot = path.join(repositoryRoot, "build", "community-package-staging");
  const outputRoot = path.join(repositoryRoot, "build", "community-package");
  resetOutputRoot(repositoryRoot, outputRoot);
  try {
    runCommunityPackageDryRun({
      retainPackages: true,
      outputDirectory: "community-package-staging",
    });
    const npmCli = process.env["npm_execpath"];
    if (npmCli === undefined) throw new Error("package-manager");

    const packages = communityPackageDefinitions.map((definition) => {
      const packageRoot = path.join(stagingRoot, "packages", definition.slug);
      const protocol = definition.name === "@fork-me-up/protocol";
      const manifest = protocol
        ? createProtocolCandidateManifest()
        : createCandidateManifest(definition);
      const expectedFiles = protocol
        ? expectedProtocolArtifactFiles()
        : expectedArtifactFiles(definition);
      if (protocol) {
        copyPublicAssets(repositoryRoot, packageRoot);
        writeFileSync(
          path.join(packageRoot, "README.md"),
          "# @fork-me-up/protocol\n\nClient-neutral Fork Me Up SDK, public draft schemas, synthetic fixtures and Profile Provider conformance validation. This M3 artifact is private, local and unpublished.\n",
          "utf8",
        );
        writeJson(path.join(packageRoot, "package.json"), manifest);
        validateProtocolCandidateContents(repositoryRoot, packageRoot);
      }
      const packed = spawnSync(
        process.execPath,
        [npmCli, "pack", "--json", "--ignore-scripts", "--pack-destination", outputRoot, "."],
        {
          cwd: packageRoot,
          encoding: "utf8",
          shell: false,
          timeout: subprocessTimeoutMilliseconds,
          maxBuffer: maximumPackOutputBytes,
        },
      );
      if (packed.status !== 0 || packed.error !== undefined) throw new Error("pack");
      return validatePackResult(definition, JSON.parse(packed.stdout), {
        expectedFiles,
        manifest,
        releaseState: "local-installable-private-unpublished",
      });
    });
    const summary = {
      schemaVersion: 1,
      kind: "community-package-candidate",
      releaseState: "local-installable-private-unpublished",
      packages,
    };
    const serialized = JSON.stringify(summary);
    if (
      [repositoryRoot, repositoryRoot.replaceAll("\\", "/")].some((value) =>
        serialized.includes(value),
      )
    ) {
      throw new Error("path-leak");
    }
    writeJson(path.join(outputRoot, "manifest.json"), summary);
    removeDirectoryIfPresent(stagingRoot);
    return summary;
  } catch (error) {
    for (const directory of [outputRoot, stagingRoot]) {
      try {
        removeDirectoryIfPresent(directory);
      } catch {
        // Preserve the bounded build failure rather than replacing it with cleanup detail.
      }
    }
    throw error;
  }
}

const invokedPath = process.argv[1] === undefined ? "" : realpathSync(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = runCommunityPackageCandidate();
    console.log(
      `Community package candidates: ${String(result.packages.length)} local artifacts built.`,
    );
  } catch {
    console.error("Community package candidates failed.");
    process.exitCode = 1;
  }
}
