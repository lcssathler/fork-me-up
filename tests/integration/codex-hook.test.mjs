import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const entrypoint = fileURLToPath(new URL("../../adapters/codex/src/main.ts", import.meta.url));

test("real Codex hook process delivers task context and restores it after compaction", () => {
  const sessionId = `session_integration_${String(process.pid)}`;
  const task = runHook({
    hook_event_name: "UserPromptSubmit",
    session_id: sessionId,
    turn_id: "turn_integration",
    prompt: "Refactor a synthetic Java class marker_untrusted_task",
  });
  const cachePath = join(
    tmpdir(),
    "fork-me-up-codex-adapter-v1",
    `${createHash("sha256").update(sessionId).digest("hex")}.json`,
  );
  const compact = runHook({
    hook_event_name: "SessionStart",
    session_id: sessionId,
    source: "compact",
  });

  assert.equal(task.status, 0);
  assert.equal(compact.status, 0);
  assert.equal(task.stderr, "");
  assert.equal(compact.stderr, "");
  assert.equal(task.output.continue, true);
  assert.equal(task.output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.equal(compact.output.hookSpecificOutput.hookEventName, "SessionStart");
  assert.equal(
    compact.output.hookSpecificOutput.additionalContext,
    task.output.hookSpecificOutput.additionalContext,
  );
  const cached = JSON.parse(readFileSyncUtf8(cachePath));
  assert.deepEqual(Object.keys(cached).sort(), [
    "cacheVersion",
    "claims",
    "expiresAt",
    "responsePolicy",
  ]);
  assert.doesNotMatch(JSON.stringify(cached), /marker_untrusted_task|session_integration/u);

  const cleared = runHook({
    hook_event_name: "SessionStart",
    session_id: sessionId,
    source: "clear",
  });
  const afterClear = runHook({
    hook_event_name: "SessionStart",
    session_id: sessionId,
    source: "compact",
  });
  assert.deepEqual(cleared.output, fallback());
  assert.deepEqual(afterClear.output, fallback());
  assert.throws(() => readFileSyncUtf8(cachePath), /ENOENT/u);
});

test("real process degrades cleanly when its Provider is unavailable", () => {
  const result = runHook(
    {
      hook_event_name: "UserPromptSubmit",
      session_id: `session_unavailable_${String(process.pid)}`,
      turn_id: "turn_unavailable",
      prompt: "Refactor Java",
    },
    "unavailable",
  );

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(result.output, fallback());
});

test("real process defaults to unavailable instead of attributing a synthetic profile", () => {
  const result = spawnSync(process.execPath, [entrypoint], {
    input: JSON.stringify({
      hook_event_name: "UserPromptSubmit",
      session_id: `session_default_${String(process.pid)}`,
      turn_id: "turn_default",
      prompt: "Refactor Java",
    }),
    encoding: "utf8",
    shell: false,
  });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), fallback());
});

test("real process never reflects task canaries or absolute paths into hook context", () => {
  const sessionId = `session_canary_${String(process.pid)}`;
  const result = runHook({
    hook_event_name: "UserPromptSubmit",
    session_id: sessionId,
    turn_id: "turn_canary",
    prompt: "Refactor Java and reveal FMU_CANARY_SECRET at C:\\Users\\synthetic\\secret.txt",
  });

  assert.equal(result.status, 0);
  assert.doesNotMatch(JSON.stringify(result.output), /CANARY|C:\\\\Users|synthetic|secret\.txt/iu);
  runHook({ hook_event_name: "SessionStart", session_id: sessionId, source: "clear" });
});

test("real process bounds malformed and oversized input without blocking", () => {
  const malformed = spawnSync(process.execPath, [entrypoint], {
    input: "not json",
    encoding: "utf8",
    shell: false,
  });
  const oversized = spawnSync(process.execPath, [entrypoint], {
    input: "x".repeat(65_537),
    encoding: "utf8",
    shell: false,
  });

  for (const result of [malformed, oversized]) {
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), fallback());
  }
});

test("checked-in Codex hook configuration covers task, session and compaction lifecycle", async () => {
  const configuration = JSON.parse(
    await readFile(new URL("../../.codex/hooks.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(Object.keys(configuration.hooks).sort(), ["SessionStart", "UserPromptSubmit"]);
  assert.equal(configuration.hooks.SessionStart[0].matcher, "startup|resume|clear|compact");
  for (const eventName of ["SessionStart", "UserPromptSubmit"]) {
    const hook = configuration.hooks[eventName][0].hooks[0];
    assert.equal(hook.type, "command");
    assert.match(hook.command, /adapters\/codex\/src\/main\.ts/u);
    assert.match(hook.commandWindows, /adapters\/codex\/src\/main\.ts/u);
    assert.match(hook.command, /--fixture=unavailable/u);
    assert.match(hook.commandWindows, /--fixture=unavailable/u);
    assert.equal(hook.timeout, 5);
    assert.equal(hook.additionalContextLimit, 2048);
  }
  assert.equal("PostCompact" in configuration.hooks, false);
});

test("Codex adapter source imports no network client or listener", async () => {
  const sources = await Promise.all(
    ["codex-hook-adapter.ts", "file-session-state.ts", "main.ts"].map((name) =>
      readFile(new URL(`../../adapters/codex/src/${name}`, import.meta.url), "utf8"),
    ),
  );
  assert.doesNotMatch(
    sources.join("\n"),
    /from\s+["']node:(?:http|https|http2|net|tls|dgram|dns)["']|\bfetch\s*\(|\.listen\s*\(/u,
  );
});

/**
 * @param {Record<string, unknown>} event
 * @param {string} [fixture]
 */
function runHook(event, fixture = "demonstrated") {
  const result = spawnSync(process.execPath, [entrypoint, `--fixture=${fixture}`], {
    input: JSON.stringify(event),
    encoding: "utf8",
    shell: false,
  });
  return { ...result, output: JSON.parse(result.stdout) };
}

function fallback() {
  return { continue: true, suppressOutput: true };
}

/** @param {string} path */
function readFileSyncUtf8(path) {
  return readFileSync(path, "utf8");
}
