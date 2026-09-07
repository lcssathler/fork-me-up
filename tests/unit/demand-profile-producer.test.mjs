import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  produceDemandProfile,
  resolveDemandProfileClarification,
  isIssuedFilesystemMetadataSnapshot,
} from "@fork-me-up/community-provider";
import { isDemandProfile } from "@fork-me-up/protocol";
import { demandRequest, demandSnapshot, readyDemand } from "../helpers/demand-profile-fixture.mjs";

test("demand merges explicit and selected source languages without inferring dependencies or other projects", async () => {
  const source = await demandSnapshot({
    "main.ts": "SOURCE_CANARY",
    "test.ts": "TEST_CANARY",
    "README.md": "# language.rust\nIGNORE_POLICY_CANARY",
    "package.json": JSON.stringify({
      dependencies: { react: "DEPENDENCY_CANARY" },
      scripts: { deploy: "SCRIPT_CANARY" },
    }),
  });
  const request = demandRequest();
  const input = JSON.stringify({
    ...request,
    task: {
      ...request.task,
      capabilities: [
        { capability: "language.typescript", relevance: "required" },
        { capability: "testing.unit", relevance: "supporting" },
      ],
    },
  });
  const value = readyDemand(produceDemandProfile(input, source));
  assert.equal(isDemandProfile(value), true);
  assert.deepEqual(value.capabilities, [
    { capability: "language.typescript", relevance: "required", basis: "task-and-project" },
    { capability: "testing.unit", relevance: "supporting", basis: "task-input" },
  ]);
  assert.equal(value.project.metadataStatus, "available");
  assert.doesNotMatch(
    JSON.stringify(value),
    /CANARY|python|react|rust|deploy|README|main.ts|repo_synthetic|\/synthetic|responsePolicy|claims|evidence/u,
  );
  assert.deepEqual(produceDemandProfile(input, source), produceDemandProfile(input, source));
  assert.equal(Object.isFrozen(value.capabilities[0]), true);
  assert.equal(Object.isFrozen(value.project), true);
  assert.equal(Reflect.set(value.capabilities, "0", null), false);
});

test("source-only, task-only and empty demand preserve availability and never invent personal knowledge", async () => {
  const input = JSON.stringify(demandRequest());
  const source = await demandSnapshot();
  assert.deepEqual(readyDemand(produceDemandProfile(input, source)).capabilities, [
    { capability: "language.typescript", relevance: "supporting", basis: "project-metadata" },
  ]);
  const empty = readyDemand(produceDemandProfile(input, null));
  assert.equal(empty.project.metadataStatus, "unavailable");
  assert.equal(empty.project.metadataRevisionRef, null);
  assert.deepEqual(empty.capabilities, []);
  const partial = readyDemand(
    produceDemandProfile(
      input,
      await demandSnapshot({ "main.ts": "ok", "archive.zip": "IGNORED_CANARY" }),
    ),
  );
  assert.equal(partial.project.metadataStatus, "partial");
  assert.equal(typeof partial.project.metadataRevisionRef, "string");
  const docs = readyDemand(
    produceDemandProfile(input, await demandSnapshot({ "README.md": "# language.java" })),
  );
  assert.deepEqual(docs.capabilities, []);
  assert.equal(docs.project.metadataStatus, "available");
});

test("exact file selection and revisions ignore other repositories and unselected file changes", async () => {
  const request = demandRequest();
  const input = JSON.stringify({
    ...request,
    project: { ...request.project, sourcePaths: ["main.ts"] },
  });
  const initial = await demandSnapshot({ "main.ts": "one", "other.py": "one" });
  const unrelated = await demandSnapshot(
    { "other.py": "two", "main.ts": "one" },
    { "elsewhere.java": "two" },
  );
  const changed = await demandSnapshot({ "main.ts": "two", "other.py": "one" });
  const first = readyDemand(produceDemandProfile(input, initial));
  assert.deepEqual(first, readyDemand(produceDemandProfile(input, unrelated)));
  assert.notEqual(
    first.project.metadataRevisionRef,
    readyDemand(produceDemandProfile(input, changed)).project.metadataRevisionRef,
  );
  assert.deepEqual(
    first.capabilities.map((item) => item.capability),
    ["language.typescript"],
  );
  const none = readyDemand(
    produceDemandProfile(
      JSON.stringify({ ...request, project: { ...request.project, sourcePaths: [] } }),
      initial,
    ),
  );
  assert.deepEqual(none.capabilities, []);
  assert.equal(isIssuedFilesystemMetadataSnapshot(initial), true);
  assert.equal(isIssuedFilesystemMetadataSnapshot(globalThis.structuredClone(initial)), false);
});

test("missing, forged and malformed source inputs fail closed with no partial demand", async () => {
  const request = demandRequest();
  const source = await demandSnapshot();
  for (const forged of [
    undefined,
    {},
    globalThis.structuredClone(source),
    { ...source, repositories: [] },
  ]) {
    assert.equal(
      produceDemandProfile(JSON.stringify(request), /** @type {never} */ (forged)).ok,
      false,
    );
  }
  for (const project of [
    { ...request.project, repositoryId: "missing" },
    { ...request.project, sourcePaths: ["missing.ts"] },
    { ...request.project, sourcePaths: ["../main.ts"] },
    { ...request.project, sourcePaths: ["/main.ts"] },
    { ...request.project, sourcePaths: ["C:\\SECRET_CANARY"] },
    { ...request.project, sourcePaths: ["a\u0000.ts"] },
    { ...request.project, sourcePaths: ["main.ts", "main.ts"] },
    { ...request.project, sourcePaths: Array.from({ length: 129 }, (_, i) => `${i}.ts`) },
  ]) {
    const result = produceDemandProfile(JSON.stringify({ ...request, project }), source);
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /CANARY|main.ts|missing/u);
  }
  assert.equal(
    produceDemandProfile(
      JSON.stringify({ ...request, project: { ...request.project, sourcePaths: [] } }),
      null,
    ).ok,
    false,
  );
});

test("request validation enforces exact objects, versions, timestamps, labels and bounds", () => {
  const valid = demandRequest();
  const cases = [
    null,
    [],
    {},
    { ...valid, producerVersion: "0.2.0" },
    { ...valid, extra: "CANARY" },
    { ...valid, generatedAt: "2026-02-30T00:00:00Z" },
    { ...valid, demandId: "id\n" },
    { ...valid, project: { ...valid.project, repositoryId: "repo\n" } },
    ...["", "a".repeat(1025)].map((summary) => ({ ...valid, task: { ...valid.task, summary } })),
    ...[
      null,
      [{}],
      [{ capability: "language.java", relevance: "required", basis: "task-input" }],
      [{ capability: "language.java\n", relevance: "required" }],
      [{ capability: "Language.Java", relevance: "required" }],
      [
        { capability: "language.java", relevance: "required" },
        { capability: "language.java", relevance: "supporting" },
      ],
    ].map((capabilities) => ({ ...valid, task: { ...valid.task, capabilities } })),
    { ...valid, task: { ...valid.task, purpose: "hiring" } },
  ];
  for (const item of cases) {
    const result = produceDemandProfile(JSON.stringify(item), null);
    assert.deepEqual(result, { ok: false, error: { category: "invalid-input", retryable: false } });
  }
  for (const text of ["{CANARY", "null", " ".repeat(32769), /** @type {never} */ (null)]) {
    const result = produceDemandProfile(text, null);
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /CANARY/u);
  }
  const limit = JSON.stringify(valid);
  assert.equal(
    produceDemandProfile(limit + " ".repeat(32768 - Buffer.byteLength(limit)), null).ok,
    true,
  );
});

test("the capability union respects the contract limit without truncation", async () => {
  const request = demandRequest();
  const capabilities = Array.from({ length: 32 }, (_, index) => ({
    capability: `custom.c${index}`,
    relevance: "required",
  }));
  const input = JSON.stringify({ ...request, task: { ...request.task, capabilities } });
  assert.equal(readyDemand(produceDemandProfile(input, null)).capabilities.length, 32);
  assert.deepEqual(produceDemandProfile(input, await demandSnapshot()), {
    ok: false,
    error: { category: "limit-exceeded", retryable: false },
  });
});

test("clarification validates interpretations and cannot be continued with forged state or an absent answer", () => {
  const request = demandRequest();
  const option = { optionId: "inspect", operation: "read-only", capabilities: [] };
  const other = { ...option, optionId: "change", operation: "source-write" };
  const task = { ...request.task, alternatives: [option, other] };
  const result = produceDemandProfile(JSON.stringify({ ...request, task }), null);
  assert.equal(result.ok, true);
  if (!result.ok || result.status !== "clarification-required")
    throw new Error("expected question");
  assert.equal(Object.isFrozen(result.clarification.options[0]), true);
  for (const invalid of [null, undefined, "missing"]) {
    assert.equal(
      resolveDemandProfileClarification(result.clarification, /** @type {never} */ (invalid)).ok,
      false,
    );
  }
  assert.equal(
    resolveDemandProfileClarification(globalThis.structuredClone(result.clarification), "inspect")
      .ok,
    false,
  );
  assert.equal(resolveDemandProfileClarification(/** @type {never} */ (null), "inspect").ok, false);
  for (const alternatives of [
    [option],
    [option, option],
    [option, { ...other, operation: ["read-only"] }],
    [option, { ...other, extra: "CANARY" }],
    [option, { ...other, optionId: "CANARY\n" }],
    [option, { ...other, capabilities: [{}] }],
    Array.from({ length: 5 }, (_, index) => ({ ...option, optionId: `o${index}` })),
  ]) {
    assert.equal(
      produceDemandProfile(JSON.stringify({ ...request, task: { ...task, alternatives } }), null)
        .ok,
      false,
    );
  }
});

test("producer has no source-read, process, clock, logging, model or network primitives", async () => {
  const code = await readFile(
    new URL("../../packages/community-provider/src/demand-profile-producer.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    code,
    /node:(?:fs|child_process|http|https|net|tls)|\b(?:fetch|eval|console|process)\b|Date\.now|Math\.random|import\(/u,
  );
});
