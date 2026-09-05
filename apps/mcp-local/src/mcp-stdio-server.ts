import { once } from "node:events";
import { Buffer } from "node:buffer";
import type { LocalFixtureProfileProvider } from "@fork-me-up/community-provider";

const mcpProtocolVersion = "2025-11-25";
const maximumInputLineBytes = 65_536;
// structuredContent plus its compatibility text copy can approach three times the Provider JSON.
const maximumOutputLineBytes = 131_072;
const opaqueRequestIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;
const sensitiveRequestIdPattern =
  /CANARY|(?:ghp_|github_pat_|sk-)|AKIA[0-9A-Z]{16}|password|secret|token/iu;

type JsonRpcId = string | number | null;
type InputStream = NodeJS.ReadableStream & AsyncIterable<Uint8Array | string>;

export async function serveMcpStdio(
  provider: LocalFixtureProfileProvider,
  input: InputStream,
  output: NodeJS.WritableStream,
): Promise<void> {
  let initializeResponded = false;
  let initialized = false;
  let requestSequence = 0;
  let droppingOversizedLine = false;
  let pendingBytes: number[] = [];

  const writeMessage = async (message: object): Promise<void> => {
    let line = JSON.stringify(message);
    if (Buffer.byteLength(line, "utf8") > maximumOutputLineBytes) {
      line = JSON.stringify(jsonRpcError(null, -32603, "Internal error."));
    }
    if (!output.write(`${line}\n`, "utf8")) await once(output, "drain");
  };

  const processLine = async (bytes: readonly number[]): Promise<void> => {
    let message: unknown;
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
      message = JSON.parse(text);
    } catch {
      await writeMessage(jsonRpcError(null, -32700, "Parse error."));
      return;
    }

    if (isNotification(message)) {
      if (message.method === "notifications/initialized" && initializeResponded) initialized = true;
      return;
    }
    if (!isRequest(message)) {
      await writeMessage(jsonRpcError(getResponseId(message), -32600, "Invalid request."));
      return;
    }

    if (message.method === "ping") {
      await writeMessage(jsonRpcResult(message.id, {}));
      return;
    }
    if (message.method === "initialize") {
      if (initializeResponded || !isInitializeParams(message.params)) {
        await writeMessage(jsonRpcError(message.id, -32602, "Invalid initialize parameters."));
        return;
      }
      initializeResponded = true;
      await writeMessage(
        jsonRpcResult(message.id, {
          protocolVersion:
            message.params.protocolVersion === mcpProtocolVersion
              ? message.params.protocolVersion
              : mcpProtocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "fork-me-up-local", version: "0.0.0" },
        }),
      );
      return;
    }
    if (!initialized) {
      await writeMessage(jsonRpcError(message.id, -32002, "Server not initialized."));
      return;
    }
    if (message.method === "tools/list") {
      if (!isListToolsParams(message.params)) {
        await writeMessage(jsonRpcError(message.id, -32602, "Invalid tool-list parameters."));
        return;
      }
      await writeMessage(jsonRpcResult(message.id, { tools: toolDefinitions }));
      return;
    }
    if (message.method !== "tools/call") {
      await writeMessage(jsonRpcError(message.id, -32601, "Method not found."));
      return;
    }
    if (!isCallToolParams(message.params)) {
      await writeMessage(jsonRpcError(message.id, -32602, "Invalid tool-call parameters."));
      return;
    }

    const operation =
      message.params.name === "get_task_context"
        ? "get-task-context"
        : message.params.name === "get_profile_metadata"
          ? "get-profile-metadata"
          : null;
    if (operation === null) {
      await writeMessage(jsonRpcError(message.id, -32602, "Unknown tool."));
      return;
    }
    requestSequence += 1;
    const providerResponse = provider.invoke({
      schemaVersion: "0.1.0",
      kind: "profile-provider-request",
      requestId: `request_mcp_${String(requestSequence)}`,
      operation,
      input: message.params.arguments ?? {},
    });
    const serializedResponse = JSON.stringify(providerResponse);
    await writeMessage(
      jsonRpcResult(message.id, {
        content: [{ type: "text", text: serializedResponse }],
        structuredContent: providerResponse,
        isError: providerResponse.outcome === "error",
      }),
    );
  };

  for await (const chunk of input) {
    const bytes = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
    for (const byte of bytes) {
      if (droppingOversizedLine) {
        if (byte === 0x0a) droppingOversizedLine = false;
        continue;
      }
      if (byte === 0x0a) {
        if (pendingBytes.at(-1) === 0x0d) pendingBytes.pop();
        await processLine(pendingBytes);
        pendingBytes = [];
        continue;
      }
      if (pendingBytes.length === maximumInputLineBytes) {
        pendingBytes = [];
        droppingOversizedLine = true;
        await writeMessage(jsonRpcError(null, -32600, "Request too large."));
        continue;
      }
      pendingBytes.push(byte);
    }
  }
  if (!droppingOversizedLine && pendingBytes.length > 0) await processLine(pendingBytes);
}

const taskContextInputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["task", "purpose", "maxTokens", "requestedCapabilities"],
  properties: {
    task: { type: "string", minLength: 1, maxLength: 1024 },
    purpose: {
      type: "string",
      enum: ["coding-assistance", "technical-learning", "professional-preparation"],
    },
    maxTokens: { type: "integer", minimum: 1, maximum: 8192 },
    requestedCapabilities: {
      type: "array",
      maxItems: 32,
      uniqueItems: true,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 128,
        pattern: "^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$",
      },
    },
  },
} as const;

const toolDefinitions = Object.freeze([
  {
    name: "get_task_context",
    description:
      "Compile a bounded task-scoped Developer Context Packet from the local fixture profile.",
    inputSchema: taskContextInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "get_profile_metadata",
    description:
      "Return bounded freshness and coverage metadata without returning the complete profile.",
    inputSchema: { type: "object", additionalProperties: false, maxProperties: 0 },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
]);

function jsonRpcResult(id: Exclude<JsonRpcId, null>, result: object): object {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id: JsonRpcId, code: number, message: string): object {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function isRequest(
  value: unknown,
): value is { jsonrpc: "2.0"; id: string | number; method: string; params?: unknown } {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["jsonrpc", "id", "method", "params"]) &&
    value["jsonrpc"] === "2.0" &&
    isRequestId(value["id"]) &&
    typeof value["method"] === "string"
  );
}

function isNotification(
  value: unknown,
): value is { jsonrpc: "2.0"; method: string; params?: unknown } {
  return (
    isRecord(value) &&
    !Object.hasOwn(value, "id") &&
    hasOnlyKeys(value, ["jsonrpc", "method", "params"]) &&
    value["jsonrpc"] === "2.0" &&
    typeof value["method"] === "string"
  );
}

function isInitializeParams(value: unknown): value is {
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  clientInfo: { name: string; version: string };
} {
  return (
    isRecord(value) &&
    typeof value["protocolVersion"] === "string" &&
    isRecord(value["capabilities"]) &&
    isRecord(value["clientInfo"]) &&
    typeof value["clientInfo"]["name"] === "string" &&
    typeof value["clientInfo"]["version"] === "string"
  );
}

function isListToolsParams(value: unknown): boolean {
  return (
    value === undefined ||
    (isRecord(value) &&
      hasOnlyKeys(value, ["cursor"]) &&
      (value["cursor"] === undefined || typeof value["cursor"] === "string"))
  );
}

function isCallToolParams(
  value: unknown,
): value is { name: string; arguments?: Record<string, unknown> } {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["name", "arguments", "_meta"]) &&
    typeof value["name"] === "string" &&
    (value["arguments"] === undefined || isRecord(value["arguments"])) &&
    (value["_meta"] === undefined || isRecord(value["_meta"]))
  );
}

function getResponseId(value: unknown): JsonRpcId {
  if (!isRecord(value)) return null;
  return isRequestId(value["id"]) ? value["id"] : null;
}

function isRequestId(value: unknown): value is string | number {
  return (
    (typeof value === "string" &&
      opaqueRequestIdPattern.test(value) &&
      !sensitiveRequestIdPattern.test(value)) ||
    (typeof value === "number" && Number.isSafeInteger(value))
  );
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
