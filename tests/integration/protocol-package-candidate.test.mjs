import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createProtocolCandidateManifest,
  expectedProtocolArtifactFiles,
} from "../../scripts/protocol-package-candidate.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const outputRoot = path.join(repositoryRoot, "build", "protocol-package");
const tarballName = "fork-me-up-protocol-0.0.0.tgz";

/** @param {string[]} args @param {string} cwd @param {number} [timeout] */
function runNpm(args, cwd, timeout = 60_000) {
  const npmCli = process.env["npm_execpath"];
  assert.ok(npmCli);
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd,
    encoding: "utf8",
    shell: false,
    timeout,
    maxBuffer: 2 * 1024 * 1024,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  return result;
}

test("the local Protocol tarball installs offline and rejects unsupported versions", () => {
  runNpm(["run", "--silent", "package:protocol"], repositoryRoot);
  const reportText = readFileSync(path.join(outputRoot, "manifest.json"), "utf8");
  const report =
    /** @type {{
     * kind: string,
     * releaseState: string,
     * package: {
     *   filename: string,
     *   files: Array<{path: string}>,
     *   entrypoints: Record<string, unknown>
     * }
     * }} */ (JSON.parse(reportText));
  assert.equal(report.kind, "protocol-package-candidate");
  assert.equal(report.releaseState, "local-installable-private-unpublished");
  assert.equal(report.package.filename, tarballName);
  assert.deepEqual(
    report.package.files.map((file) => file.path),
    expectedProtocolArtifactFiles(),
  );
  assert.deepEqual(report.package.entrypoints, createProtocolCandidateManifest().exports);
  assert.doesNotMatch(reportText, /(?:[A-Za-z]:[\\/]|\\Users\\|\/Users\/|\/home\/)/u);
  assert.doesNotMatch(reportText, /(?:fixtures\/internal|fixtures\/developer-profile)/u);

  const consumerRoot = mkdtempSync(path.join(os.tmpdir(), "fmu-protocol-consumer-"));
  try {
    writeFileSync(
      path.join(consumerRoot, "package.json"),
      '{"name":"fmu-protocol-consumer","private":true,"type":"module"}\n',
      "utf8",
    );
    runNpm(
      [
        "install",
        "--ignore-scripts",
        "--offline",
        "--no-audit",
        "--no-fund",
        "--package-lock=false",
        path.join(outputRoot, tarballName),
      ],
      consumerRoot,
    );
    writeFileSync(
      path.join(consumerRoot, "verify.mjs"),
      `
import {
  isDeveloperContextPacket,
  isProfileProviderCapabilities
} from "@fork-me-up/protocol";
import {
  isProfileProviderConformanceTranscript
} from "@fork-me-up/protocol/conformance/profile-provider";
import dcpSchema from "@fork-me-up/protocol/schemas/dcp/0.1.0" with { type: "json" };
import validDcp from "@fork-me-up/protocol/fixtures/dcp/0.1.0/valid/minimal.json" with { type: "json" };
import provider from "@fork-me-up/protocol/fixtures/profile-provider/0.1.0/valid/local-complete.json" with { type: "json" };
import conformance from "@fork-me-up/protocol/fixtures/conformance/profile-provider/0.1.0/valid/complete.json" with { type: "json" };
import unsupported from "@fork-me-up/protocol/fixtures/conformance/profile-provider/0.1.0/invalid/unsupported-version.json" with { type: "json" };

if (dcpSchema.$id !== "urn:fork-me-up:dcp:0.1.0") process.exit(2);
if (!isDeveloperContextPacket(validDcp)) process.exit(3);
if (isDeveloperContextPacket({ ...validDcp, schemaVersion: "1.0.0" })) process.exit(4);
if (!isProfileProviderCapabilities(provider)) process.exit(5);
if (isProfileProviderCapabilities({ ...provider, schemaVersion: "1.0.0" })) process.exit(6);
if (!isProfileProviderConformanceTranscript(conformance)) process.exit(7);
if (isProfileProviderConformanceTranscript(unsupported)) process.exit(8);
console.log("protocol-artifact-ok");
`,
      "utf8",
    );
    const verified = spawnSync(process.execPath, ["verify.mjs"], {
      cwd: consumerRoot,
      encoding: "utf8",
      shell: false,
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
    assert.equal(verified.error, undefined);
    assert.equal(verified.status, 0, verified.stderr);
    assert.match(verified.stdout, /protocol-artifact-ok/u);

    writeFileSync(
      path.join(consumerRoot, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            module: "NodeNext",
            moduleResolution: "NodeNext",
            noEmit: true,
            resolveJsonModule: true,
            skipLibCheck: false,
            strict: true,
            target: "ES2024",
          },
          include: ["verify.ts"],
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    writeFileSync(
      path.join(consumerRoot, "verify.ts"),
      `
import {
  isDeveloperContextPacket,
  type DeveloperContextPacket,
  type ProfileProviderConformanceTranscript
} from "@fork-me-up/protocol";
import {
  isProfileProviderConformanceTranscript
} from "@fork-me-up/protocol/conformance/profile-provider";
import dcpSchema from "@fork-me-up/protocol/schemas/dcp/0.1.0" with { type: "json" };
import validDcp from "@fork-me-up/protocol/fixtures/dcp/0.1.0/valid/minimal.json" with { type: "json" };
import conformance from "@fork-me-up/protocol/fixtures/conformance/profile-provider/0.1.0/valid/complete.json" with { type: "json" };

const packetCandidate: unknown = validDcp;
if (isDeveloperContextPacket(packetCandidate)) {
  const packet: DeveloperContextPacket = packetCandidate;
  void packet.schemaVersion;
}

const transcriptCandidate: unknown = conformance;
if (isProfileProviderConformanceTranscript(transcriptCandidate)) {
  const transcript: ProfileProviderConformanceTranscript = transcriptCandidate;
  void transcript.conformanceVersion;
}

const schemaId: string = dcpSchema.$id;
void schemaId;
`,
      "utf8",
    );
    const compiler = path.join(repositoryRoot, "node_modules", "typescript", "bin", "tsc");
    const typechecked = spawnSync(
      process.execPath,
      [compiler, "--project", "tsconfig.json", "--pretty", "false"],
      {
        cwd: consumerRoot,
        encoding: "utf8",
        shell: false,
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      },
    );
    assert.equal(typechecked.error, undefined);
    assert.equal(typechecked.status, 0, typechecked.stderr || typechecked.stdout);

    const installedManifest = JSON.parse(
      readFileSync(
        path.join(consumerRoot, "node_modules", "@fork-me-up", "protocol", "package.json"),
        "utf8",
      ),
    );
    assert.deepEqual(installedManifest.exports, createProtocolCandidateManifest().exports);
    assert.equal(Object.hasOwn(installedManifest, "scripts"), false);
    assert.equal(Object.hasOwn(installedManifest, "publishConfig"), false);
  } finally {
    rmSync(consumerRoot, { recursive: true, force: true });
  }
});
