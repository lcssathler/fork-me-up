import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createIncrementalRefreshSession,
  nodeFilesystemMetadataPort,
  nodeRepositoryFingerprintPort,
  resolveAuthorizedRepositoryConfig,
  resolveDeveloperIdentityConfig,
  resolveEvidenceSourceRiskConfig,
} from "@fork-me-up/community-provider";

export const head = "a".repeat(40);
const body = Buffer.from(
  `tree ${"b".repeat(40)}\nauthor Unit Person <unit@example.invalid> 1788778800 +0000\ncommitter Unit Person <unit@example.invalid> 1788778800 +0000\n\nMESSAGE_CANARY\n`,
);
/** @type {import("@fork-me-up/community-provider").BoundedGitCommandPort} */
export const mockGit = {
  async run(request) {
    let output = Buffer.from("main.ts\0extra.ts\0");
    if (request.arguments[0] === "rev-list") output = Buffer.from(`${head}\n`);
    if (request.arguments[1] === "--batch-check")
      output = Buffer.from(`${head} commit ${body.byteLength}\n`);
    if (request.arguments[1] === "--batch")
      output = Buffer.concat([
        Buffer.from(`${head} commit ${body.byteLength}\n`),
        body,
        Buffer.from("\n"),
      ]);
    return { ok: true, output };
  },
};

/** @param {import("node:test").TestContext} context @param {boolean} [fakeGit] */
export async function refreshFixture(context, fakeGit = true) {
  // Windows runners may expose TEMP through a short-name alias; fault injection uses canonical paths.
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "fork-me-up-m2-s09-")));
  context.after(async () => rm(root, { recursive: true, force: true }));
  const a = path.join(root, "a");
  const b = path.join(root, "b");
  for (const directory of [a, b]) {
    await mkdir(directory);
    if (fakeGit) {
      await mkdir(path.join(directory, ".git", "objects"), { recursive: true });
      await writeFile(path.join(directory, ".git", "HEAD"), `${head}\n`);
    }
    await writeFile(path.join(directory, "main.ts"), "export const SOURCE_CANARY = 1;\n");
    await writeFile(path.join(directory, "extra.ts"), "export const OTHER_CANARY = 2;\n");
  }
  const config = await resolveAuthorizedRepositoryConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      authorizedRoots: [{ rootId: "root_synthetic", path: root }],
      repositories: ["a", "b"].map((name) => ({
        repositoryId: `repo_${name}`,
        rootId: "root_synthetic",
        relativePath: name,
      })),
      limits: {
        maxRepositories: 2,
        maxFilesPerRepository: 1000,
        maxBytesPerFile: 65536,
        maxTotalBytesPerRepository: 1048576,
        maxDepth: 16,
        maxDurationMs: 30000,
        maxConcurrency: 1,
      },
    }),
  );
  const identity = resolveDeveloperIdentityConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      subjectRef: "subject_synthetic",
      identities: [{ role: "developer", name: "Unit Person", email: "unit@example.invalid" }],
      annotations: [],
    }),
  );
  const risk = resolveEvidenceSourceRiskConfig(
    JSON.stringify({ configVersion: "0.1.0", repositoryAnnotations: [], pathAnnotations: [] }),
  );
  assert.equal(config.ok && identity.ok && risk.ok, true);
  if (!config.ok || !identity.ok || !risk.ok) throw new Error("fixture configuration failed");
  const authorization = config.value;
  const resolvedIdentity = identity.value;
  const resolvedRisk = risk.value;
  /** @type {import("@fork-me-up/community-provider").IncrementalRefreshConfiguration} */
  const settings = {
    refreshVersion: "0.1.0",
    repositoryProjects: ["a", "b"].map((name) => ({
      repositoryId: `repo_${name}`,
      projectRef: `project_${name}`,
    })),
    limits: {
      maxCacheAgeMs: 300000,
      maxCacheBytes: 1048576,
      maxProbeEntries: 10000,
      maxDurationMs: 30000,
      maxCollections: 2,
    },
  };
  const stats = { reads: 0, commands: 0 };
  /** @param {Partial<typeof settings.limits>} [limits] @param {import("@fork-me-up/community-provider").IncrementalRefreshPorts} [ports] */
  function session(limits = {}, ports = {}) {
    const result = createIncrementalRefreshSession(
      authorization,
      resolvedIdentity,
      resolvedRisk,
      JSON.stringify({ ...settings, limits: { ...settings.limits, ...limits } }),
      {
        now: () => 0,
        fingerprintPort: nodeRepositoryFingerprintPort,
        ...ports,
        fileSystemPort: {
          ...(ports.fileSystemPort ?? nodeFilesystemMetadataPort),
          async readFileBounded(...args) {
            stats.reads += 1;
            return (ports.fileSystemPort ?? nodeFilesystemMetadataPort).readFileBounded(...args);
          },
        },
        commandPort: {
          async run(request) {
            stats.commands += 1;
            return (ports.commandPort ?? mockGit).run(request);
          },
        },
      },
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error("session failed");
    return result.value;
  }
  return {
    root,
    a,
    b,
    authorization: config.value,
    identity: identity.value,
    risk: risk.value,
    settings,
    stats,
    session,
  };
}

/** @param {string} [observedAt] @param {boolean} [force] @param {string} [staleBefore] */
export function refreshRequest(
  observedAt = "2026-09-07T12:00:00Z",
  force = false,
  staleBefore = "2026-09-07T11:00:00Z",
) {
  return JSON.stringify({ refreshVersion: "0.1.0", observedAt, staleBefore, force });
}

/** @param {import("@fork-me-up/community-provider").RefreshLocalRepositoriesResult} result */
export function refreshValue(result) {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("refresh failed");
  return result.value;
}
