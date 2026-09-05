import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { clearTimeout, setTimeout } from "node:timers";
import { fileURLToPath } from "node:url";
import { isProfileProviderResponse } from "@fork-me-up/protocol";

const entrypoint = fileURLToPath(new URL("../../apps/mcp-local/src/main.ts", import.meta.url));
const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "synthetic-test-client", version: "0.0.0" },
  },
};
const initialized = { jsonrpc: "2.0", method: "notifications/initialized" };

test("the MCP stdio subprocess negotiates, lists only the bounded tools and serves both operations", async () => {
  const canary = "FMU_MCP_CANARY_DO_NOT_LOG";
  const result = await runServer("adjacent", [
    initialize,
    initialized,
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_profile_metadata", arguments: {} },
    },
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "get_task_context",
        arguments: {
          task: "Implement a synthetic React component",
          purpose: "coding-assistance",
          maxTokens: 8192,
          requestedCapabilities: ["framework.react"],
        },
      },
    },
    {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "get_task_context",
        arguments: {
          task: canary,
          purpose: "coding-assistance",
          maxTokens: 8192,
          requestedCapabilities: [],
          developerId: canary,
        },
      },
    },
    {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "get_task_context",
        arguments: {
          task: "Synthetic budget task",
          purpose: "coding-assistance",
          maxTokens: 1,
          requestedCapabilities: [],
        },
      },
    },
    {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "get_task_context",
        arguments: {
          task: `Review ${canary}`,
          purpose: "coding-assistance",
          maxTokens: 8192,
          requestedCapabilities: [],
        },
      },
    },
  ]);

  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.messages.length, 7);
  assert.equal(result.messages[0].result.protocolVersion, "2025-11-25");
  assert.deepEqual(
    result.messages[1].result.tools.map(/** @param {{name: string}} tool */ (tool) => tool.name),
    ["get_task_context", "get_profile_metadata"],
  );
  for (const tool of /** @type {Array<{annotations: object}>} */ (
    result.messages[1].result.tools
  )) {
    assert.deepEqual(tool.annotations, {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
  }
  const metadata = result.messages[2].result.structuredContent;
  assert.equal(metadata.outcome, "success");
  assert.equal(metadata.data.profileVersion, "profile_fixture_angular_react_adjacent");
  assert.equal(Object.hasOwn(metadata.data, "claims"), false);
  const context = result.messages[3].result.structuredContent;
  assert.equal(context.outcome, "success");
  assert.deepEqual(context.data.task.requiredCapabilities, ["framework.react"]);
  assert.deepEqual(
    context.data.claims.map(/** @param {{capability: string}} claim */ (claim) => claim.capability),
    ["framework.react"],
  );
  assert.equal(result.messages[4].result.isError, true);
  assert.equal(result.messages[4].result.structuredContent.error.category, "invalid-input");
  assert.equal(result.messages[5].result.isError, true);
  assert.equal(result.messages[5].result.structuredContent.error.category, "budget-too-small");
  assert.equal(result.messages[6].result.isError, false);
  assert.equal(
    result.messages[6].result.structuredContent.data.task.summary,
    "Sensitive content redacted",
  );
  for (const message of result.messages.slice(2)) {
    assert.equal(isProfileProviderResponse(message.result.structuredContent), true);
    assert.equal(message.result.content[0].text, JSON.stringify(message.result.structuredContent));
  }
  assert.doesNotMatch(result.stdout, /FMU_MCP_CANARY|developerId|Synthetic budget task/u);
});

test("an unavailable fixture returns only typed protected-operation errors", async () => {
  const result = await runServer("unavailable", [
    initialize,
    initialized,
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "get_profile_metadata", arguments: {} },
    },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "get_task_context",
        arguments: {
          task: "Synthetic task",
          purpose: "coding-assistance",
          maxTokens: 8192,
          requestedCapabilities: [],
        },
      },
    },
  ]);

  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  for (const message of result.messages.slice(1)) {
    assert.equal(message.result.isError, true);
    assert.equal(message.result.structuredContent.error.category, "profile-unavailable");
    assert.equal(message.result.structuredContent.data, null);
  }
  assert.doesNotMatch(result.stdout, /Synthetic task/u);
});

test("framing is bounded and stdout remains recoverable JSON-RPC after an oversized line", async () => {
  const result = await runServerRaw("demonstrated", [
    `${"x".repeat(65_537)}\n`,
    `${JSON.stringify({ jsonrpc: "2.0", id: 0, method: "ping" })}\n`,
    `${JSON.stringify(initialize)}\n`,
    `${JSON.stringify(initialized)}\n`,
    `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })}\n`,
    `${JSON.stringify({ jsonrpc: "2.0", id: "FMU_ID_CANARY_DO_NOT_LOG", method: "tools/list" })}\n`,
  ]);

  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.messages[0].error.message, "Request too large.");
  assert.deepEqual(result.messages[1].result, {});
  assert.equal(result.messages[2].result.protocolVersion, "2025-11-25");
  assert.equal(result.messages[3].result.tools.length, 2);
  assert.equal(result.messages[4].id, null);
  assert.equal(result.messages[4].error.message, "Invalid request.");
  assert.doesNotMatch(result.stdout, /FMU_ID_CANARY/u);
});

test("fixture selection rejects paths without echoing them", async () => {
  const result = await runServerRaw("../../FMU_PATH_CANARY", []);

  assert.equal(result.code, 2);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr.trim(), "Invalid fixture selection.");
  assert.doesNotMatch(result.stderr, /FMU_PATH_CANARY/u);
});

test("the local provider and transport source import no network server or client modules", async () => {
  const urls = [
    new URL("../../apps/mcp-local/src/main.ts", import.meta.url),
    new URL("../../apps/mcp-local/src/mcp-stdio-server.ts", import.meta.url),
    new URL(
      "../../packages/community-provider/src/local-fixture-profile-provider.ts",
      import.meta.url,
    ),
  ];
  const source = (await Promise.all(urls.map((url) => readFile(url, "utf8")))).join("\n");

  assert.doesNotMatch(source, /node:(?:net|http|https|tls|dgram)|\bfetch\s*\(/u);
  assert.doesNotMatch(source, /listen\s*\(/u);
});

/**
 * @param {string} fixture
 * @param {unknown[]} messages
 */
async function runServer(fixture, messages) {
  return runServerRaw(
    fixture,
    messages.map((message) => `${JSON.stringify(message)}\n`),
  );
}

/**
 * @param {string} fixture
 * @param {string[]} chunks
 */
async function runServerRaw(fixture, chunks) {
  const child = spawn(process.execPath, [entrypoint, `--fixture=${fixture}`], {
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  for (const chunk of chunks) child.stdin.write(chunk, "utf8");
  child.stdin.end();

  const code = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("MCP subprocess timed out."));
    }, 5000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (exitCode) => {
      clearTimeout(timeout);
      resolve(exitCode);
    });
  });
  const lines = stdout.split(/\r?\n/u).filter((line) => line.length > 0);
  return { code, stdout, stderr, messages: lines.map((line) => JSON.parse(line)) };
}
