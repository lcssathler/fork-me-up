import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assessGitAuthorship,
  classifyEvidenceSourceRisk,
  collectFilesystemMetadata,
  collectGitMetadata,
  resolveAuthorizedRepositoryConfig,
  resolveDeveloperIdentityConfig,
  resolveEvidenceSourceRiskConfig,
} from "@fork-me-up/community-provider";

/** @param {string} repository @param {string[]} arguments_ @param {Record<string, string>} [environment] */
function git(repository, arguments_, environment = {}) {
  return execFileSync("git", arguments_, {
    cwd: repository,
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0", ...environment },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }).trim();
}

test("real bounded collectors feed conservative source-risk classification without leaking content", async (context) => {
  const sandbox = await mkdtemp(path.join(tmpdir(), "fork-me-up-m2-s05-"));
  const root = path.join(sandbox, "authorized");
  const repository = path.join(root, "repository");
  await mkdir(path.join(repository, "generated"), { recursive: true });
  await mkdir(path.join(repository, "vendor"), { recursive: true });
  await mkdir(path.join(repository, "templates"), { recursive: true });
  await mkdir(path.join(repository, "tutorial"), { recursive: true });
  await mkdir(path.join(repository, "src"), { recursive: true });
  context.after(async () => rm(sandbox, { recursive: true, force: true }));

  const duplicateCanary = "export const DUPLICATE_SOURCE_CANARY = true;\n";
  await Promise.all([
    writeFile(path.join(repository, "generated", "client.ts"), "GENERATED_SOURCE_CANARY\n"),
    writeFile(path.join(repository, "vendor", "library.ts"), "VENDORED_SOURCE_CANARY\n"),
    writeFile(path.join(repository, "templates", "base.ts"), "TEMPLATE_SOURCE_CANARY\n"),
    writeFile(path.join(repository, "tutorial", "example.ts"), "TUTORIAL_SOURCE_CANARY\n"),
    writeFile(path.join(repository, "src", "copy-one.ts"), duplicateCanary),
    writeFile(path.join(repository, "src", "copy-two.ts"), duplicateCanary),
  ]);
  git(repository, ["init", "--initial-branch=main"]);
  git(repository, ["add", "--", "."]);
  git(
    repository,
    [
      "-c",
      "user.name=Synthetic Developer",
      "-c",
      "user.email=developer@example.invalid",
      "commit",
      "-m",
      "SOURCE_MESSAGE_CANARY",
    ],
    {
      GIT_AUTHOR_DATE: "2026-09-05T12:00:00+00:00",
      GIT_COMMITTER_DATE: "2026-09-05T12:00:00+00:00",
    },
  );

  const authorization = await resolveAuthorizedRepositoryConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      authorizedRoots: [{ rootId: "root_synthetic", path: root }],
      repositories: [
        { repositoryId: "repo_synthetic", rootId: "root_synthetic", relativePath: "repository" },
      ],
      limits: {
        maxRepositories: 1,
        maxFilesPerRepository: 100,
        maxBytesPerFile: 65_536,
        maxTotalBytesPerRepository: 1_048_576,
        maxDepth: 8,
        maxDurationMs: 30_000,
        maxConcurrency: 1,
      },
    }),
  );
  assert.equal(authorization.ok, true);
  if (!authorization.ok) return;
  const [filesystem, gitMetadata] = await Promise.all([
    collectFilesystemMetadata(authorization.value),
    collectGitMetadata(authorization.value),
  ]);
  assert.equal(filesystem.ok, true);
  assert.equal(gitMetadata.ok, true);
  if (!filesystem.ok || !gitMetadata.ok) return;

  const identities = resolveDeveloperIdentityConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      subjectRef: "subject_synthetic",
      identities: [
        { role: "developer", name: "Synthetic Developer", email: "developer@example.invalid" },
      ],
      annotations: [],
    }),
  );
  assert.equal(identities.ok, true);
  if (!identities.ok) return;
  const authorship = assessGitAuthorship(gitMetadata.value, identities.value);
  assert.equal(authorship.ok, true);
  if (!authorship.ok) return;
  const riskConfig = resolveEvidenceSourceRiskConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      repositoryAnnotations: [{ repositoryId: "repo_synthetic", riskFlags: ["fork"] }],
      pathAnnotations: [],
    }),
  );
  assert.equal(riskConfig.ok, true);
  if (!riskConfig.ok) return;

  const result = classifyEvidenceSourceRisk(
    filesystem.value,
    gitMetadata.value,
    authorship.value,
    riskConfig.value,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const classifiedRepository = result.value.repositories[0];
  assert.ok(classifiedRepository);
  const records = new Map(
    classifiedRepository.records.map((record) => [record.sourceRelativeRef, record]),
  );
  const generated = records.get("generated/client.ts");
  const vendored = records.get("vendor/library.ts");
  const template = records.get("templates/base.ts");
  const tutorial = records.get("tutorial/example.ts");
  const duplicate = records.get("src/copy-one.ts");
  assert.ok(generated);
  assert.ok(vendored);
  assert.ok(template);
  assert.ok(tutorial);
  assert.ok(duplicate);
  assert.ok(generated.riskFlags.includes("generated"));
  assert.ok(vendored.riskFlags.includes("vendored"));
  assert.ok(template.riskFlags.includes("template"));
  assert.ok(tutorial.riskFlags.includes("tutorial"));
  assert.ok(duplicate.riskFlags.includes("duplicated"));
  assert.ok([...records.values()].every((record) => record.riskFlags.includes("fork")));
  assert.ok([...records.values()].every((record) => record.supportLevel === "reduced"));
  assert.ok([...records.values()].every((record) => record.strengthCeiling === "weak"));
  assert.ok(
    [...records.values()].every((record) => record.standaloneDemonstratedDepthAllowed === false),
  );

  const serialized = JSON.stringify(result);
  for (const canary of [
    "SOURCE_CANARY",
    "SOURCE_MESSAGE_CANARY",
    "Synthetic Developer",
    "developer@example.invalid",
    root.replaceAll("\\", "\\\\"),
  ]) {
    assert.equal(serialized.includes(canary), false, canary);
  }
});
