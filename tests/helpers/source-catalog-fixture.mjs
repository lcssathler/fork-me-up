import { mkdtemp, realpath, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { runSourceCatalog, sourceCatalogLimits } from "@fork-me-up/community-provider";
import { selectedConfig, selectedFixture, currentTime } from "./selected-github-fixture.mjs";

/** @param {import('node:test').TestContext} context */
export async function catalogFixture(context) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "fmu-catalog-")));
  context.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, "catalog");
  const local = path.join(root, "source");
  await mkdir(directory);
  await mkdir(local);
  await writeFile(path.join(local, "main.ts"), "// SOURCE_CANARY\nexport const value = 1;\n");
  const localConfig = {
    configVersion: "0.1.0",
    authorizedRoots: [{ rootId: "root_local", path: local }],
    repositories: [{ repositoryId: "repo_local", rootId: "root_local", relativePath: "." }],
    limits: {
      maxRepositories: 1,
      maxFilesPerRepository: 100,
      maxBytesPerFile: 65536,
      maxTotalBytesPerRepository: 1048576,
      maxDepth: 16,
      maxDurationMs: 30000,
      maxConcurrency: 1,
    },
  };
  const github = selectedFixture();
  const remoteConfig = selectedConfig();
  remoteConfig.subjectRef = "subject_catalog";
  const config = {
    version: "0.1.0",
    directory,
    subjectRef: "subject_catalog",
    identity: {
      configVersion: "0.1.0",
      subjectRef: "subject_catalog",
      identities: [{ role: "developer", name: "Synthetic Owner", email: "owner@example.test" }],
      annotations: [],
    },
    profile: null,
    projectRef: "project_catalog",
    sources: [
      {
        sourceRef: "source_remote",
        kind: "github",
        languages: ["typescript"],
        configuration: remoteConfig,
      },
    ],
    limits: { ...sourceCatalogLimits },
  };
  const run = async (operation = "select", refresh = false) => {
    const json = JSON.stringify(config);
    return runSourceCatalog(
      json,
      {
        operation: /** @type {'select'|'export'|'delete'} */ (operation),
        languages: ["typescript"],
        refresh,
      },
      { readAuthority: async () => json, githubPort: github.port, clock: () => currentTime },
    );
  };
  return { root, directory, local, localConfig, config, github, run };
}
