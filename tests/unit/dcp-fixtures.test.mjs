import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { checkDcpFixtures } from "../../scripts/dcp-fixtures.mjs";
import { maximumFixtureFileBytes, readBoundedJson } from "../../scripts/schema-fixture-files.mjs";

const minimalText = await readFile(
  new URL("../../fixtures/dcp/0.1.0/valid/minimal.json", import.meta.url),
  "utf8",
);

/** @param {import("node:test").TestContext} context */
async function temporaryRoot(context) {
  const parent = await realpath(tmpdir());
  const path = await mkdtemp(join(parent, "fmu-dcp-"));
  context.after(async () => {
    if (dirname(path) !== parent || !basename(path).startsWith("fmu-dcp-")) {
      throw new Error("Refusing cleanup outside the created test root.");
    }
    await rm(path, { recursive: true, force: true });
  });
  return path;
}

/** @param {string} root */
async function createCorpus(root) {
  await mkdir(join(root, "valid"));
  await mkdir(join(root, "invalid"));
  await writeFile(join(root, "valid", "sample.json"), minimalText);
  await writeFile(join(root, "invalid", "sample.json"), "{}");
  return pathToFileURL(root + "/");
}

test("all committed positive and negative fixtures have their expected outcome", async () => {
  assert.deepEqual(await checkDcpFixtures(), { valid: 3, invalid: 5 });
});

test("missing and empty fixture groups fail instead of silently passing", async (context) => {
  const root = await temporaryRoot(context);
  const url = pathToFileURL(root + "/");
  await assert.rejects(checkDcpFixtures(url));
  await mkdir(join(root, "valid"));
  await mkdir(join(root, "invalid"));
  await assert.rejects(checkDcpFixtures(url));
});

test("wrong fixture expectation and malformed JSON fail with no reported input", async (context) => {
  const root = await temporaryRoot(context);
  const url = await createCorpus(root);
  await writeFile(join(root, "invalid", "sample.json"), minimalText);
  await assert.rejects(checkDcpFixtures(url), /DCP fixture expectation failed/u);
  await writeFile(join(root, "invalid", "sample.json"), '{"FMU_SYNTHETIC_CANARY_DO_NOT_LOG":');
  await assert.rejects(checkDcpFixtures(url));
});

test("raw fixture reads reject oversize files, directories and invalid UTF-8", async (context) => {
  const root = await temporaryRoot(context);
  await assert.rejects(readBoundedJson(pathToFileURL(root)));
  const file = pathToFileURL(join(root, "sample.json"));
  await writeFile(file, " ".repeat(maximumFixtureFileBytes + 1));
  await assert.rejects(readBoundedJson(file));
  await writeFile(file, Buffer.from([0x22, 0xff, 0x22]));
  await assert.rejects(readBoundedJson(file));
});

test("fixture counts and unexpected names or nested directories are bounded", async (context) => {
  const root = await temporaryRoot(context);
  const url = await createCorpus(root);
  await mkdir(join(root, "valid", "nested"));
  await assert.rejects(checkDcpFixtures(url));
  // Use a second corpus so cleanup never touches an input selected by a fixture.
  const many = await temporaryRoot(context);
  const manyUrl = await createCorpus(many);
  for (let index = 0; index < 33; index++) {
    const name = `sample-${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}.json`;
    await writeFile(join(many, "invalid", name), "{}");
  }
  await assert.rejects(checkDcpFixtures(manyUrl), /DCP fixture count exceeded/u);
});

test("junctions or symlinks cannot redirect fixture groups or ancestor paths", async (context) => {
  const root = await temporaryRoot(context);
  const actual = join(root, "actual");
  await mkdir(actual);
  await createCorpus(actual);
  const linked = join(root, "linked");
  await symlink(actual, linked, process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(checkDcpFixtures(pathToFileURL(linked + "/")));
  await assert.rejects(readBoundedJson(pathToFileURL(join(linked, "valid", "sample.json"))));
});

test("the CLI rejects path arguments and never echoes a canary or native stack", () => {
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("../../scripts/check-schemas.mjs", import.meta.url)),
      "FMU_SYNTHETIC_CANARY_DO_NOT_LOG",
    ],
    { encoding: "utf8", timeout: 10000, maxBuffer: 4096, shell: false },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr.trim(), "Schema fixture check failed.");
});
