import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { refreshFixture } from "./incremental-refresh-fixture.mjs";

/** @param {import('node:test').TestContext} context */
export async function communityFixture(context) {
  const fixture = await refreshFixture(context, false);
  const directories = {
    store: path.join(fixture.root, "store"),
    temporary: path.join(fixture.root, "temporary"),
    exports: path.join(fixture.root, "exports"),
  };
  for (const directory of Object.values(directories)) await mkdir(directory);
  for (const cwd of [fixture.a, fixture.b]) {
    const env = {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: path.join(fixture.root, "missing-global"),
      GIT_TERMINAL_PROMPT: "0",
      GIT_AUTHOR_DATE: "2026-09-07T11:00:00Z",
      GIT_COMMITTER_DATE: "2026-09-07T11:00:00Z",
    };
    for (const args of [
      ["init", "--initial-branch=main"],
      ["add", "--", "."],
      [
        "-c",
        "core.hooksPath=" + path.join(fixture.root, "no-hooks"),
        "-c",
        "commit.gpgsign=false",
        "-c",
        "user.name=Unit Person",
        "-c",
        "user.email=unit@example.invalid",
        "commit",
        "-m",
        "MESSAGE_CANARY",
      ],
    ]) {
      execFileSync("git", args, {
        cwd,
        env,
        encoding: "utf8",
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    }
  }
  const config = {
    version: "0.1.0",
    sources: {
      configVersion: "0.1.0",
      authorizedRoots: [{ rootId: "root_synthetic", path: fixture.root }],
      repositories: ["a", "b"].map((name) => ({
        repositoryId: `repo_${name}`,
        rootId: "root_synthetic",
        relativePath: name,
      })),
      limits: fixture.authorization.limits,
    },
    identity: {
      configVersion: "0.1.0",
      subjectRef: "subject_synthetic",
      identities: [{ role: "developer", name: "Unit Person", email: "unit@example.invalid" }],
      annotations: [],
    },
    risk: { configVersion: "0.1.0", repositoryAnnotations: [], pathAnnotations: [] },
    refresh: fixture.settings,
    store: {
      configVersion: "0.1.0",
      directoryPath: directories.store,
      storeId: "store_synthetic",
      subjectRef: "subject_synthetic",
    },
    project: { projectRef: "project_a", repositoryId: "repo_a" },
  };
  const configPath = path.join(fixture.root, "community.json");
  await writeFile(configPath, JSON.stringify(config));
  const clockPath = path.join(fixture.root, "clock.mjs");
  await writeFile(
    clockPath,
    `const NativeDate = Date; globalThis.Date = class extends NativeDate { constructor(value) { super(value === undefined ? "2026-09-07T12:00:10Z" : value); } static now() { return NativeDate.parse("2026-09-07T12:00:10Z"); } };`,
  );
  assert.ok(config.sources.repositories.length === 2);
  return { ...fixture, ...directories, config, configPath, clockPath };
}
/** @param {number | null} expectedGeneration @param {number} second @param {boolean} [force] */
export function ownerRefresh(expectedGeneration, second, force = false) {
  const at = `2026-09-07T12:00:${String(second).padStart(2, "0")}Z`;
  return {
    version: "0.1.0",
    operation: "refresh",
    expectedGeneration,
    at,
    request: {
      refreshVersion: "0.1.0",
      observedAt: at,
      staleBefore: "2026-09-07T11:00:00Z",
      force,
    },
  };
}
export const communityTask = {
  schemaVersion: "0.1.0",
  kind: "profile-provider-request",
  requestId: "request_synthetic",
  operation: "get-task-context",
  input: {
    task: "TASK_CANARY Explain TypeScript",
    purpose: "coding-assistance",
    maxTokens: 8192,
    requestedCapabilities: ["language.typescript"],
  },
};
