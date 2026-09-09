import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

const maximumSourceFileBytes = 1024 * 1024;
const maximumTotalSourceBytes = 4 * 1024 * 1024;
const maximumPackOutputBytes = 2 * 1024 * 1024;
const maximumArtifactBytes = 4 * 1024 * 1024;
const maximumArtifactEntries = 256;
const subprocessTimeoutMilliseconds = 30_000;

const protocolSchemas = Object.freeze([
  "schemas/claim/0.1.0.schema.json",
  "schemas/conformance/profile-provider/0.1.0.schema.json",
  "schemas/dcp/0.1.0.schema.json",
  "schemas/demand-profile/0.1.0.schema.json",
  "schemas/evidence/0.1.0.schema.json",
  "schemas/portable-profile-export/0.1.0.schema.json",
  "schemas/profile-provider/0.1.0.schema.json",
]);

export const communityPackageDefinitions = Object.freeze([
  Object.freeze({
    workspace: "packages/protocol",
    name: "@fork-me-up/protocol",
    slug: "fork-me-up-protocol",
    description: "Client-neutral Fork Me Up protocol contracts and validation.",
    dependencies: Object.freeze({ ajv: "8.20.0" }),
    sources: Object.freeze([
      "src/demand-profile.ts",
      "src/developer-context-packet.ts",
      "src/index.ts",
      "src/portable-profile-export.ts",
      "src/provider-conformance.ts",
      "src/profile-provider.ts",
      "src/types.ts",
    ]),
    schemas: protocolSchemas,
  }),
  Object.freeze({
    workspace: "packages/core",
    name: "@fork-me-up/core",
    slug: "fork-me-up-core",
    description: "Client-neutral Fork Me Up domain behavior.",
    dependencies: Object.freeze({ "@fork-me-up/protocol": "0.0.0" }),
    sources: Object.freeze([
      "src/claim-response-policy.ts",
      "src/dcp-compiler.ts",
      "src/demand-profile-intersection.ts",
      "src/immutable.ts",
      "src/index.ts",
    ]),
    schemas: Object.freeze([]),
  }),
  Object.freeze({
    workspace: "packages/community-provider",
    name: "@fork-me-up/community-provider",
    slug: "fork-me-up-community-provider",
    description: "Local client-neutral Fork Me Up Profile Provider.",
    dependencies: Object.freeze({
      "@fork-me-up/core": "0.0.0",
      "@fork-me-up/protocol": "0.0.0",
    }),
    sources: Object.freeze([
      "src/authorized-repository-config.ts",
      "src/bounded-git-command.ts",
      "src/community-profile-store-format.ts",
      "src/demand-profile-producer.ts",
      "src/developer-identity-config.ts",
      "src/evidence-claim-derivation.ts",
      "src/evidence-source-risk-classifier.ts",
      "src/evidence-source-risk-config.ts",
      "src/filesystem-metadata-collector.ts",
      "src/git-authorship-assessment.ts",
      "src/git-identity.ts",
      "src/git-metadata-collector.ts",
      "src/incremental-refresh.ts",
      "src/index.ts",
      "src/local-community-runtime.ts",
      "src/local-fixture-profile-provider.ts",
      "src/local-profile-store-config.ts",
      "src/local-profile-store.ts",
      "src/local-stored-profile-provider.ts",
      "src/owner-profile-diagnostics.ts",
      "src/owner-profile-portability.ts",
      "src/owner-profile-workflow.ts",
      "src/public-history-collector.ts",
      "src/public-history-config.ts",
      "src/repository-fingerprint.ts",
    ]),
    schemas: Object.freeze([]),
  }),
]);

/** @param {(typeof communityPackageDefinitions)[number]} definition @param {string} [version] */
export function createCandidateManifest(definition, version = "0.0.0") {
  const dependencies = Object.fromEntries(
    Object.entries(definition.dependencies).map(([name, dependencyVersion]) => [
      name,
      name.startsWith("@fork-me-up/") ? version : dependencyVersion,
    ]),
  );
  return {
    name: definition.name,
    version,
    description: definition.description,
    private: true,
    license: "Apache-2.0",
    type: "module",
    engines: { node: ">=24.20.0 <25", npm: "11.19.0" },
    exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
    files: ["dist/"],
    dependencies,
  };
}

/** @param {(typeof communityPackageDefinitions)[number]} definition */
export function expectedArtifactFiles(definition) {
  const files = ["LICENSE", "README.md", "package.json"];
  for (const source of definition.sources) {
    const relative = source.replace(/^src\//u, "").replace(/\.ts$/u, "");
    files.push(`dist/${relative}.d.ts`, `dist/${relative}.js`);
  }
  for (const schema of definition.schemas) files.push(`dist/${schema}`);
  return files.sort();
}

/**
 * @param {(typeof communityPackageDefinitions)[number]} definition
 * @param {unknown} value
 * @param {{
 *   expectedFiles?: readonly string[],
 *   manifest?: {version: string, private: boolean, exports: Record<string, unknown>, dependencies: Record<string, string>},
 *   releaseState?: string
 * }} [options]
 */
export function validatePackResult(definition, value, options = {}) {
  if (!Array.isArray(value) || value.length !== 1) throw new Error("pack-result");
  const result = value[0];
  if (typeof result !== "object" || result === null || Array.isArray(result))
    throw new Error("pack-result");
  const record = /** @type {Record<string, unknown>} */ (result);
  const manifest = options.manifest ?? createCandidateManifest(definition);
  if (
    record["name"] !== definition.name ||
    record["version"] !== manifest.version ||
    record["id"] !== `${definition.name}@${manifest.version}` ||
    record["filename"] !== `${definition.slug}-${manifest.version}.tgz`
  )
    throw new Error("pack-identity");
  if (
    typeof record["size"] !== "number" ||
    typeof record["unpackedSize"] !== "number" ||
    typeof record["shasum"] !== "string" ||
    typeof record["integrity"] !== "string" ||
    record["size"] > maximumArtifactBytes ||
    record["unpackedSize"] > maximumArtifactBytes ||
    !Array.isArray(record["files"]) ||
    record["files"].length > maximumArtifactEntries ||
    !Array.isArray(record["bundled"]) ||
    record["bundled"].length !== 0
  )
    throw new Error("pack-result");

  const files = record["files"].map((value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value))
      throw new Error("pack-file");
    const file = /** @type {Record<string, unknown>} */ (value);
    if (
      typeof file["path"] !== "string" ||
      typeof file["size"] !== "number" ||
      typeof file["mode"] !== "number" ||
      file["path"].includes("\\") ||
      path.posix.isAbsolute(file["path"]) ||
      file["path"] === ".." ||
      file["path"].startsWith("../")
    )
      throw new Error("pack-file");
    return { path: file["path"], size: file["size"], mode: file["mode"] };
  });
  const actualPaths = files.map((file) => file.path).sort();
  const expectedPaths = [...(options.expectedFiles ?? expectedArtifactFiles(definition))].sort();
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths))
    throw new Error("pack-allowlist");

  return {
    id: record["id"],
    name: record["name"],
    version: record["version"],
    workspace: definition.workspace,
    releaseState: options.releaseState ?? "private-unpublished",
    private: manifest.private,
    entrypoints: manifest.exports,
    dependencies: manifest.dependencies,
    filename: record["filename"],
    size: record["size"],
    unpackedSize: record["unpackedSize"],
    shasum: record["shasum"],
    integrity: record["integrity"],
    files: files.sort((left, right) => left.path.localeCompare(right.path, "en")),
  };
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
  )
    throw new Error("path-boundary");
}

/** @param {string} file @param {string} root */
function readBoundedRegularFile(file, root) {
  const metadata = lstatSync(file);
  if (metadata.isSymbolicLink() || !metadata.isFile() || metadata.size > maximumSourceFileBytes)
    throw new Error("source-boundary");
  ensureContained(root, realpathSync(file));
  return readFileSync(file);
}

/** @param {string} root @param {string} candidate */
function ensureContained(root, candidate) {
  const relative = path.relative(root, candidate);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    throw new Error("path-boundary");
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
  )
    throw new Error("output-boundary");
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
  mkdirSync(path.join(outputRoot, "packages"), { recursive: true });
  mkdirSync(path.join(outputRoot, "reports"), { recursive: true });
}

/** @param {string} file @param {unknown} value */
function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/**
 * @param {string} repositoryRoot
 * @param {string} packageRoot
 * @param {(typeof communityPackageDefinitions)[number]} definition
 */
function validateArtifactContents(repositoryRoot, packageRoot, definition) {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const privateRoots = [repositoryRoot, repositoryRoot.replaceAll("\\", "/")];
  const userProfile = process.env["USERPROFILE"];
  if (typeof userProfile === "string" && userProfile.length > 3)
    privateRoots.push(userProfile, userProfile.replaceAll("\\", "/"));
  let totalBytes = 0;
  for (const file of expectedArtifactFiles(definition)) {
    const candidate = path.join(packageRoot, ...file.split("/"));
    ensureContained(packageRoot, candidate);
    const bytes = readBoundedRegularFile(candidate, packageRoot);
    totalBytes += bytes.byteLength;
    const text = decoder.decode(bytes);
    if (privateRoots.some((value) => text.includes(value)) || text.includes("../../../schemas/"))
      throw new Error("artifact-disclosure");
  }
  if (totalBytes > maximumArtifactBytes) throw new Error("artifact-limit");
}

/**
 * @param {(typeof communityPackageDefinitions)[number]} definition
 * @param {unknown} manifest
 */
function validateSourceManifest(definition, manifest) {
  const record = /** @type {Record<string, unknown>} */ (manifest);
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    Array.isArray(manifest) ||
    record["name"] !== definition.name ||
    record["version"] !== "0.0.0" ||
    record["private"] !== true ||
    record["license"] !== "Apache-2.0" ||
    record["type"] !== "module" ||
    JSON.stringify(record["engines"]) !==
      JSON.stringify({ node: ">=24.20.0 <25", npm: "11.19.0" }) ||
    JSON.stringify(record["dependencies"] ?? {}) !== JSON.stringify(definition.dependencies)
  )
    throw new Error("source-manifest");
}

/**
 * @param {(typeof communityPackageDefinitions)[number]} definition
 * @param {string} packageRoot
 * @param {string} packagesRoot
 */
function compilerPaths(definition, packageRoot, packagesRoot) {
  /** @type {Record<string, string[]>} */
  const mappings = {};
  for (const dependency of Object.keys(definition.dependencies)) {
    if (!dependency.startsWith("@fork-me-up/")) continue;
    const target = communityPackageDefinitions.find((candidate) => candidate.name === dependency);
    if (target === undefined) throw new Error("package-dependency");
    mappings[dependency] = [
      path
        .relative(packageRoot, path.join(packagesRoot, target.slug, "dist", "index.d.ts"))
        .replaceAll(path.sep, "/"),
    ];
  }
  return mappings;
}

/**
 * @param {string} repositoryRoot
 * @param {string} outputRoot
 * @param {(typeof communityPackageDefinitions)[number]} definition
 */
function buildPackage(repositoryRoot, outputRoot, definition) {
  const packagesRoot = path.join(outputRoot, "packages");
  const packageRoot = path.join(packagesRoot, definition.slug);
  const workspaceRoot = path.join(repositoryRoot, ...definition.workspace.split("/"));
  ensureContained(repositoryRoot, workspaceRoot);
  mkdirSync(path.join(packageRoot, "src"), { recursive: true });

  const sourceManifest = JSON.parse(
    readBoundedRegularFile(path.join(workspaceRoot, "package.json"), repositoryRoot).toString(
      "utf8",
    ),
  );
  validateSourceManifest(definition, sourceManifest);

  let totalSourceBytes = 0;
  for (const source of definition.sources) {
    assertRelativePath(source);
    const sourceFile = path.join(workspaceRoot, ...source.split("/"));
    const destination = path.join(packageRoot, ...source.split("/"));
    ensureContained(workspaceRoot, sourceFile);
    ensureContained(packageRoot, destination);
    let bytes = readBoundedRegularFile(sourceFile, repositoryRoot);
    totalSourceBytes += bytes.byteLength;
    if (definition.schemas.length > 0) {
      const text = bytes.toString("utf8").replaceAll("../../../schemas/", "./schemas/");
      bytes = Buffer.from(text, "utf8");
    }
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, bytes);
  }
  for (const schema of definition.schemas) {
    assertRelativePath(schema);
    const sourceFile = path.join(repositoryRoot, ...schema.split("/"));
    const destination = path.join(packageRoot, "src", ...schema.split("/"));
    ensureContained(repositoryRoot, sourceFile);
    ensureContained(packageRoot, destination);
    const bytes = readBoundedRegularFile(sourceFile, repositoryRoot);
    totalSourceBytes += bytes.byteLength;
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, bytes);
  }
  if (totalSourceBytes > maximumTotalSourceBytes) throw new Error("source-limit");

  const tsconfig = {
    extends: path
      .relative(packageRoot, path.join(repositoryRoot, "tsconfig.base.json"))
      .replaceAll(path.sep, "/"),
    compilerOptions: {
      allowImportingTsExtensions: true,
      declaration: true,
      declarationMap: false,
      noEmit: false,
      outDir: "dist",
      rootDir: "src",
      sourceMap: false,
      rewriteRelativeImportExtensions: true,
      types: ["node"],
      paths: compilerPaths(definition, packageRoot, packagesRoot),
    },
    include: ["src/**/*.ts"],
  };
  writeJson(path.join(packageRoot, "tsconfig.json"), tsconfig);
  const compiler = path.join(repositoryRoot, "node_modules", "typescript", "bin", "tsc");
  const compiled = spawnSync(process.execPath, [compiler, "--project", "tsconfig.json"], {
    cwd: packageRoot,
    encoding: "utf8",
    shell: false,
    timeout: subprocessTimeoutMilliseconds,
    maxBuffer: maximumPackOutputBytes,
  });
  if (compiled.status !== 0 || compiled.error !== undefined) throw new Error("compile");

  rmSync(path.join(packageRoot, "src"), { recursive: true, force: false });
  rmSync(path.join(packageRoot, "tsconfig.json"), { force: false });
  writeFileSync(
    path.join(packageRoot, "LICENSE"),
    readBoundedRegularFile(path.join(repositoryRoot, "LICENSE"), repositoryRoot),
  );
  writeFileSync(
    path.join(packageRoot, "README.md"),
    `# ${definition.name}\n\n${definition.description}\n\nThis is a private, unpublished M3 package candidate generated for local artifact inspection. Public versions and distribution remain separately gated.\n`,
    "utf8",
  );
  writeJson(path.join(packageRoot, "package.json"), createCandidateManifest(definition));
  validateArtifactContents(repositoryRoot, packageRoot, definition);

  const npmCli = process.env["npm_execpath"];
  if (npmCli === undefined) throw new Error("package-manager");
  const packed = spawnSync(
    process.execPath,
    [npmCli, "pack", "--dry-run", "--json", "--ignore-scripts", "."],
    {
      cwd: packageRoot,
      encoding: "utf8",
      shell: false,
      timeout: subprocessTimeoutMilliseconds,
      maxBuffer: maximumPackOutputBytes,
    },
  );
  if (packed.status !== 0 || packed.error !== undefined) throw new Error("pack");
  const report = validatePackResult(definition, JSON.parse(packed.stdout));
  const serialized = JSON.stringify(report);
  const repositoryForms = [repositoryRoot, repositoryRoot.replaceAll("\\", "/")];
  if (repositoryForms.some((value) => serialized.includes(value))) throw new Error("path-leak");
  writeJson(path.join(outputRoot, "reports", `${definition.slug}.json`), report);
  return report;
}

/**
 * @param {{
 *   retainPackages?: boolean,
 *   outputDirectory?: "package-dry-run" | "protocol-package-staging" | "community-package-staging" | "community-platform-initial-staging" | "community-platform-update-staging"
 * }} [options]
 */
export function runCommunityPackageDryRun(options = {}) {
  const repositoryRoot = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
  const outputDirectory = options.outputDirectory ?? "package-dry-run";
  if (
    ![
      "package-dry-run",
      "protocol-package-staging",
      "community-package-staging",
      "community-platform-initial-staging",
      "community-platform-update-staging",
    ].includes(outputDirectory)
  ) {
    throw new Error("output-boundary");
  }
  const outputRoot = path.join(repositoryRoot, "build", outputDirectory);
  resetOutputRoot(repositoryRoot, outputRoot);
  try {
    const packages = communityPackageDefinitions.map((definition) =>
      buildPackage(repositoryRoot, outputRoot, definition),
    );
    if (options.retainPackages !== true) {
      rmSync(path.join(outputRoot, "packages"), { recursive: true, force: false });
    }
    const summary = {
      schemaVersion: 1,
      kind: "community-package-dry-run",
      releaseState: "private-unpublished",
      packages,
    };
    writeJson(path.join(outputRoot, "manifest.json"), summary);
    return summary;
  } catch (error) {
    rmSync(outputRoot, { recursive: true, force: false });
    throw error;
  }
}

const invokedPath = process.argv[1] === undefined ? "" : realpathSync(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = runCommunityPackageDryRun();
    console.log(
      `Community package dry-run: ${String(result.packages.length)} private unpublished candidates inspected.`,
    );
  } catch {
    console.error("Community package dry-run failed.");
    process.exitCode = 1;
  }
}
