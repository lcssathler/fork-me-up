import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assessGitAuthorship,
  developerIdentityConfigHardLimits,
  resolveDeveloperIdentityConfig,
} from "@fork-me-up/community-provider";

/** @param {number} value */
const objectId = (value) => value.toString(16).padStart(40, "0");
const unknownDigest = "f".repeat(64);

/** @param {unknown[]} [annotations] @param {unknown[]} [identities] */
function resolveConfiguration(annotations = [], identities = defaultIdentities()) {
  return resolveDeveloperIdentityConfig(
    JSON.stringify({
      configVersion: "0.1.0",
      subjectRef: "subject_synthetic_developer",
      identities,
      annotations,
    }),
  );
}

function defaultIdentities() {
  return [
    { role: "developer", name: "Developer Person", email: "developer@example.invalid" },
    { role: "shared", name: "Shared Account", email: "shared@example.invalid" },
    { role: "bot", name: "Synthetic Bot", email: "bot@example.invalid" },
  ];
}

/**
 * @param {import("@fork-me-up/community-provider").ResolvedDeveloperIdentityConfig} config
 * @param {import("@fork-me-up/community-provider").GitIdentityRole} role
 */
function digestFor(config, role) {
  const identity = config.identities.find((candidate) => candidate.role === role);
  assert.ok(identity);
  return identity.identityDigest;
}

/** @param {string} id @param {string} author @param {Partial<import("@fork-me-up/community-provider").GitCommitMetadata>} [overrides] */
function commit(id, author, overrides = {}) {
  return {
    objectId: id,
    parentObjectIds: [],
    authoredAt: "2026-09-05T12:00:00.000Z",
    committedAt: "2026-09-05T12:00:01.000Z",
    authorIdentityDigest: author,
    committerIdentityDigest: author,
    coauthorIdentityDigests: [],
    changedPaths: ["src/synthetic.ts"],
    ...overrides,
  };
}

test("private identity input resolves to deterministic digests and never survives output", () => {
  const first = resolveConfiguration();
  const second = resolveConfiguration([], [...defaultIdentities()].reverse());
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.deepEqual(first.value, second.value);
  assert.equal(Object.isFrozen(first.value), true);
  assert.equal(Object.isFrozen(first.value.identities), true);
  assert.equal(first.value.identities.length, 3);
  assert.ok(
    first.value.identities.every((identity) => /^[0-9a-f]{64}$/u.test(identity.identityDigest)),
  );
  assert.doesNotMatch(
    JSON.stringify(first),
    /Developer Person|developer@example|Shared Account|shared@example|Synthetic Bot|bot@example/u,
  );

  const normalizedDuplicate = resolveConfiguration(
    [],
    [
      { role: "developer", name: "  Developer   Person ", email: "DEVELOPER@example.invalid" },
      { role: "shared", name: "developer person", email: "developer@example.invalid" },
    ],
  );
  assert.deepEqual(normalizedDuplicate, {
    ok: false,
    error: { category: "invalid-input", retryable: false },
  });
});

test("identity configuration is closed, bounded, role-disjoint and content-free on failure", () => {
  const base = {
    configVersion: "0.1.0",
    subjectRef: "subject_synthetic_developer",
    identities: defaultIdentities(),
    annotations: [],
  };
  for (const changed of [
    { ...base, configVersion: "9.0.0" },
    { ...base, extra: true },
    { ...base, subjectRef: "subject/path" },
    { ...base, identities: [{ role: "bot", name: "Bot", email: "bot@example.invalid" }] },
    {
      ...base,
      identities: [
        ...defaultIdentities(),
        { role: "developer", name: "Developer Person", email: "developer@example.invalid" },
      ],
    },
    {
      ...base,
      identities: [{ role: "developer", name: "x".repeat(513), email: "private@example.invalid" }],
    },
    {
      ...base,
      identities: [
        { role: "developer", name: "Private\nIdentity", email: "private@example.invalid" },
      ],
    },
    {
      ...base,
      identities: [{ role: "developer", name: "Private", email: "<private@example.invalid>" }],
    },
    {
      ...base,
      identities: [{ role: "developer", name: "\ud800", email: "private@example.invalid" }],
    },
    {
      ...base,
      annotations: [
        { repositoryId: "repo_synthetic", commitObjectId: objectId(1), kind: "pair-work" },
        { repositoryId: "repo_synthetic", commitObjectId: objectId(1), kind: "pair-work" },
      ],
    },
  ]) {
    const result = resolveDeveloperIdentityConfig(JSON.stringify(changed));
    assert.equal(result.ok, false);
    assert.equal("value" in result, false);
    assert.doesNotMatch(JSON.stringify(result), /private@example|Developer Person/u);
  }
  assert.deepEqual(resolveDeveloperIdentityConfig("{"), {
    ok: false,
    error: { category: "invalid-input", retryable: false },
  });
  assert.deepEqual(
    resolveDeveloperIdentityConfig(JSON.stringify({ ...base, configVersion: "9" })),
    {
      ok: false,
      error: { category: "unsupported-version", retryable: false },
    },
  );

  const exact = JSON.stringify(base).padEnd(developerIdentityConfigHardLimits.maximumBytes, " ");
  assert.equal(resolveDeveloperIdentityConfig(exact).ok, true);
  assert.equal(resolveDeveloperIdentityConfig(`${exact} `).ok, false);
  assert.equal(
    resolveConfiguration([
      { repositoryId: "repo_synthetic", commitObjectId: "a".repeat(64), kind: "squash" },
    ]).ok,
    true,
  );
});

test("identity and annotation counts accept their exact ceilings and reject the next item", () => {
  const identities = Array.from(
    { length: developerIdentityConfigHardLimits.maximumIdentities },
    (_, index) => ({
      role: index === 0 ? "developer" : "bot",
      name: `Synthetic Identity ${String(index)}`,
      email: `identity-${String(index)}@example.invalid`,
    }),
  );
  assert.equal(resolveConfiguration([], identities).ok, true);
  assert.equal(
    resolveConfiguration(
      [],
      [...identities, { role: "bot", name: "Excess Identity", email: "excess@example.invalid" }],
    ).ok,
    false,
  );
  const annotations = Array.from(
    { length: developerIdentityConfigHardLimits.maximumAnnotations },
    (_, index) => ({
      repositoryId: "repo_synthetic",
      commitObjectId: objectId(index + 1),
      kind: "pair-work",
    }),
  );
  assert.equal(resolveConfiguration(annotations).ok, true);
  assert.equal(
    resolveConfiguration([
      ...annotations,
      { repositoryId: "repo_synthetic", commitObjectId: objectId(300), kind: "pair-work" },
    ]).ok,
    false,
  );
});

test("assessment distinguishes every attribution state and history shape conservatively", () => {
  const annotations = [
    { repositoryId: "repo_synthetic", commitObjectId: objectId(1), kind: "squash" },
    { repositoryId: "repo_synthetic", commitObjectId: objectId(5), kind: "pair-work" },
  ];
  const configured = resolveConfiguration(annotations);
  assert.equal(configured.ok, true);
  if (!configured.ok) return;
  const developer = digestFor(configured.value, "developer");
  const shared = digestFor(configured.value, "shared");
  const bot = digestFor(configured.value, "bot");
  const commits = [
    commit(objectId(1), developer),
    commit(objectId(2), developer, { coauthorIdentityDigests: [unknownDigest] }),
    commit(objectId(3), shared),
    commit(objectId(4), bot),
    commit(objectId(5), unknownDigest),
    commit(objectId(6), unknownDigest),
    commit(objectId(7), developer, {
      parentObjectIds: [objectId(20), objectId(21)],
      committerIdentityDigest: bot,
    }),
    commit(objectId(8), unknownDigest, { coauthorIdentityDigests: [developer] }),
  ];
  const snapshot = {
    kind: "git-metadata-snapshot",
    snapshotVersion: "0.1.0",
    repositories: [
      {
        repositoryId: "repo_synthetic",
        rootId: "root_synthetic",
        objectFormat: "sha1",
        headObjectId: objectId(1),
        shallow: false,
        historyTruncated: false,
        totalCommitBytes: 800,
        commits,
      },
    ],
  };
  const first = assessGitAuthorship(snapshot, configured.value);
  const second = assessGitAuthorship(globalThis.structuredClone(snapshot), configured.value);
  assert.equal(first.ok, true);
  assert.deepEqual(first, second);
  if (!first.ok) return;
  const assessments = first.value.repositories[0]?.assessments ?? [];
  const byId = new Map(assessments.map((item) => [item.commitObjectId, item]));
  assert.deepEqual(
    commits.map((item) => byId.get(item.objectId)?.attributionState),
    [
      "attributed",
      "coauthored",
      "shared",
      "bot",
      "pair-work",
      "unknown",
      "attributed",
      "coauthored",
    ],
  );
  assert.equal(byId.get(objectId(1))?.historyShape, "squash");
  assert.equal(byId.get(objectId(1))?.depthCeiling, "exposure");
  assert.equal(byId.get(objectId(7))?.historyShape, "merge");
  assert.equal(byId.get(objectId(7))?.botInvolved, true);
  assert.equal(byId.get(objectId(7))?.depthCeiling, "practical-use");
  assert.equal(byId.get(objectId(7))?.confidenceCeiling, "medium");
  assert.ok(byId.get(objectId(7))?.limitations.includes("distinct-committer"));
  assert.deepEqual(byId.get(objectId(3))?.evidenceAuthorAssessment, {
    state: "unknown",
    subjectRef: null,
  });
  assert.deepEqual(byId.get(objectId(5))?.evidenceAuthorAssessment, {
    state: "coauthored",
    subjectRef: "subject_synthetic_developer",
  });
  assert.equal(byId.get(objectId(4))?.depthCeiling, null);
  assert.equal(byId.get(objectId(6))?.depthCeiling, null);
  assert.equal(byId.get(objectId(2))?.depthCeiling, "exposure");
  assert.equal(byId.get(objectId(2))?.confidenceCeiling, "low");
  assert.ok(assessments.every((item) => item.confidenceCeiling !== "high"));
  assert.ok(assessments.every((item) => item.standaloneDemonstratedDepthAllowed === false));
  assert.equal(Object.isFrozen(first.value.repositories[0]?.assessments), true);
  assert.doesNotMatch(JSON.stringify(first), /Developer Person|developer@example|src\/synthetic/u);

  const incompleteSnapshot = globalThis.structuredClone(snapshot);
  const incompleteRepository = incompleteSnapshot.repositories[0];
  assert.ok(incompleteRepository);
  incompleteRepository.shallow = true;
  incompleteRepository.historyTruncated = true;
  const incomplete = assessGitAuthorship(incompleteSnapshot, configured.value);
  assert.equal(incomplete.ok, true);
  if (incomplete.ok) {
    assert.ok(
      incomplete.value.repositories[0]?.assessments.every(
        (item) =>
          item.limitations.includes("shallow-history") &&
          item.limitations.includes("history-truncated"),
      ),
    );
  }
});

test("forged configuration, malformed snapshots and dangling annotations fail without partial data", () => {
  const valid = resolveConfiguration();
  assert.equal(valid.ok, true);
  if (!valid.ok) return;
  assert.deepEqual(assessGitAuthorship({}, { ...valid.value }), {
    ok: false,
    error: { category: "not-configured", retryable: false },
  });
  assert.deepEqual(assessGitAuthorship({}, valid.value), {
    ok: false,
    error: { category: "invalid-input", retryable: false },
  });

  const dangling = resolveConfiguration([
    { repositoryId: "repo_synthetic", commitObjectId: objectId(99), kind: "squash" },
  ]);
  assert.equal(dangling.ok, true);
  if (!dangling.ok) return;
  const developer = digestFor(dangling.value, "developer");
  const snapshot = {
    kind: "git-metadata-snapshot",
    snapshotVersion: "0.1.0",
    repositories: [
      {
        repositoryId: "repo_synthetic",
        rootId: "root_synthetic",
        objectFormat: "sha1",
        headObjectId: objectId(1),
        shallow: false,
        historyTruncated: false,
        totalCommitBytes: 100,
        commits: [commit(objectId(1), developer)],
      },
    ],
  };
  assert.deepEqual(assessGitAuthorship(snapshot, dangling.value), {
    ok: false,
    error: { category: "configuration-mismatch", retryable: false },
  });
  const malicious = globalThis.structuredClone(snapshot);
  const maliciousRepository = malicious.repositories[0];
  const maliciousCommit = maliciousRepository?.commits[0];
  assert.ok(maliciousCommit);
  maliciousCommit.changedPaths = ["../CANARY_PRIVATE_PATH"];
  const malformedResult = assessGitAuthorship(malicious, valid.value);
  assert.deepEqual(malformedResult, {
    ok: false,
    error: { category: "invalid-input", retryable: false },
  });
  assert.doesNotMatch(JSON.stringify(malformedResult), /CANARY_PRIVATE_PATH/u);
});

test("the pure identity and assessment boundaries cannot read, execute, network or emit raw identities", async () => {
  const sources = await Promise.all(
    ["git-identity.ts", "developer-identity-config.ts", "git-authorship-assessment.ts"].map(
      (name) =>
        readFile(new URL(`../../packages/community-provider/src/${name}`, import.meta.url), "utf8"),
    ),
  );
  const combined = sources.join("\n");
  assert.doesNotMatch(
    combined,
    /node:(?:fs|child_process|http|https|http2|net|tls|dgram|dns)|\b(?:spawn|exec|eval|Function|fetch)\s*\(/u,
  );
  assert.doesNotMatch(combined, /console\.|process\.env|writeFile|readFile/u);
});
