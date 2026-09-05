import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createLocalFixtureProfileProvider } from "../packages/community-provider/src/index.ts";
import { handleCodexHook } from "../adapters/codex/src/index.ts";

const fixtureRoot = new URL("../fixtures/developer-profile/0.1.0/", import.meta.url);
const now = new Date("2026-09-05T16:00:00Z");

test("M1-S06: Codex delivery preserves demonstrated, adjacent and insufficient intent", async () => {
  const cases = [
    {
      fixture: "demonstrated.json",
      prompt: "Refactor Java",
      required: [/state=demonstrated/u, /response_mode=concise/u],
      forbidden: [/response_mode=analogy/u, /response_mode=teach-while-doing/u],
    },
    {
      fixture: "adjacent.json",
      prompt: "Implement React",
      required: [
        /state=adjacent/u,
        /response_mode=analogy/u,
        /analogy_capabilities=framework\.angular/u,
      ],
      forbidden: [/capability=framework\.react; state=demonstrated/u],
    },
    {
      fixture: "insufficient-evidence.json",
      prompt: "Add GitHub Actions CI",
      required: [
        /state=insufficient-evidence/u,
        /response_mode=teach-while-doing/u,
        /include_risk_and_rollback=yes/u,
        /clarification_question_budget=1/u,
      ],
      forbidden: [/does-not-know|ignor(?:e|ance|ant)/iu],
    },
  ];

  for (const scenario of cases) {
    const output = await handleCodexHook(event(scenario.prompt), {
      provider: await provider(scenario.fixture),
      state: memoryState(),
      clock: () => now,
    });
    const context = output.hookSpecificOutput?.additionalContext ?? "";
    for (const pattern of scenario.required) assert.match(context, pattern);
    for (const pattern of scenario.forbidden) assert.doesNotMatch(context, pattern);
  }
});

test("M1 exit: the same React task produces distinct evidence-appropriate behavior", async () => {
  const prompt = "Implement a synthetic React component";
  const [demonstratedSource, adjacentSource, insufficientSource] = await Promise.all([
    readProfile("demonstrated.json"),
    readProfile("adjacent.json"),
    readProfile("insufficient-evidence.json"),
  ]);
  const demonstratedReact = asDemonstratedReact(demonstratedSource);
  const cases = [
    {
      profile: demonstratedReact,
      required: [
        /capability=framework\.react; state=demonstrated; observed_depth=practical-use/u,
        /response_mode=concise/u,
      ],
      forbidden: [/response_mode=analogy/u, /response_mode=teach-while-doing/u],
    },
    {
      profile: adjacentSource,
      required: [
        /capability=framework\.react; state=adjacent; observed_depth=unobserved/u,
        /response_mode=analogy/u,
        /analogy_capabilities=framework\.angular/u,
      ],
      forbidden: [/capability=framework\.react; state=demonstrated/u],
    },
    {
      profile: insufficientSource,
      required: [
        /response_mode=teach-while-doing/u,
        /explain_command_purpose=yes/u,
        /include_expected_result=yes/u,
        /include_risk_and_rollback=yes/u,
        /clarification_question_budget=1/u,
      ],
      forbidden: [
        /capability=framework\.react; state=(?:demonstrated|adjacent)/u,
        /does-not-know|ignor(?:e|ance|ant)/iu,
      ],
    },
  ];

  const contexts = [];
  for (const scenario of cases) {
    const output = await handleCodexHook(event(prompt), {
      provider: createProvider(scenario.profile),
      state: memoryState(),
      clock: () => now,
    });
    const context = output.hookSpecificOutput?.additionalContext ?? "";
    contexts.push(context);
    for (const pattern of scenario.required) assert.match(context, pattern);
    for (const pattern of scenario.forbidden) assert.doesNotMatch(context, pattern);
  }
  assert.equal(new Set(contexts).size, 3);
});

test("FMU-E-014: unavailable Provider and adapter state do not block ordinary host work", async () => {
  const providerUnavailable = await handleCodexHook(event("Refactor Java"), {
    provider: await provider(null),
    state: memoryState(),
    clock: () => now,
  });
  const adapterUnavailable = await handleCodexHook(event("Refactor Java"), {
    provider: await provider("demonstrated.json"),
    state: {
      async load() {
        throw new Error("synthetic unavailable adapter state");
      },
      async save() {
        throw new Error("synthetic unavailable adapter state");
      },
      async clear() {
        throw new Error("synthetic unavailable adapter state");
      },
    },
    clock: () => now,
  });

  for (const output of [providerUnavailable, adapterUnavailable]) {
    assert.deepEqual(output, { continue: true, suppressOutput: true });
    assert.equal("hookSpecificOutput" in output, false);
    assert.equal("decision" in output, false);
    assert.equal("stopReason" in output, false);
  }
});

async function provider(name) {
  const profile = name === null ? null : await readProfile(name);
  return createProvider(profile);
}

function createProvider(profile) {
  return createLocalFixtureProfileProvider({
    profile,
    clock: () => now,
    createId: (kind) => `${kind}_codex_evaluation`,
  });
}

async function readProfile(name) {
  return JSON.parse(await readFile(new URL(name, fixtureRoot), "utf8"));
}

function asDemonstratedReact(source) {
  const profile = JSON.parse(JSON.stringify(source));
  profile.exportId = "export_evaluation_react_demonstrated";
  profile.profileVersion = "profile_evaluation_react_demonstrated";
  const evidence = profile.profile.evidence[0];
  const claim = profile.profile.claims[0];
  assert.ok(evidence);
  assert.ok(claim);
  evidence.evidenceId = "evidence_evaluation_react";
  evidence.capabilitySignal = "framework.react";
  evidence.source.sourceRelativeRef = "src/react-component.ts";
  evidence.invalidation.fingerprint = "fingerprint_evaluation_react";
  claim.claimId = "claim_evaluation_react_demonstrated";
  claim.capability = "framework.react";
  claim.basis.evidenceRefs = [evidence.evidenceId];
  return profile;
}

function event(prompt) {
  return {
    hook_event_name: "UserPromptSubmit",
    session_id: "session_evaluation",
    turn_id: "turn_evaluation",
    prompt,
  };
}

function memoryState() {
  const values = new Map();
  return {
    async load(sessionId) {
      return values.get(sessionId) ?? null;
    },
    async save(sessionId, value) {
      values.set(sessionId, JSON.parse(JSON.stringify(value)));
    },
    async clear(sessionId) {
      values.delete(sessionId);
    },
  };
}
