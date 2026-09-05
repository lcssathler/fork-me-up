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
  const profile =
    name === null ? null : JSON.parse(await readFile(new URL(name, fixtureRoot), "utf8"));
  return createLocalFixtureProfileProvider({
    profile,
    clock: () => now,
    createId: (kind) => `${kind}_codex_evaluation`,
  });
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
