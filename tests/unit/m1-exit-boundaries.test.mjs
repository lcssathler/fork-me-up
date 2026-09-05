import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import test from "node:test";

const repositoryRoot = new URL("../../", import.meta.url);

test("M1 exit: every Protocol and Core source remains client and lifecycle neutral", async () => {
  const files = await sourceFiles(["packages/protocol/src", "packages/core/src"]);
  assert.ok(files.length > 0);

  for (const path of files) {
    const source = await readFile(new URL(path.replaceAll("\\", "/"), repositoryRoot), "utf8");
    assert.doesNotMatch(
      source,
      /\bCodex\b|@fork-me-up\/codex-adapter|\b(?:SessionStart|UserPromptSubmit|PostCompact|PreCompact)\b|node:(?:http|https|http2|net|tls|dgram|dns)/u,
      `${path} contains a client, lifecycle, or network dependency`,
    );
  }
});

test("M1 exit: all local runtime sources remain free of network and listener primitives", async () => {
  const files = await sourceFiles([
    "packages/community-provider/src",
    "apps/mcp-local/src",
    "adapters/codex/src",
  ]);
  assert.ok(files.length > 0);

  for (const path of files) {
    const source = await readFile(new URL(path.replaceAll("\\", "/"), repositoryRoot), "utf8");
    assert.doesNotMatch(
      source,
      /(?:from|import\s*\(|require\s*\()\s*["']node:(?:http|https|http2|net|tls|dgram|dns)["']|\bfetch\s*\(|\.listen\s*\(/u,
      `${path} contains a network or listener primitive`,
    );
  }
});

/** @param {readonly string[]} roots */
async function sourceFiles(roots) {
  const files = /** @type {string[]} */ ([]);
  for (const root of roots) await visit(root, files);
  return files.sort();
}

/**
 * @param {string} directory
 * @param {string[]} files
 */
async function visit(directory, files) {
  const entries = await readdir(new URL(`${directory.replaceAll("\\", "/")}/`, repositoryRoot), {
    withFileTypes: true,
  });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    assert.equal(entry.isSymbolicLink(), false, `${relative(".", path)} must not be a symlink`);
    if (entry.isDirectory()) await visit(path, files);
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(path);
  }
}
