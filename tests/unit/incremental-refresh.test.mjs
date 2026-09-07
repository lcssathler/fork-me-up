import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createIncrementalRefreshSession,
  nodeRepositoryFingerprintPort,
  refreshLocalRepositories,
} from "@fork-me-up/community-provider";
import { isIssuedFilesystemMetadataSnapshot } from "@fork-me-up/community-provider";
import { selectAuthorizedRepository } from "../../packages/community-provider/src/authorized-repository-config.ts";
import {
  refreshFixture,
  refreshRequest,
  refreshValue,
  mockGit,
} from "../helpers/incremental-refresh-fixture.mjs";

test("cold and cached multi-repository refresh preserve provenance and observation age without content reads or Git calls", async (context) => {
  const fixture = await refreshFixture(context);
  const session = fixture.session();
  const cold = refreshValue(await refreshLocalRepositories(session, refreshRequest()));
  assert.equal(cold.status, "fresh");
  assert.equal(cold.work.collections, 2);
  assert.deepEqual(
    cold.repositories.map((item) => item.reason),
    ["cold", "cold"],
  );
  assert.equal(cold.derivation?.claims.length, 2);
  assert.equal(cold.filesystemSnapshots.every(isIssuedFilesystemMetadataSnapshot), true);
  const counts = { ...fixture.stats };
  assert.ok(counts.reads > 0 && counts.commands > 0);
  const hit = refreshValue(
    await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:01Z")),
  );
  assert.equal(hit.status, "fresh");
  assert.equal(hit.work.collections, 0);
  assert.deepEqual(fixture.stats, counts);
  assert.deepEqual(
    hit.repositories.map((item) => item.origin),
    ["memory-cache", "memory-cache"],
  );
  assert.equal(hit.derivation?.sourceObservedAt, "2026-09-07T12:00:00Z");
  assert.equal(hit.derivation?.derivedAt, "2026-09-07T12:00:01Z");
  assert.equal(
    hit.repositories.every((item) => item.collectedAt === "2026-09-07T12:00:00Z"),
    true,
  );
  assert.equal(hit.derivation?.invalidation.evidence.length, 0);
  assert.equal(Object.isFrozen(hit.repositories[0]), true);
  assert.doesNotMatch(
    JSON.stringify([cold, hit]),
    /SOURCE_CANARY|OTHER_CANARY|MESSAGE_CANARY|unit@example|Unit Person/u,
  );
  assert.equal(JSON.stringify(hit).includes(fixture.root), false);
  const aged = refreshValue(
    await refreshLocalRepositories(
      session,
      refreshRequest("2026-09-07T12:00:02Z", false, "2026-09-07T12:00:01Z"),
    ),
  );
  assert.equal(
    aged.derivation?.claims.every((claim) => claim.freshness.stale),
    true,
  );
  assert.equal(aged.derivation?.invalidation.claims.length, 2);
});

test("same-size restored-mtime change rescans only its repository and updates duplicate ceilings globally", async (context) => {
  const fixture = await refreshFixture(context);
  const session = fixture.session();
  const cold = refreshValue(await refreshLocalRepositories(session, refreshRequest()));
  assert.equal(
    cold.derivation?.evidence.every((item) => item.strength === "weak"),
    true,
  );
  const file = path.join(fixture.b, "main.ts");
  const metadata = await stat(file);
  await writeFile(file, "export const SOURCE_CANARY = 3;\n");
  await utimes(file, metadata.atime, metadata.mtime);
  await writeFile(path.join(fixture.b, "extra.ts"), "export const OTHER_CANARY = 4;\n");
  const next = refreshValue(
    await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:01Z")),
  );
  assert.equal(next.status, "fresh");
  assert.equal(next.work.collections, 1);
  assert.deepEqual(
    next.repositories.map((item) => item.reason),
    ["unchanged", "fingerprint-changed"],
  );
  assert.equal(
    next.derivation?.evidence.every((item) => item.strength === "moderate"),
    true,
  );
  assert.equal(
    next.derivation?.claims.every((item) => item.observedDepth === "practical-use"),
    true,
  );
  assert.equal(next.derivation?.invalidation.evidence.length, 4);
  assert.equal(next.derivation?.sourceObservedAt, "2026-09-07T12:00:00Z");
});

test("TTL is based on original collection, supports zero age and force, and restart has no inherited cache", async (context) => {
  const fixture = await refreshFixture(context);
  const session = fixture.session({ maxCacheAgeMs: 2000 });
  refreshValue(await refreshLocalRepositories(session, refreshRequest()));
  const hit = refreshValue(
    await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:01Z")),
  );
  assert.equal(hit.work.collections, 0);
  const expired = refreshValue(
    await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:02Z")),
  );
  assert.deepEqual(
    expired.repositories.map((item) => item.reason),
    ["expired", "expired"],
  );
  const forced = refreshValue(
    await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:03Z", true)),
  );
  assert.deepEqual(
    forced.repositories.map((item) => item.reason),
    ["forced", "forced"],
  );
  const zero = fixture.session({ maxCacheAgeMs: 0 });
  refreshValue(await refreshLocalRepositories(zero, refreshRequest()));
  assert.equal(
    refreshValue(await refreshLocalRepositories(zero, refreshRequest())).work.collections,
    2,
  );
  assert.equal(
    refreshValue(await refreshLocalRepositories(fixture.session(), refreshRequest())).work
      .collections,
    2,
  );
});

test("unavailable duplicate peer withholds aggregate payload and recovery reuses valid cached sources", async (context) => {
  const fixture = await refreshFixture(context);
  let unavailable = false;
  const session = fixture.session(
    {},
    {
      fingerprintPort: {
        ...nodeRepositoryFingerprintPort,
        async inspect(candidate) {
          if (unavailable && candidate === fixture.b) throw new Error("NATIVE_ERROR_CANARY");
          return nodeRepositoryFingerprintPort.inspect(candidate);
        },
      },
    },
  );
  const cold = refreshValue(await refreshLocalRepositories(session, refreshRequest()));
  unavailable = true;
  const partial = refreshValue(
    await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:01Z")),
  );
  assert.equal(partial.status, "partial");
  assert.equal(partial.repositories[1]?.status, "stale");
  assert.equal(partial.repositories[1]?.collectedAt, cold.repositories[1]?.collectedAt);
  assert.equal(partial.derivation, null);
  assert.deepEqual(partial.filesystemSnapshots, []);
  assert.doesNotMatch(JSON.stringify(partial), /CANARY|main.ts|evidence_/u);
  unavailable = false;
  const recovered = refreshValue(
    await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:02Z")),
  );
  assert.equal(recovered.status, "fresh");
  assert.equal(recovered.work.collections, 0);
  assert.equal(
    recovered.derivation?.evidence.every((item) => item.strength === "weak"),
    true,
  );
});

test("invalid canonical replacement evicts affected cache and cannot return stale source payload", async (context) => {
  const fixture = await refreshFixture(context);
  let invalid = false;
  const session = fixture.session(
    {},
    {
      fingerprintPort: {
        ...nodeRepositoryFingerprintPort,
        async inspect(candidate) {
          const entry = await nodeRepositoryFingerprintPort.inspect(candidate);
          return invalid && candidate === fixture.b
            ? { ...entry, canonicalPath: `${fixture.b}-outside` }
            : entry;
        },
      },
    },
  );
  refreshValue(await refreshLocalRepositories(session, refreshRequest()));
  invalid = true;
  const result = refreshValue(
    await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:01Z")),
  );
  assert.equal(result.repositories[1]?.status, "invalid");
  assert.equal(result.repositories[1]?.fingerprint, null);
  assert.equal(result.derivation, null);
  invalid = false;
  assert.equal(
    refreshValue(await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:02Z")))
      .repositories[1]?.reason,
    "cold",
  );
});

test("collection, probe and cache budgets expose partial or invalid state and allow subsequent progress", async (context) => {
  const fixture = await refreshFixture(context);
  const limited = fixture.session({ maxCollections: 1 });
  const first = refreshValue(await refreshLocalRepositories(limited, refreshRequest()));
  assert.equal(first.status, "partial");
  assert.equal(first.work.collections, 1);
  assert.equal(first.repositories[1]?.reason, "budget-exhausted");
  const next = refreshValue(
    await refreshLocalRepositories(limited, refreshRequest("2026-09-07T12:00:01Z")),
  );
  assert.equal(next.status, "fresh");
  assert.equal(next.work.collections, 1);
  const tinyProbe = refreshValue(
    await refreshLocalRepositories(fixture.session({ maxProbeEntries: 1 }), refreshRequest()),
  );
  assert.equal(tinyProbe.status, "invalid");
  assert.ok(tinyProbe.work.probeEntries <= 1);
  assert.equal(tinyProbe.work.collections, 0);
  const tinyCache = refreshValue(
    await refreshLocalRepositories(fixture.session({ maxCacheBytes: 1 }), refreshRequest()),
  );
  assert.equal(tinyCache.status, "invalid");
  assert.equal(tinyCache.work.cacheBytes, 0);
  assert.equal(
    tinyCache.repositories.every((item) => item.reason === "cache-limit"),
    true,
  );
});

test("changed source during collection is rejected and a later stable attempt can recover", async (context) => {
  const fixture = await refreshFixture(context);
  let mutate = true;
  const session = fixture.session(
    {},
    {
      commandPort: {
        async run(request) {
          if (mutate && request.objectDirectory === path.join(fixture.a, ".git", "objects")) {
            mutate = false;
            await writeFile(
              path.join(fixture.a, "main.ts"),
              "export const CHANGED_CANARY = true;\n",
            );
          }
          return mockGit.run(request);
        },
      },
    },
  );
  const interrupted = refreshValue(await refreshLocalRepositories(session, refreshRequest()));
  assert.equal(interrupted.repositories[0]?.reason, "source-changed");
  assert.equal(interrupted.derivation, null);
  assert.equal(
    refreshValue(await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:01Z")))
      .status,
    "fresh",
  );
});

test("session authority/configuration and refresh input validation are exact, bounded and content-free", async (context) => {
  const fixture = await refreshFixture(context);
  const { authorization, identity, risk, settings } = fixture;
  for (const [auth, ids, risks] of [
    [{ ...authorization }, identity, risk],
    [authorization, { ...identity }, risk],
    [authorization, identity, { ...risk }],
  ]) {
    assert.equal(
      createIncrementalRefreshSession(
        /** @type {never} */ (auth),
        /** @type {never} */ (ids),
        /** @type {never} */ (risks),
        JSON.stringify(settings),
      ).ok,
      false,
    );
  }
  const badConfigs = [
    null,
    {},
    { ...settings, refreshVersion: "2" },
    { ...settings, secret: "CANARY" },
    { ...settings, repositoryProjects: [] },
    {
      ...settings,
      repositoryProjects: [settings.repositoryProjects[0], settings.repositoryProjects[0]],
    },
    {
      ...settings,
      repositoryProjects: [
        { repositoryId: "unknown", projectRef: "p" },
        settings.repositoryProjects[1],
      ],
    },
  ];
  for (const [key, value] of [
    ["maxCacheAgeMs", 300001],
    ["maxDurationMs", 0],
    ["maxCacheBytes", 16777217],
    ["maxProbeEntries", 100001],
    ["maxCollections", 3],
    ["maxCollections", 1.5],
  ])
    badConfigs.push({ ...settings, limits: { ...settings.limits, [String(key)]: value } });
  for (const bad of badConfigs)
    assert.equal(
      createIncrementalRefreshSession(authorization, identity, risk, JSON.stringify(bad)).ok,
      false,
    );
  const session = fixture.session();
  const valid = JSON.parse(refreshRequest());
  for (const bad of [
    null,
    {},
    { ...valid, refreshVersion: "2" },
    { ...valid, force: "true" },
    { ...valid, observedAt: "2026-02-30T00:00:00Z" },
    { ...valid, staleBefore: "2027-01-01T00:00:00Z" },
    { ...valid, secret: "CANARY" },
  ]) {
    assert.deepEqual(await refreshLocalRepositories(session, JSON.stringify(bad)), {
      ok: false,
      error: { category: "invalid-input", retryable: false },
    });
  }
  for (const text of ["{CANARY", " ".repeat(32769)])
    assert.equal((await refreshLocalRepositories(session, text)).ok, false);
  assert.equal((await refreshLocalRepositories({ ...session }, refreshRequest())).ok, false);
  assert.equal(
    (await refreshLocalRepositories(/** @type {never} */ (null), refreshRequest())).ok,
    false,
  );
  refreshValue(await refreshLocalRepositories(session, refreshRequest()));
  assert.equal(
    (await refreshLocalRepositories(session, refreshRequest("2026-09-07T11:59:59Z"))).ok,
    false,
  );
  assert.equal(selectAuthorizedRepository(authorization, "repo_a", 30001), null);
  assert.equal(selectAuthorizedRepository(authorization, "unknown", 1), null);
  assert.equal(selectAuthorizedRepository({ ...authorization }, "repo_a", 1), null);
  assert.equal(selectAuthorizedRepository(authorization, "repo_a", 1)?.repositories.length, 1);
});

test("concurrent calls cannot mutate one cache concurrently and invalid clocks return no source", async (context) => {
  const fixture = await refreshFixture(context);
  /** @type {() => void} */
  let release = () => {};
  const gate = new Promise((resolve) => {
    release = () => resolve(undefined);
  });
  const session = fixture.session(
    {},
    {
      fingerprintPort: {
        ...nodeRepositoryFingerprintPort,
        async inspect(candidate) {
          await gate;
          return nodeRepositoryFingerprintPort.inspect(candidate);
        },
      },
    },
  );
  const first = refreshLocalRepositories(session, refreshRequest());
  assert.deepEqual(await refreshLocalRepositories(session, refreshRequest()), {
    ok: false,
    error: { category: "busy", retryable: false },
  });
  release();
  assert.equal(refreshValue(await first).status, "fresh");
  assert.deepEqual(
    await refreshLocalRepositories(fixture.session({}, { now: () => NaN }), refreshRequest()),
    { ok: false, error: { category: "invalid-clock", retryable: false } },
  );
  let tick = 0;
  const exhausted = refreshValue(
    await refreshLocalRepositories(
      fixture.session({ maxDurationMs: 2 }, { now: () => tick++ }),
      refreshRequest(),
    ),
  );
  assert.equal(exhausted.derivation, null);
  assert.equal(exhausted.work.collections, 0);
});

test("refresh orchestration adds no network, arbitrary subprocess, persistent writes or logging", async () => {
  const source = await readFile(
    new URL("../../packages/community-provider/src/incremental-refresh.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /node:(?:fs|child_process|http|https|net|tls)|\b(?:fetch|eval|console|spawn|writeFile)\b|Date\.now|Math\.random/u,
  );
});

test("failed enumeration is charged against the aggregate probe budget", async (context) => {
  const fixture = await refreshFixture(context);
  let enumerated = 0;
  let lists = 0;
  const session = fixture.session(
    { maxProbeEntries: 30 },
    {
      fingerprintPort: {
        ...nodeRepositoryFingerprintPort,
        async list(_directory, maximum) {
          lists += 1;
          enumerated += maximum;
          throw new Error("ENUMERATION_CANARY");
        },
      },
    },
  );
  const result = refreshValue(await refreshLocalRepositories(session, refreshRequest()));
  assert.equal(lists, 1);
  assert.ok(enumerated <= 30);
  assert.equal(result.work.probeEntries, 30);
  assert.equal(result.work.collections, 0);
  assert.equal(result.derivation, null);
});

test("cache byte ceiling includes the retained previous derivation", async (context) => {
  const fixture = await refreshFixture(context);
  const cold = refreshValue(await refreshLocalRepositories(fixture.session(), refreshRequest()));
  assert.ok(cold.derivation);
  const derivationBytes = Buffer.byteLength(JSON.stringify(cold.derivation), "utf8");
  assert.ok(cold.work.cacheBytes > derivationBytes);
  const limit = cold.work.cacheBytes - derivationBytes + 1;
  const constrained = refreshValue(
    await refreshLocalRepositories(fixture.session({ maxCacheBytes: limit }), refreshRequest()),
  );
  assert.equal(constrained.status, "invalid");
  assert.equal(constrained.derivation, null);
  assert.ok(constrained.work.cacheBytes <= limit);
});

test("negative or regressing session clocks cannot return a warmed cache as fresh", async (context) => {
  const fixture = await refreshFixture(context);
  let tick = 10;
  const session = fixture.session({}, { now: () => tick });
  assert.equal(
    refreshValue(await refreshLocalRepositories(session, refreshRequest())).status,
    "fresh",
  );
  tick = 9;
  assert.deepEqual(
    await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:01Z")),
    { ok: false, error: { category: "invalid-clock", retryable: false } },
  );
  tick = -1;
  assert.deepEqual(
    await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:02Z")),
    { ok: false, error: { category: "invalid-clock", retryable: false } },
  );
});

test("collector budget failures retain only stale metadata with the budget reason", async (context) => {
  const fixture = await refreshFixture(context);
  let expire = false;
  const session = fixture.session(
    {},
    {
      commandPort: {
        async run(request) {
          return expire ? { ok: false, reason: "deadline-exceeded" } : mockGit.run(request);
        },
      },
    },
  );
  assert.equal(
    refreshValue(await refreshLocalRepositories(session, refreshRequest())).status,
    "fresh",
  );
  expire = true;
  const stale = refreshValue(
    await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:01Z", true)),
  );
  assert.equal(stale.status, "stale");
  assert.equal(
    stale.repositories.every((item) => item.reason === "budget-exhausted"),
    true,
  );
  assert.equal(stale.derivation, null);
  assert.deepEqual(stale.filesystemSnapshots, []);
});

test("a one-time clock exception inside a probe invalidates the warmed source cache", async (context) => {
  const fixture = await refreshFixture(context);
  let arm = false;
  let throwNext = false;
  const session = fixture.session(
    {},
    {
      now: () => {
        if (throwNext) {
          throwNext = false;
          throw new Error("CLOCK_CANARY");
        }
        return 0;
      },
      fingerprintPort: {
        ...nodeRepositoryFingerprintPort,
        async inspect(candidate) {
          const entry = await nodeRepositoryFingerprintPort.inspect(candidate);
          if (arm) {
            arm = false;
            throwNext = true;
          }
          return entry;
        },
      },
    },
  );
  assert.equal(
    refreshValue(await refreshLocalRepositories(session, refreshRequest())).status,
    "fresh",
  );
  arm = true;
  assert.deepEqual(
    await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:01Z")),
    { ok: false, error: { category: "invalid-clock", retryable: false } },
  );
  const recovered = refreshValue(
    await refreshLocalRepositories(session, refreshRequest("2026-09-07T12:00:02Z")),
  );
  assert.equal(recovered.status, "fresh");
  assert.equal(recovered.work.collections, 2);
});
