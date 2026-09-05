import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  localRepositoryConfigHardLimits,
  resolveAuthorizedRepositoryConfig,
} from "@fork-me-up/community-provider";

const defaultLimits = Object.freeze({
  maxRepositories: 4,
  maxFilesPerRepository: 1_000,
  maxBytesPerFile: 1_048_576,
  maxTotalBytesPerRepository: 16_777_216,
  maxDepth: 16,
  maxDurationMs: 30_000,
  maxConcurrency: 2,
});

/** @param {Record<string, unknown>} [overrides] */
function source(overrides = {}) {
  return JSON.stringify({
    configVersion: "0.1.0",
    authorizedRoots: [{ rootId: "root_main", path: "C:\\selected" }],
    repositories: [{ repositoryId: "repo_app", rootId: "root_main", relativePath: "app" }],
    limits: defaultLimits,
    ...overrides,
  });
}

/** @param {Map<string, string | Error>} entries */
function mappedPort(entries) {
  /** @type {string[]} */
  const calls = [];
  return {
    calls,
    port: Object.freeze({
      /** @param {string} candidatePath */
      async canonicalizeDirectory(candidatePath) {
        calls.push(candidatePath);
        const result = entries.get(candidatePath);
        if (result instanceof Error) throw result;
        if (typeof result !== "string") throw new Error("Synthetic path unavailable.");
        return result;
      },
    }),
  };
}

test("a closed Windows configuration resolves canonical authorized repositories immutably", async () => {
  const { port, calls } = mappedPort(
    new Map([
      ["C:\\selected", "C:\\Physical\\Root"],
      ["C:\\Physical\\Root\\app", "c:\\physical\\ROOT\\App"],
    ]),
  );
  const result = await resolveAuthorizedRepositoryConfig(source(), {
    platform: "win32",
    directoryPort: port,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(calls, ["C:\\selected", "C:\\Physical\\Root\\app"]);
  assert.deepEqual(result.value, {
    configVersion: "0.1.0",
    platform: "win32",
    authorizedRoots: [
      {
        rootId: "root_main",
        canonicalPath: "C:\\Physical\\Root",
        pathIdentity: "c:\\physical\\root",
      },
    ],
    repositories: [
      {
        repositoryId: "repo_app",
        rootId: "root_main",
        relativePath: "app",
        canonicalPath: "c:\\physical\\ROOT\\App",
        pathIdentity: "c:\\physical\\root\\app",
      },
    ],
    limits: defaultLimits,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value.authorizedRoots), true);
  const firstRoot = result.value.authorizedRoots[0];
  const firstRepository = result.value.repositories[0];
  assert.ok(firstRoot);
  assert.ok(firstRepository);
  assert.equal(Object.isFrozen(firstRoot), true);
  assert.equal(Object.isFrozen(result.value.repositories), true);
  assert.equal(Object.isFrozen(result.value.limits), true);
  assert.throws(() => {
    Object.defineProperty(firstRepository, "canonicalPath", { value: "C:\\changed" });
  }, TypeError);
});

test("root selection is explicit, exact and independent of input ordering", async () => {
  const input = source({
    authorizedRoots: [
      { rootId: "root_z", path: "/selected/z" },
      { rootId: "root_a", path: "/selected/a" },
    ],
    repositories: [
      { repositoryId: "repo_z", rootId: "root_z", relativePath: "." },
      { repositoryId: "repo_a", rootId: "root_a", relativePath: "nested/project" },
    ],
  });
  const { port } = mappedPort(
    new Map([
      ["/selected/z", "/physical/z"],
      ["/selected/a", "/physical/a"],
      ["/physical/z", "/physical/z"],
      ["/physical/a/nested/project", "/physical/a/nested/project"],
    ]),
  );
  const result = await resolveAuthorizedRepositoryConfig(input, {
    platform: "posix",
    directoryPort: port,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.value.authorizedRoots.map((item) => item.rootId),
    ["root_a", "root_z"],
  );
  assert.deepEqual(
    result.value.repositories.map((item) => item.repositoryId),
    ["repo_a", "repo_z"],
  );
});

test("canonical escape from the named root fails closed", async () => {
  const canary = "FMU_PATH_ESCAPE_CANARY";
  const { port } = mappedPort(
    new Map([
      ["/selected", "/physical/root"],
      ["/physical/root/link", `/outside/${canary}`],
    ]),
  );
  const result = await resolveAuthorizedRepositoryConfig(
    source({
      authorizedRoots: [{ rootId: "root_main", path: "/selected" }],
      repositories: [{ repositoryId: "repo_link", rootId: "root_main", relativePath: "link" }],
    }),
    { platform: "posix", directoryPort: port },
  );

  assert.deepEqual(result, {
    ok: false,
    error: { category: "not-authorized", retryable: false },
  });
  assert.doesNotMatch(JSON.stringify(result), new RegExp(canary, "u"));
});

test("a sibling-prefix path is not mistaken for a descendant", async () => {
  const { port } = mappedPort(
    new Map([
      ["C:\\selected", "C:\\work\\repo"],
      ["C:\\work\\repo\\link", "C:\\work\\repo-other"],
    ]),
  );
  const result = await resolveAuthorizedRepositoryConfig(
    source({
      repositories: [{ repositoryId: "repo_link", rootId: "root_main", relativePath: "link" }],
    }),
    { platform: "win32", directoryPort: port },
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.category, "not-authorized");
});

test("physical root and repository aliases are rejected as duplicates", async () => {
  const duplicateRoots = mappedPort(
    new Map([
      ["C:\\one", "C:\\Physical\\Root"],
      ["C:\\two", "c:\\physical\\root"],
    ]),
  );
  const rootResult = await resolveAuthorizedRepositoryConfig(
    source({
      authorizedRoots: [
        { rootId: "root_one", path: "C:\\one" },
        { rootId: "root_two", path: "C:\\two" },
      ],
      repositories: [{ repositoryId: "repo_one", rootId: "root_one", relativePath: "." }],
    }),
    { platform: "win32", directoryPort: duplicateRoots.port },
  );
  assert.deepEqual(rootResult, {
    ok: false,
    error: { category: "invalid-config", retryable: false },
  });
  assert.deepEqual(duplicateRoots.calls, ["C:\\one", "C:\\two"]);

  const duplicateRepositories = mappedPort(
    new Map([
      ["C:\\selected", "C:\\Physical\\Root"],
      ["C:\\Physical\\Root\\one", "C:\\Physical\\Root\\Repo"],
      ["C:\\Physical\\Root\\two", "c:\\physical\\root\\repo"],
    ]),
  );
  const repositoryResult = await resolveAuthorizedRepositoryConfig(
    source({
      repositories: [
        { repositoryId: "repo_one", rootId: "root_main", relativePath: "one" },
        { repositoryId: "repo_two", rootId: "root_main", relativePath: "two" },
      ],
    }),
    { platform: "win32", directoryPort: duplicateRepositories.port },
  );
  assert.deepEqual(repositoryResult, {
    ok: false,
    error: { category: "invalid-config", retryable: false },
  });
});

test("POSIX path identity remains case-sensitive", async () => {
  const { port } = mappedPort(
    new Map([
      ["/selected", "/physical/root"],
      ["/physical/root/upper", "/physical/root/Repo"],
      ["/physical/root/lower", "/physical/root/repo"],
    ]),
  );
  const result = await resolveAuthorizedRepositoryConfig(
    source({
      authorizedRoots: [{ rootId: "root_main", path: "/selected" }],
      repositories: [
        { repositoryId: "repo_upper", rootId: "root_main", relativePath: "upper" },
        { repositoryId: "repo_lower", rootId: "root_main", relativePath: "lower" },
      ],
    }),
    { platform: "posix", directoryPort: port },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.value.repositories.map((item) => item.pathIdentity),
    ["/physical/root/repo", "/physical/root/Repo"],
  );
});

test("shape, identifiers, root references and repository-relative syntax are closed", async () => {
  const invalidSources = [
    "not json",
    JSON.stringify({}),
    source({ extra: true }),
    source({ authorizedRoots: [] }),
    source({ repositories: [] }),
    source({ authorizedRoots: [{ rootId: "bad/id", path: "C:\\selected" }] }),
    source({ repositories: [{ repositoryId: "repo", rootId: "missing", relativePath: "." }] }),
    source({ repositories: [{ repositoryId: "repo", rootId: "root_main", relativePath: "" }] }),
    source({ repositories: [{ repositoryId: "repo", rootId: "root_main", relativePath: ".." }] }),
    source({
      repositories: [{ repositoryId: "repo", rootId: "root_main", relativePath: "a/../b" }],
    }),
    source({ repositories: [{ repositoryId: "repo", rootId: "root_main", relativePath: "a//b" }] }),
    source({ repositories: [{ repositoryId: "repo", rootId: "root_main", relativePath: "a\\b" }] }),
    source({
      repositories: [{ repositoryId: "repo", rootId: "root_main", relativePath: "C:/repo" }],
    }),
    source({ authorizedRoots: [{ rootId: "root_main", path: "relative/root" }] }),
    source({ authorizedRoots: [{ rootId: "root_main", path: "\\\\?\\C:\\device" }] }),
  ];
  /** @type {string[]} */
  const calls = [];
  const directoryPort = {
    /** @param {string} candidatePath */
    async canonicalizeDirectory(candidatePath) {
      calls.push(candidatePath);
      return candidatePath;
    },
  };

  for (const input of invalidSources) {
    const result = await resolveAuthorizedRepositoryConfig(input, {
      platform: "win32",
      directoryPort,
    });
    assert.equal(result.ok, false, input);
    if (!result.ok) assert.equal(result.error.category, "invalid-config", input);
  }
  assert.deepEqual(calls, []);
});

test("unsupported versions are distinguished without accepting partial compatibility", async () => {
  const result = await resolveAuthorizedRepositoryConfig(source({ configVersion: "1.0.0" }), {
    platform: "win32",
  });
  assert.deepEqual(result, {
    ok: false,
    error: { category: "unsupported-version", retryable: false },
  });
});

test("configuration and collection ceilings fail before path metadata access", async () => {
  /** @type {string[]} */
  const calls = [];
  const directoryPort = {
    /** @param {string} candidatePath */
    async canonicalizeDirectory(candidatePath) {
      calls.push(candidatePath);
      return candidatePath;
    },
  };
  const cases = [
    "x".repeat(localRepositoryConfigHardLimits.maxConfigBytes + 1),
    source({ limits: { ...defaultLimits, maxRepositories: 33 } }),
    source({ limits: { ...defaultLimits, maxFilesPerRepository: 50_001 } }),
    source({ limits: { ...defaultLimits, maxBytesPerFile: 2_097_153 } }),
    source({ limits: { ...defaultLimits, maxTotalBytesPerRepository: 134_217_729 } }),
    source({ limits: { ...defaultLimits, maxDepth: 65 } }),
    source({ limits: { ...defaultLimits, maxDurationMs: 120_001 } }),
    source({ limits: { ...defaultLimits, maxConcurrency: 9 } }),
  ];

  for (const input of cases) {
    const result = await resolveAuthorizedRepositoryConfig(input, {
      platform: "win32",
      directoryPort,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.category, "limit-exceeded");
  }
  assert.deepEqual(calls, []);
});

test("array, path and identifier bounds reject excess before metadata access", async () => {
  /** @type {string[]} */
  const calls = [];
  const directoryPort = {
    /** @param {string} candidatePath */
    async canonicalizeDirectory(candidatePath) {
      calls.push(candidatePath);
      return candidatePath;
    },
  };
  const tooManyRoots = Array.from(
    { length: localRepositoryConfigHardLimits.maxRoots + 1 },
    (_, index) => ({ rootId: `root_${String(index)}`, path: `C:\\root-${String(index)}` }),
  );
  const tooManyRepositories = Array.from(
    { length: localRepositoryConfigHardLimits.maxRepositories + 1 },
    (_, index) => ({
      repositoryId: `repo_${String(index)}`,
      rootId: "root_main",
      relativePath: `repo-${String(index)}`,
    }),
  );
  const cases = [
    source({ authorizedRoots: tooManyRoots }),
    source({ repositories: tooManyRepositories }),
    source({
      authorizedRoots: [
        {
          rootId: "root_main",
          path: `C:\\${"r".repeat(localRepositoryConfigHardLimits.maxRootPathBytes)}`,
        },
      ],
    }),
    source({
      repositories: [
        {
          repositoryId: "repo_main",
          rootId: "root_main",
          relativePath: "r".repeat(localRepositoryConfigHardLimits.maxRelativePathBytes + 1),
        },
      ],
    }),
  ];

  for (const input of cases) {
    const result = await resolveAuthorizedRepositoryConfig(input, {
      platform: "win32",
      directoryPort,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.category, "limit-exceeded");
  }

  for (const input of [
    source({
      authorizedRoots: [
        { rootId: "root_main", path: "C:\\one" },
        { rootId: "root_main", path: "C:\\two" },
      ],
    }),
    source({
      repositories: [
        { repositoryId: "repo_same", rootId: "root_main", relativePath: "one" },
        { repositoryId: "repo_same", rootId: "root_main", relativePath: "two" },
      ],
    }),
    source({
      repositories: [
        {
          repositoryId: "repo_app",
          rootId: "root_main",
          relativePath: "app",
          extra: true,
        },
      ],
    }),
  ]) {
    const result = await resolveAuthorizedRepositoryConfig(input, {
      platform: "win32",
      directoryPort,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.category, "invalid-config");
  }
  assert.deepEqual(calls, []);
});

test("the exact JSON byte ceiling is accepted and the next byte is rejected", async () => {
  const baseSource = source();
  const exactSource = `${baseSource}${" ".repeat(
    localRepositoryConfigHardLimits.maxConfigBytes - Buffer.byteLength(baseSource, "utf8"),
  )}`;
  const { port } = mappedPort(
    new Map([
      ["C:\\selected", "C:\\physical"],
      ["C:\\physical\\app", "C:\\physical\\app"],
    ]),
  );

  assert.equal(
    Buffer.byteLength(exactSource, "utf8"),
    localRepositoryConfigHardLimits.maxConfigBytes,
  );
  const accepted = await resolveAuthorizedRepositoryConfig(exactSource, {
    platform: "win32",
    directoryPort: port,
  });
  assert.equal(accepted.ok, true);

  const rejected = await resolveAuthorizedRepositoryConfig(`${exactSource} `, {
    platform: "win32",
    directoryPort: port,
  });
  assert.deepEqual(rejected, {
    ok: false,
    error: { category: "limit-exceeded", retryable: false },
  });
});

test("invalid lower limits and inconsistent byte limits fail closed", async () => {
  for (const limits of [
    { ...defaultLimits, maxDepth: 0 },
    { ...defaultLimits, maxDurationMs: 1.5 },
    { ...defaultLimits, maxTotalBytesPerRepository: 100 },
  ]) {
    const result = await resolveAuthorizedRepositoryConfig(source({ limits }), {
      platform: "win32",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.category, "invalid-config");
  }
});

test("the configured repository count cannot exceed its accepted budget", async () => {
  const result = await resolveAuthorizedRepositoryConfig(
    source({
      repositories: [
        { repositoryId: "repo_one", rootId: "root_main", relativePath: "one" },
        { repositoryId: "repo_two", rootId: "root_main", relativePath: "two" },
      ],
      limits: { ...defaultLimits, maxRepositories: 1 },
    }),
    { platform: "win32" },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.category, "limit-exceeded");
});

test("directory failures return one retryable content-free category and no partial result", async () => {
  const canary = "FMU_NATIVE_PATH_ERROR_CANARY";
  let callCount = 0;
  const result = await resolveAuthorizedRepositoryConfig(
    source({
      repositories: [
        { repositoryId: "repo_one", rootId: "root_main", relativePath: "one" },
        { repositoryId: "repo_two", rootId: "root_main", relativePath: "two" },
      ],
    }),
    {
      platform: "win32",
      directoryPort: {
        async canonicalizeDirectory(candidatePath) {
          callCount += 1;
          if (callCount === 3) throw new Error(`${canary}:${candidatePath}`);
          return candidatePath === "C:\\selected" ? "C:\\physical" : candidatePath;
        },
      },
    },
  );

  assert.deepEqual(result, {
    ok: false,
    error: { category: "path-unavailable", retryable: true },
  });
  assert.equal("value" in result, false);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(canary, "u"));
});

test("canonical-directory output is independently validated", async () => {
  for (const canonicalOutput of ["relative", "\\\\?\\C:\\device", ""]) {
    const result = await resolveAuthorizedRepositoryConfig(source(), {
      platform: "win32",
      directoryPort: {
        async canonicalizeDirectory() {
          return canonicalOutput;
        },
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.category, "path-unavailable");
  }
});

test("the Node metadata adapter cannot enumerate, read or execute repository content", async () => {
  const moduleSource = await readFile(
    new URL(
      "../../packages/community-provider/src/authorized-repository-config.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(moduleSource, /import \{ realpath, stat \} from "node:fs\/promises";/u);
  assert.doesNotMatch(
    moduleSource,
    /\b(?:readFile|readdir|opendir|createReadStream|watch|spawn|exec|execFile|fork|fetch|listen)\b|node:(?:http|https|net|tls|dgram|dns|child_process)/u,
  );
});
