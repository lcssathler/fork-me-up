import { spawnSync } from "node:child_process";
import { lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";
import {
  communityPackageDefinitions,
  createCandidateManifest,
  expectedArtifactFiles,
  runCommunityPackageDryRun,
  validatePackResult,
} from "./community-package-dry-run.mjs";

const maximumAssetFileBytes = 1024 * 1024;
const maximumTotalAssetBytes = 4 * 1024 * 1024;
const maximumPackOutputBytes = 2 * 1024 * 1024;
const subprocessTimeoutMilliseconds = 30_000;

const publicSchemaFiles = Object.freeze([
  "schemas/claim/0.1.0.schema.json",
  "schemas/conformance/profile-provider/0.1.0.schema.json",
  "schemas/dcp/0.1.0.schema.json",
  "schemas/demand-profile/0.1.0.schema.json",
  "schemas/evidence/0.1.0.schema.json",
  "schemas/portable-profile-export/0.1.0.schema.json",
  "schemas/profile-provider/0.1.0.schema.json",
]);

const fixtureGroups = Object.freeze({
  "fixtures/claim/0.1.0": Object.freeze([
    "invalid/adjacent-without-rationale.json",
    "invalid/declaration-without-reference.json",
    "invalid/demonstrated-without-evidence.json",
    "invalid/dispute-without-original-evidence.json",
    "invalid/does-not-know.json",
    "invalid/project-without-reference.json",
    "invalid/raw-evidence-field.json",
    "invalid/state-basis-mismatch.json",
    "invalid/unsupported-version.json",
    "valid/adjacent.json",
    "valid/demonstrated.json",
    "valid/disputed.json",
    "valid/insufficient-evidence.json",
    "valid/self-declared.json",
  ]),
  "fixtures/conformance/profile-provider/0.1.0": Object.freeze([
    "invalid/request-id-mismatch.json",
    "invalid/unadvertised-success.json",
    "invalid/unnamespaced-extension.json",
    "invalid/unsafe-error-field.json",
    "invalid/unsupported-version.json",
    "valid/complete.json",
    "valid/subset-errors.json",
  ]),
  "fixtures/dcp/0.1.0": Object.freeze([
    "invalid/invalid-claim-state.json",
    "invalid/missing-purpose.json",
    "invalid/raw-evidence.json",
    "invalid/unsafe-policy.json",
    "invalid/unsupported-version.json",
    "valid/claim-states.json",
    "valid/insufficient-evidence.json",
    "valid/minimal.json",
  ]),
  "fixtures/demand-profile/0.1.0": Object.freeze([
    "invalid/available-without-revision.json",
    "invalid/dcp-envelope.json",
    "invalid/duplicate-capability.json",
    "invalid/missing-task.json",
    "invalid/policy-bearing-field.json",
    "invalid/profile-derived-basis.json",
    "invalid/project-basis-without-metadata.json",
    "invalid/raw-project-metadata.json",
    "invalid/unsupported-version.json",
    "valid/task-and-project.json",
    "valid/task-only.json",
    "valid/uncertain.json",
  ]),
  "fixtures/evidence/0.1.0": Object.freeze([
    "invalid/claim-not-observation.json",
    "invalid/collected-before-observation.json",
    "invalid/inconsistent-authorship.json",
    "invalid/missing-invalidation.json",
    "invalid/unsafe-source-reference.json",
    "invalid/unsupported-version.json",
    "valid/attributed.json",
    "valid/coauthored.json",
    "valid/minimal.json",
  ]),
  "fixtures/portable-profile-export/0.1.0": Object.freeze([
    "invalid/dangling-evidence-reference.json",
    "invalid/internal-store-envelope.json",
    "invalid/missing-exclusions.json",
    "invalid/sensitive-fields.json",
    "invalid/unsupported-version.json",
    "valid/complete.json",
    "valid/empty.json",
  ]),
  "fixtures/profile-provider/0.1.0": Object.freeze([
    "invalid/client-specific-field.json",
    "invalid/credential-field.json",
    "invalid/duplicate-operation.json",
    "invalid/missing-capability-discovery.json",
    "invalid/task-context-without-disclosure.json",
    "invalid/unsupported-version.json",
    "valid/local-complete.json",
    "valid/remote-subset.json",
  ]),
});

export const publicProtocolAssetFiles = Object.freeze([
  ...publicSchemaFiles,
  ...Object.entries(fixtureGroups).flatMap(([root, files]) =>
    files.map((file) => `${root}/${file}`),
  ),
]);

const protocolDefinition = /** @type {(typeof communityPackageDefinitions)[number]} */ (
  communityPackageDefinitions.find((definition) => definition.name === "@fork-me-up/protocol")
);
if (protocolDefinition === undefined) throw new Error("protocol-definition");

export function createProtocolCandidateManifest() {
  const base = createCandidateManifest(protocolDefinition);
  /** @type {Record<string, string | {types: string, import: string}>} */
  const exports = {
    ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
    "./conformance/profile-provider": {
      types: "./dist/provider-conformance.d.ts",
      import: "./dist/provider-conformance.js",
    },
  };
  for (const schema of publicSchemaFiles) {
    exports[`./${schema.replace(/\.schema\.json$/u, "")}`] = `./dist/${schema}`;
  }
  for (const asset of publicProtocolAssetFiles) {
    if (asset.startsWith("fixtures/") && asset.endsWith(".json")) {
      exports[`./${asset}`] = `./dist/${asset}`;
    }
  }
  exports["./package.json"] = "./package.json";
  return { ...base, exports };
}

export function expectedProtocolArtifactFiles() {
  return [
    ...new Set([
      ...expectedArtifactFiles(protocolDefinition),
      ...publicProtocolAssetFiles.map((file) => `dist/${file}`),
    ]),
  ].sort((left, right) => left.localeCompare(right, "en"));
}

/** @param {string} root @param {string} candidate */
function ensureContained(root, candidate) {
  const relative = path.relative(root, candidate);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("path-boundary");
  }
}

/** @param {string} value */
function assertRelativePath(value) {
  if (
    value.length === 0 ||
    value.includes("\\") ||
    path.posix.isAbsolute(value) ||
    value === ".." ||
    value.startsWith("../") ||
    value.includes("/../")
  ) {
    throw new Error("path-boundary");
  }
}

/** @param {string} file @param {string} root */
function readBoundedRegularFile(file, root) {
  const metadata = lstatSync(file);
  if (metadata.isSymbolicLink() || !metadata.isFile() || metadata.size > maximumAssetFileBytes) {
    throw new Error("asset-boundary");
  }
  ensureContained(root, realpathSync(file));
  return readFileSync(file);
}

/** @param {string} repositoryRoot @param {string} outputRoot */
function resetOutputRoot(repositoryRoot, outputRoot) {
  const buildRoot = path.join(repositoryRoot, "build");
  mkdirSync(buildRoot, { recursive: true });
  const buildMetadata = lstatSync(buildRoot);
  if (
    buildMetadata.isSymbolicLink() ||
    !buildMetadata.isDirectory() ||
    realpathSync(buildRoot) !== path.resolve(buildRoot)
  ) {
    throw new Error("output-boundary");
  }
  ensureContained(repositoryRoot, buildRoot);
  ensureContained(buildRoot, outputRoot);
  try {
    const metadata = lstatSync(outputRoot);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error("output-boundary");
    ensureContained(buildRoot, realpathSync(outputRoot));
    rmSync(outputRoot, { recursive: true, force: false });
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") throw error;
  }
  mkdirSync(outputRoot, { recursive: true });
}

/** @param {string} file @param {unknown} value */
function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/** @param {string} directory */
function removeDirectoryIfPresent(directory) {
  try {
    rmSync(directory, { recursive: true, force: false });
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") throw error;
  }
}

/** @param {string} repositoryRoot @param {string} packageRoot */
function copyPublicAssets(repositoryRoot, packageRoot) {
  let totalBytes = 0;
  for (const asset of publicProtocolAssetFiles) {
    assertRelativePath(asset);
    const source = path.join(repositoryRoot, ...asset.split("/"));
    const destination = path.join(packageRoot, "dist", ...asset.split("/"));
    ensureContained(repositoryRoot, source);
    ensureContained(packageRoot, destination);
    const bytes = readBoundedRegularFile(source, repositoryRoot);
    totalBytes += bytes.byteLength;
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, bytes);
  }
  if (totalBytes > maximumTotalAssetBytes) throw new Error("asset-limit");
}

/** @param {string} repositoryRoot @param {string} packageRoot */
function validateCandidateContents(repositoryRoot, packageRoot) {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const privateRoots = [repositoryRoot, repositoryRoot.replaceAll("\\", "/")];
  const userProfile = process.env["USERPROFILE"];
  if (typeof userProfile === "string" && userProfile.length > 3) {
    privateRoots.push(userProfile, userProfile.replaceAll("\\", "/"));
  }
  let totalBytes = 0;
  for (const file of expectedProtocolArtifactFiles()) {
    const candidate = path.join(packageRoot, ...file.split("/"));
    ensureContained(packageRoot, candidate);
    const bytes = readBoundedRegularFile(candidate, packageRoot);
    totalBytes += bytes.byteLength;
    const text = decoder.decode(bytes);
    if (privateRoots.some((value) => text.includes(value)) || text.includes("../../../schemas/")) {
      throw new Error("artifact-disclosure");
    }
  }
  if (totalBytes > maximumTotalAssetBytes) throw new Error("artifact-limit");
}

export function runProtocolPackageCandidate() {
  const repositoryRoot = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
  const dryRunRoot = path.join(repositoryRoot, "build", "protocol-package-staging");
  const outputRoot = path.join(repositoryRoot, "build", "protocol-package");
  resetOutputRoot(repositoryRoot, outputRoot);
  try {
    runCommunityPackageDryRun({
      retainPackages: true,
      outputDirectory: "protocol-package-staging",
    });
    const packageRoot = path.join(dryRunRoot, "packages", protocolDefinition.slug);
    copyPublicAssets(repositoryRoot, packageRoot);
    writeFileSync(
      path.join(packageRoot, "README.md"),
      "# @fork-me-up/protocol\n\nClient-neutral Fork Me Up SDK, public draft schemas, synthetic fixtures and Profile Provider conformance validation. This M3 artifact is private, local and unpublished.\n",
      "utf8",
    );
    const manifest = createProtocolCandidateManifest();
    writeJson(path.join(packageRoot, "package.json"), manifest);
    validateCandidateContents(repositoryRoot, packageRoot);

    const npmCli = process.env["npm_execpath"];
    if (npmCli === undefined) throw new Error("package-manager");
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
    const report = validatePackResult(protocolDefinition, JSON.parse(packed.stdout), {
      expectedFiles: expectedProtocolArtifactFiles(),
      manifest,
      releaseState: "local-installable-private-unpublished",
    });
    const summary = {
      schemaVersion: 1,
      kind: "protocol-package-candidate",
      releaseState: "local-installable-private-unpublished",
      supportedDraftVersions: {
        claim: ["0.1.0"],
        conformance: ["0.1.0"],
        dcp: ["0.1.0"],
        demandProfile: ["0.1.0"],
        evidence: ["0.1.0"],
        portableProfileExport: ["0.1.0"],
        profileProvider: ["0.1.0"],
      },
      package: report,
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
    removeDirectoryIfPresent(dryRunRoot);
    return summary;
  } catch (error) {
    for (const directory of [outputRoot, dryRunRoot]) {
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
    const result = runProtocolPackageCandidate();
    console.log(
      `Protocol package candidate: ${result.package.filename} built for local installation.`,
    );
  } catch {
    console.error("Protocol package candidate failed.");
    process.exitCode = 1;
  }
}
