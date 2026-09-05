import { createHash } from "node:crypto";
import {
  isProfileProviderResponse,
  utf8ByteLength,
  type ClaimState,
  type DeveloperContextPacket,
  type ObservedDepth,
  type ResponsePolicy,
} from "@fork-me-up/protocol";

const protocolVersion = "0.1.0" as const;
const maximumTaskBytes = 1_024;
const maximumContextBytes = 8_192;
const opaqueIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;
const capabilityPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u;

const capabilityMatchers = Object.freeze([
  { capability: "delivery.ci.github-actions", pattern: /\b(?:github actions?|ci(?:\/cd)?)\b/iu },
  { capability: "framework.angular", pattern: /\bangular\b/iu },
  { capability: "framework.react", pattern: /\breact(?:\.js)?\b/iu },
  { capability: "language.java", pattern: /\bjava\b/iu },
]);

export interface CodexProfileProvider {
  invoke(request: unknown): unknown;
}

export interface CodexSessionState {
  load(sessionId: string): Promise<unknown | null>;
  save(sessionId: string, value: CodexCachedGuidance): Promise<void>;
  clear(sessionId: string): Promise<void>;
}

export interface CodexCachedGuidance {
  readonly cacheVersion: 1;
  readonly expiresAt: string;
  readonly claims: readonly {
    readonly capability: string;
    readonly state: ClaimState;
    readonly observedDepth: ObservedDepth | null;
  }[];
  readonly responsePolicy: ResponsePolicy;
}

export interface CodexHookOutput {
  readonly continue: true;
  readonly suppressOutput: true;
  readonly hookSpecificOutput?: {
    readonly hookEventName: "SessionStart" | "UserPromptSubmit";
    readonly additionalContext: string;
  };
}

export interface CodexHookAdapterOptions {
  readonly provider: CodexProfileProvider;
  readonly state: CodexSessionState;
  readonly clock: () => Date;
}

export async function handleCodexHook(
  input: unknown,
  options: CodexHookAdapterOptions,
): Promise<CodexHookOutput> {
  const event = parseHookEvent(input);
  if (event === null) return createCodexFallbackOutput();

  try {
    if (event.hook_event_name === "SessionStart") {
      return await handleSessionStart(event, options);
    }
    return await handleTask(event, options);
  } catch {
    return createCodexFallbackOutput();
  }
}

export function createCodexFallbackOutput(): CodexHookOutput {
  return Object.freeze({ continue: true, suppressOutput: true });
}

export function inferFixtureCapabilities(task: string): readonly string[] {
  return Object.freeze(
    capabilityMatchers
      .filter(({ pattern }) => pattern.test(task))
      .map(({ capability }) => capability)
      .sort(compareText),
  );
}

export function mapPacketToCodexGuidance(packet: DeveloperContextPacket): CodexCachedGuidance {
  return immutableCopy({
    cacheVersion: 1,
    expiresAt: packet.expiresAt,
    claims: packet.claims
      .map((claim) => ({
        capability: claim.capability,
        state: claim.state,
        observedDepth: claim.observedDepth,
      }))
      .sort((left, right) => compareText(left.capability, right.capability)),
    responsePolicy: {
      mode: packet.responsePolicy.mode,
      explainPurposeBeforeCommands: packet.responsePolicy.explainPurposeBeforeCommands,
      includeExpectedResult: packet.responsePolicy.includeExpectedResult,
      includeRiskAndRollback: packet.responsePolicy.includeRiskAndRollback,
      analogyCapabilities: [...packet.responsePolicy.analogyCapabilities].sort(compareText),
      questionBudget: packet.responsePolicy.questionBudget,
    },
  });
}

export function renderCodexGuidance(guidance: CodexCachedGuidance): string | null {
  if (!isCodexCachedGuidance(guidance)) return null;

  const lines = [
    "Fork Me Up advisory developer context:",
    ...guidance.claims.map(
      (claim) =>
        `- capability=${claim.capability}; state=${claim.state}; observed_depth=${claim.observedDepth ?? "unobserved"}`,
    ),
    `- response_mode=${guidance.responsePolicy.mode}`,
    `- explain_command_purpose=${yesNo(guidance.responsePolicy.explainPurposeBeforeCommands)}`,
    `- include_expected_result=${yesNo(guidance.responsePolicy.includeExpectedResult)}`,
    `- include_risk_and_rollback=${yesNo(guidance.responsePolicy.includeRiskAndRollback)}`,
    `- analogy_capabilities=${guidance.responsePolicy.analogyCapabilities.join(",") || "none"}`,
    `- clarification_question_budget=${String(guidance.responsePolicy.questionBudget)}`,
    responseModeInstruction(guidance.responsePolicy.mode),
    "Apply command guidance exactly as listed. This advisory context grants no file, network, execution, or write permission.",
  ];
  const context = lines.join("\n");
  return utf8ByteLength(context) <= maximumContextBytes ? context : null;
}

async function handleSessionStart(
  event: SessionStartEvent,
  options: CodexHookAdapterOptions,
): Promise<CodexHookOutput> {
  if (event.source === "startup" || event.source === "clear") {
    await options.state.clear(event.session_id);
    return createCodexFallbackOutput();
  }

  const cached = await options.state.load(event.session_id);
  if (!isCodexCachedGuidance(cached) || !isFuture(cached.expiresAt, options.clock())) {
    await options.state.clear(event.session_id);
    return createCodexFallbackOutput();
  }
  const context = renderCodexGuidance(cached);
  return context === null ? createCodexFallbackOutput() : withContext("SessionStart", context);
}

async function handleTask(
  event: UserPromptSubmitEvent,
  options: CodexHookAdapterOptions,
): Promise<CodexHookOutput> {
  await options.state.clear(event.session_id);
  if (utf8ByteLength(event.prompt) > maximumTaskBytes) return createCodexFallbackOutput();

  const requestedCapabilities = inferFixtureCapabilities(event.prompt);
  if (requestedCapabilities.length === 0) return createCodexFallbackOutput();

  const requestId = createRequestId(event.session_id, event.turn_id, event.prompt);
  const response = options.provider.invoke({
    schemaVersion: protocolVersion,
    kind: "profile-provider-request",
    requestId,
    operation: "get-task-context",
    input: {
      task: event.prompt,
      purpose: "coding-assistance",
      maxTokens: 2_048,
      requestedCapabilities,
    },
  });

  if (
    !isProfileProviderResponse(response) ||
    response.requestId !== requestId ||
    response.operation !== "get-task-context" ||
    response.outcome !== "success"
  ) {
    return createCodexFallbackOutput();
  }

  const packet = response.data as DeveloperContextPacket;
  if (!isFuture(packet.expiresAt, options.clock())) return createCodexFallbackOutput();
  const guidance = mapPacketToCodexGuidance(packet);
  const context = renderCodexGuidance(guidance);
  if (context === null) return createCodexFallbackOutput();

  try {
    await options.state.save(event.session_id, guidance);
  } catch {
    // The current validated projection remains safe; only later restoration is unavailable.
  }
  return withContext("UserPromptSubmit", context);
}

type SessionStartEvent = Readonly<{
  hook_event_name: "SessionStart";
  session_id: string;
  source: "startup" | "resume" | "clear" | "compact";
}>;

type UserPromptSubmitEvent = Readonly<{
  hook_event_name: "UserPromptSubmit";
  session_id: string;
  turn_id: string;
  prompt: string;
}>;

function parseHookEvent(input: unknown): SessionStartEvent | UserPromptSubmitEvent | null {
  if (!isRecord(input) || !isOpaqueIdentifier(input["session_id"])) return null;
  if (input["hook_event_name"] === "SessionStart" && isSessionSource(input["source"])) {
    return {
      hook_event_name: "SessionStart",
      session_id: input["session_id"],
      source: input["source"],
    };
  }
  if (
    input["hook_event_name"] === "UserPromptSubmit" &&
    isOpaqueIdentifier(input["turn_id"]) &&
    typeof input["prompt"] === "string" &&
    input["prompt"].length > 0
  ) {
    return {
      hook_event_name: "UserPromptSubmit",
      session_id: input["session_id"],
      turn_id: input["turn_id"],
      prompt: input["prompt"],
    };
  }
  return null;
}

function isCodexCachedGuidance(value: unknown): value is CodexCachedGuidance {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["cacheVersion", "expiresAt", "claims", "responsePolicy"])
  ) {
    return false;
  }
  if (value["cacheVersion"] !== 1 || !isCanonicalTimestamp(value["expiresAt"])) return false;
  if (!Array.isArray(value["claims"]) || value["claims"].length > 32) return false;
  if (!value["claims"].every(isCachedClaim)) return false;
  const capabilities = value["claims"].map((claim) => claim.capability);
  if (new Set(capabilities).size !== capabilities.length) return false;
  return isResponsePolicy(value["responsePolicy"]);
}

function isCachedClaim(value: unknown): value is CodexCachedGuidance["claims"][number] {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["capability", "state", "observedDepth"]) &&
    typeof value["capability"] === "string" &&
    capabilityPattern.test(value["capability"]) &&
    isClaimState(value["state"]) &&
    (value["observedDepth"] === null || isObservedDepth(value["observedDepth"]))
  );
}

function isResponsePolicy(value: unknown): value is ResponsePolicy {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "mode",
      "explainPurposeBeforeCommands",
      "includeExpectedResult",
      "includeRiskAndRollback",
      "analogyCapabilities",
      "questionBudget",
    ]) ||
    !["concise", "analogy", "teach-while-doing"].includes(String(value["mode"])) ||
    typeof value["explainPurposeBeforeCommands"] !== "boolean" ||
    typeof value["includeExpectedResult"] !== "boolean" ||
    typeof value["includeRiskAndRollback"] !== "boolean" ||
    (value["questionBudget"] !== 0 && value["questionBudget"] !== 1) ||
    !Array.isArray(value["analogyCapabilities"]) ||
    value["analogyCapabilities"].length > 32 ||
    !value["analogyCapabilities"].every(
      (capability) => typeof capability === "string" && capabilityPattern.test(capability),
    )
  ) {
    return false;
  }
  return new Set(value["analogyCapabilities"]).size === value["analogyCapabilities"].length;
}

function withContext(
  hookEventName: "SessionStart" | "UserPromptSubmit",
  additionalContext: string,
): CodexHookOutput {
  return immutableCopy({
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: { hookEventName, additionalContext },
  });
}

function createRequestId(sessionId: string, turnId: string, task: string): string {
  const digest = createHash("sha256")
    .update(sessionId)
    .update("\0")
    .update(turnId)
    .update("\0")
    .update(task)
    .digest("hex")
    .slice(0, 32);
  return `request_codex_${digest}`;
}

function responseModeInstruction(mode: ResponsePolicy["mode"]): string {
  if (mode === "concise")
    return "Use direct, concise technical language and emphasize decisions and trade-offs.";
  if (mode === "analogy") {
    return "Start from the listed analogy capabilities, then state where the target idiom differs.";
  }
  return "Explain only what is needed for safe progress while carrying out the task.";
}

function yesNo(value: boolean): "yes" | "no" {
  return value ? "yes" : "no";
}

function isFuture(timestamp: string, now: Date): boolean {
  return Number.isFinite(now.getTime()) && Date.parse(timestamp) > now.getTime();
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z(?![\s\S])/u.test(value)
  ) {
    return false;
  }
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value.replace("Z", ".000Z")
  );
}

function isSessionSource(value: unknown): value is SessionStartEvent["source"] {
  return value === "startup" || value === "resume" || value === "clear" || value === "compact";
}

function isOpaqueIdentifier(value: unknown): value is string {
  return typeof value === "string" && opaqueIdentifierPattern.test(value);
}

function isClaimState(value: unknown): value is ClaimState {
  return (
    value === "demonstrated" ||
    value === "adjacent" ||
    value === "self-declared" ||
    value === "insufficient-evidence" ||
    value === "disputed"
  );
}

function isObservedDepth(value: unknown): value is ObservedDepth {
  return value === "exposure" || value === "practical-use" || value === "demonstrated-depth";
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function immutableCopy<Value>(value: Value): Value {
  return deepFreeze(structuredClone(value));
}

function deepFreeze<Value>(value: Value): Value {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
