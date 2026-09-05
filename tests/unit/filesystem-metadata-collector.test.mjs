import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { TextEncoder } from "node:util";
import {
  collectFilesystemMetadata,
  resolveAuthorizedRepositoryConfig,
} from "@fork-me-up/community-provider";

/** @type {Readonly<Record<"maxRepositories" | "maxFilesPerRepository" | "maxBytesPerFile" | "maxTotalBytesPerRepository" | "maxDepth" | "maxDurationMs" | "maxConcurrency", number>>} */
const defaultLimits = Object.freeze({
  maxRepositories: 1,
  maxFilesPerRepository: 100,
  maxBytesPerFile: 1_024,
  maxTotalBytesPerRepository: 4_096,
  maxDepth: 8,
  maxDurationMs: 1_000,
  maxConcurrency: 1,
});

/** @param {Partial<typeof defaultLimits>} [limitOverrides] */
async function authority(limitOverrides = {}) {
  const limits = { ...defaultLimits, ...limitOverrides };
  const result = await resolveAuthorizedRepositoryConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      authorizedRoots: [{ rootId: "root_synthetic", path: "/selected" }],
      repositories: [
        { repositoryId: "repo_synthetic", rootId: "root_synthetic", relativePath: "repo" },
      ],
      limits,
    }),
    {
      platform: "posix",
      directoryPort: {
        async canonicalizeDirectory(candidatePath) {
          return candidatePath === "/selected" ? "/physical" : candidatePath;
        },
      },
    },
  );
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Synthetic authority did not resolve.");
  return result.value;
}

/** @param {Record<string, {kind: "directory", names: string[]} | {kind: "file", bytes: Uint8Array}>} entries */
function memoryPort(entries) {
  /** @type {string[]} */
  const reads = [];
  return {
    reads,
    port: {
      /** @param {string} candidatePath */
      async inspect(candidatePath) {
        const entry = entries[candidatePath];
        if (entry === undefined) throw new Error("SYNTHETIC_NATIVE_CANARY");
        return {
          canonicalPath: candidatePath,
          pathIdentity: candidatePath,
          kind: entry.kind,
          sizeBytes: entry.kind === "file" ? entry.bytes.byteLength : 0,
        };
      },
      /** @param {string} canonicalDirectory @param {string} entryName */
      async hasEntry(canonicalDirectory, entryName) {
        const entry = entries[canonicalDirectory];
        if (entry?.kind !== "directory") throw new Error("SYNTHETIC_NATIVE_CANARY");
        return entry.names.includes(entryName);
      },
      /** @param {string} canonicalDirectory @param {number} maximumEntries */
      async listDirectory(canonicalDirectory, maximumEntries) {
        const entry = entries[canonicalDirectory];
        if (entry?.kind !== "directory") throw new Error("SYNTHETIC_NATIVE_CANARY");
        if (entry.names.length > maximumEntries) throw new Error("SYNTHETIC_LIMIT_CANARY");
        return [...entry.names].sort();
      },
      /** @param {string} canonicalFile */
      async readFileBounded(canonicalFile) {
        const entry = entries[canonicalFile];
        if (entry?.kind !== "file") throw new Error("SYNTHETIC_NATIVE_CANARY");
        reads.push(canonicalFile);
        return { canonicalPath: canonicalFile, pathIdentity: canonicalFile, bytes: entry.bytes };
      },
    },
  };
}

/** @param {string} value */
const encode = (value) => new TextEncoder().encode(value);
/** @param {Uint8Array} value */
const digest = (value) => createHash("sha256").update(value).digest("hex");

test("collection is deterministic, sanitized, immutable and reads only supported files", async () => {
  const readme = encode("# Public title\n\n```ts\nconst token = 'DOC_CANARY';\n```\n");
  const packageJson = encode(
    JSON.stringify({
      name: "PACKAGE_NAME_CANARY",
      version: "VERSION_CANARY",
      private: true,
      type: "module",
      workspaces: ["packages/*"],
      dependencies: { zeta: "DEPENDENCY_VALUE_CANARY", alpha: "1" },
      devDependencies: { alpha: "2", beta: "3" },
      scripts: { test: "SCRIPT_VALUE_CANARY", build: "secret-command" },
    }),
  );
  const source = encode("export const SOURCE_CANARY = true;\n");
  const { port, reads } = memoryPort({
    "/physical": { kind: "directory", names: ["repo"] },
    "/physical/repo": {
      kind: "directory",
      names: ["vendor.bin", "src", "README.MD", "package.json", "node_modules", ".git"],
    },
    "/physical/repo/README.MD": { kind: "file", bytes: readme },
    "/physical/repo/package.json": { kind: "file", bytes: packageJson },
    "/physical/repo/src": { kind: "directory", names: ["thing.test.ts"] },
    "/physical/repo/src/thing.test.ts": { kind: "file", bytes: source },
    "/physical/repo/vendor.bin": { kind: "file", bytes: new Uint8Array([0, 1, 2]) },
  });

  const first = await collectFilesystemMetadata(await authority(), {
    fileSystemPort: port,
    now: () => 0,
  });
  const second = await collectFilesystemMetadata(await authority(), {
    fileSystemPort: port,
    now: () => 0,
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.deepEqual(first.value, second.value);
  assert.deepEqual(reads, [
    "/physical/repo/README.MD",
    "/physical/repo/package.json",
    "/physical/repo/src/thing.test.ts",
    "/physical/repo/README.MD",
    "/physical/repo/package.json",
    "/physical/repo/src/thing.test.ts",
  ]);
  assert.deepEqual(first.value.repositories[0], {
    repositoryId: "repo_synthetic",
    rootId: "root_synthetic",
    visitedEntryCount: 5,
    ignoredDirectoryCount: 2,
    unsupportedFileCount: 1,
    bytesRead: readme.byteLength + packageJson.byteLength + source.byteLength,
    files: [
      {
        relativePath: "README.MD",
        bytes: readme.byteLength,
        digest: { algorithm: "sha256", value: digest(readme) },
        lineCount: 5,
        category: "document",
        format: "markdown",
        headingCount: 1,
        codeFenceCount: 2,
      },
      {
        relativePath: "package.json",
        bytes: packageJson.byteLength,
        digest: { algorithm: "sha256", value: digest(packageJson) },
        lineCount: 1,
        category: "manifest",
        format: "node-package",
        packageJson: {
          moduleType: "module",
          private: true,
          workspacePatternCount: 1,
          dependencyNames: ["alpha", "beta", "zeta"],
          scriptNames: ["build", "test"],
        },
      },
      {
        relativePath: "src/thing.test.ts",
        bytes: source.byteLength,
        digest: { algorithm: "sha256", value: digest(source) },
        lineCount: 1,
        category: "source",
        language: "typescript",
        testFile: true,
      },
    ],
  });
  const serialized = JSON.stringify(first);
  for (const canary of [
    "DOC_CANARY",
    "PACKAGE_NAME_CANARY",
    "VERSION_CANARY",
    "DEPENDENCY_VALUE_CANARY",
    "SCRIPT_VALUE_CANARY",
    "SOURCE_CANARY",
    "/physical",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(canary, "u"));
  }
  assert.equal(Object.isFrozen(first.value), true);
  assert.equal(Object.isFrozen(first.value.repositories[0]?.files), true);
});

test("forged authority and point-of-use replacement or escape fail closed", async () => {
  const authentic = await authority();
  const forged = { ...authentic };
  assert.deepEqual(await collectFilesystemMetadata(forged), {
    ok: false,
    error: { category: "invalid-input", retryable: false },
  });

  const base = memoryPort({
    "/physical": { kind: "directory", names: ["repo"] },
    "/physical/repo": { kind: "directory", names: ["safe.ts"] },
    "/physical/repo/safe.ts": { kind: "file", bytes: encode("safe") },
  });
  base.port.readFileBounded = async () => ({
    canonicalPath: "/outside/replaced.ts",
    pathIdentity: "/outside/replaced.ts",
    bytes: encode("REPLACEMENT_CANARY"),
  });
  const replacement = await collectFilesystemMetadata(authentic, {
    fileSystemPort: base.port,
    now: () => 0,
  });
  assert.deepEqual(replacement, {
    ok: false,
    error: { category: "not-authorized", retryable: false },
  });
  assert.doesNotMatch(JSON.stringify(replacement), /REPLACEMENT_CANARY|outside/u);

  const movedRoot = memoryPort({
    "/physical": { kind: "directory", names: ["repo"] },
    "/physical/repo": { kind: "directory", names: [] },
  });
  movedRoot.port.inspect = async (candidatePath) => ({
    canonicalPath: candidatePath === "/physical" ? "/outside/moved-root" : candidatePath,
    pathIdentity: candidatePath === "/physical" ? "/outside/moved-root" : candidatePath,
    kind: "directory",
    sizeBytes: 0,
  });
  assert.deepEqual(
    await collectFilesystemMetadata(authentic, {
      fileSystemPort: movedRoot.port,
      now: () => 0,
    }),
    { ok: false, error: { category: "not-authorized", retryable: false } },
  );
});

test("binary, invalid UTF-8 and malformed package metadata return content-free failures", async () => {
  const cases = [
    { name: "bad.md", bytes: new Uint8Array([65, 0, 66]), category: "binary-content" },
    { name: "bad.ts", bytes: new Uint8Array([0xc3, 0x28]), category: "invalid-content" },
    { name: "package.json", bytes: encode('{"name":'), category: "invalid-content" },
  ];
  for (const item of cases) {
    const { port } = memoryPort({
      "/physical": { kind: "directory", names: ["repo"] },
      "/physical/repo": { kind: "directory", names: [item.name] },
      [`/physical/repo/${item.name}`]: { kind: "file", bytes: item.bytes },
    });
    const result = await collectFilesystemMetadata(await authority(), {
      fileSystemPort: port,
      now: () => 0,
    });
    assert.deepEqual(result, {
      ok: false,
      error: { category: item.category, retryable: false },
    });
    assert.equal("value" in result, false);
  }
});

test("entry, file, total, depth, growth and deadline ceilings fail without partial output", async () => {
  const scenarios = [
    {
      authority: () => authority({ maxFilesPerRepository: 1 }),
      entries: {
        "/physical": { kind: "directory", names: ["repo"] },
        "/physical/repo": { kind: "directory", names: ["a.ts", "b.ts"] },
        "/physical/repo/a.ts": { kind: "file", bytes: encode("a") },
        "/physical/repo/b.ts": { kind: "file", bytes: encode("b") },
      },
      category: "limit-exceeded",
    },
    {
      authority: () => authority({ maxBytesPerFile: 4, maxTotalBytesPerRepository: 4 }),
      entries: {
        "/physical": { kind: "directory", names: ["repo"] },
        "/physical/repo": { kind: "directory", names: ["a.ts"] },
        "/physical/repo/a.ts": { kind: "file", bytes: encode("12345") },
      },
      category: "limit-exceeded",
    },
    {
      authority: () => authority({ maxBytesPerFile: 4, maxTotalBytesPerRepository: 4 }),
      entries: {
        "/physical": { kind: "directory", names: ["repo"] },
        "/physical/repo": { kind: "directory", names: ["a.ts", "b.ts"] },
        "/physical/repo/a.ts": { kind: "file", bytes: encode("123") },
        "/physical/repo/b.ts": { kind: "file", bytes: encode("456") },
      },
      category: "limit-exceeded",
    },
    {
      authority: () => authority({ maxDepth: 1 }),
      entries: {
        "/physical": { kind: "directory", names: ["repo"] },
        "/physical/repo": { kind: "directory", names: ["one"] },
        "/physical/repo/one": { kind: "directory", names: ["two"] },
        "/physical/repo/one/two": { kind: "directory", names: [] },
      },
      category: "limit-exceeded",
    },
  ];
  for (const scenario of scenarios) {
    const { port } = memoryPort(/** @type {Parameters<typeof memoryPort>[0]} */ (scenario.entries));
    const result = await collectFilesystemMetadata(await scenario.authority(), {
      fileSystemPort: port,
      now: () => 0,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.category, scenario.category);
    assert.equal("value" in result, false);
  }

  const growth = memoryPort({
    "/physical": { kind: "directory", names: ["repo"] },
    "/physical/repo": { kind: "directory", names: ["a.ts"] },
    "/physical/repo/a.ts": { kind: "file", bytes: encode("a") },
  });
  growth.port.readFileBounded = async () => ({
    canonicalPath: "/physical/repo/a.ts",
    pathIdentity: "/physical/repo/a.ts",
    bytes: new Uint8Array(1_025),
  });
  const growthResult = await collectFilesystemMetadata(await authority(), {
    fileSystemPort: growth.port,
    now: () => 0,
  });
  assert.equal(growthResult.ok, false);
  if (!growthResult.ok) assert.equal(growthResult.error.category, "limit-exceeded");

  let tick = 0;
  const deadline = memoryPort({
    "/physical": { kind: "directory", names: ["repo"] },
    "/physical/repo": { kind: "directory", names: [] },
  });
  const deadlineResult = await collectFilesystemMetadata(await authority({ maxDurationMs: 2 }), {
    fileSystemPort: deadline.port,
    now: () => tick++,
  });
  assert.deepEqual(deadlineResult, {
    ok: false,
    error: { category: "deadline-exceeded", retryable: true },
  });
});

test("exact ceilings are accepted while unsafe names, special entries and oversized metadata fail", async () => {
  const exact = memoryPort({
    "/physical": { kind: "directory", names: ["repo"] },
    "/physical/repo": { kind: "directory", names: ["a.ts"] },
    "/physical/repo/a.ts": { kind: "file", bytes: encode("1234") },
  });
  const exactResult = await collectFilesystemMetadata(
    await authority({
      maxFilesPerRepository: 1,
      maxBytesPerFile: 4,
      maxTotalBytesPerRepository: 4,
    }),
    { fileSystemPort: exact.port, now: () => 0 },
  );
  assert.equal(exactResult.ok, true);

  const unsafe = memoryPort({
    "/physical": { kind: "directory", names: ["repo"] },
    "/physical/repo": { kind: "directory", names: ["bad:name.ts"] },
  });
  const unsafeResult = await collectFilesystemMetadata(await authority(), {
    fileSystemPort: unsafe.port,
    now: () => 0,
  });
  assert.equal(unsafeResult.ok, false);
  if (!unsafeResult.ok) assert.equal(unsafeResult.error.category, "not-authorized");

  const special = memoryPort({
    "/physical": { kind: "directory", names: ["repo"] },
    "/physical/repo": { kind: "directory", names: ["pipe.ts"] },
    "/physical/repo/pipe.ts": { kind: "file", bytes: encode("SPECIAL_CANARY") },
  });
  const originalInspect = special.port.inspect;
  /** @type {import("@fork-me-up/community-provider").FilesystemMetadataPort} */
  const specialPort = {
    ...special.port,
    async inspect(candidatePath) {
      return candidatePath.endsWith("pipe.ts")
        ? {
            canonicalPath: candidatePath,
            pathIdentity: candidatePath,
            kind: "other",
            sizeBytes: 0,
          }
        : originalInspect(candidatePath);
    },
  };
  const specialResult = await collectFilesystemMetadata(await authority(), {
    fileSystemPort: specialPort,
    now: () => 0,
  });
  assert.deepEqual(specialResult, {
    ok: false,
    error: { category: "not-authorized", retryable: false },
  });
  assert.doesNotMatch(JSON.stringify(specialResult), /SPECIAL_CANARY|pipe/u);

  const longName = "a".repeat(215);
  const longPackage = encode(JSON.stringify({ dependencies: { [longName]: "CANARY" } }));
  const metadata = memoryPort({
    "/physical": { kind: "directory", names: ["repo"] },
    "/physical/repo": { kind: "directory", names: ["package.json"] },
    "/physical/repo/package.json": { kind: "file", bytes: longPackage },
  });
  const metadataResult = await collectFilesystemMetadata(await authority(), {
    fileSystemPort: metadata.port,
    now: () => 0,
  });
  assert.equal(metadataResult.ok, false);
  if (!metadataResult.ok) assert.equal(metadataResult.error.category, "limit-exceeded");
});

test("nested repositories are boundaries and filesystem failures reveal no native detail", async () => {
  const { port, reads } = memoryPort({
    "/physical": { kind: "directory", names: ["repo"] },
    "/physical/repo": { kind: "directory", names: ["nested"] },
    "/physical/repo/nested": { kind: "directory", names: [".git", "secret.ts"] },
    "/physical/repo/nested/secret.ts": { kind: "file", bytes: encode("NESTED_CANARY") },
  });
  const result = await collectFilesystemMetadata(await authority(), {
    fileSystemPort: port,
    now: () => 0,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.repositories[0]?.ignoredDirectoryCount, 1);
    assert.deepEqual(result.value.repositories[0]?.files, []);
  }
  assert.deepEqual(reads, []);

  const failurePort = memoryPort({
    "/physical": { kind: "directory", names: ["repo"] },
    "/physical/repo": { kind: "directory", names: [] },
  });
  failurePort.port.listDirectory = async () => {
    throw new Error("NATIVE_PATH_CANARY");
  };
  const failed = await collectFilesystemMetadata(await authority(), {
    fileSystemPort: failurePort.port,
    now: () => 0,
  });
  assert.deepEqual(failed, {
    ok: false,
    error: { category: "path-unavailable", retryable: true },
  });
  assert.doesNotMatch(JSON.stringify(failed), /NATIVE_PATH_CANARY|physical/u);
});

test("collector runtime has no execution, network, write, URL or archive primitive", async () => {
  const source = await readFile(
    new URL(
      "../../packages/community-provider/src/filesystem-metadata-collector.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /node:(?:child_process|http|https|http2|net|tls|dgram|dns)|\b(?:spawn|exec|execFile|fork|fetch|listen|writeFile|appendFile|createWriteStream)\s*\(|\bimport\s*\(|\b(?:zip|tar|unzip)\b/u,
  );
});
