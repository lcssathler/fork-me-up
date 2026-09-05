#!/usr/bin/env node
import { createLocalFixtureProfileProvider } from "@fork-me-up/community-provider";
import adjacentProfile from "../../../fixtures/developer-profile/0.1.0/adjacent.json" with { type: "json" };
import demonstratedProfile from "../../../fixtures/developer-profile/0.1.0/demonstrated.json" with { type: "json" };
import insufficientProfile from "../../../fixtures/developer-profile/0.1.0/insufficient-evidence.json" with { type: "json" };
import { createCodexFallbackOutput, handleCodexHook } from "./codex-hook-adapter.ts";
import { createFileCodexSessionState } from "./file-session-state.ts";

const maximumInputBytes = 65_536;
const fixtureProfiles: Readonly<Record<string, unknown | null>> = {
  adjacent: adjacentProfile,
  demonstrated: demonstratedProfile,
  "insufficient-evidence": insufficientProfile,
  unavailable: null,
};

let output = createCodexFallbackOutput();
try {
  const fixtureName = readFixtureArgument(process.argv.slice(2));
  if (fixtureName !== null) {
    const provider = createLocalFixtureProfileProvider({
      profile: fixtureProfiles[fixtureName] ?? null,
      clock: () => new Date(),
      createId: (kind) => `${kind}_codex_hook`,
    });
    output = await handleCodexHook(await readHookInput(), {
      provider,
      state: createFileCodexSessionState(),
      clock: () => new Date(),
    });
  }
} catch {
  output = createCodexFallbackOutput();
}

process.stdout.write(`${JSON.stringify(output)}\n`, "utf8");

async function readHookInput(): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > maximumInputBytes) throw new RangeError("Hook input exceeds its fixed bound.");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function readFixtureArgument(arguments_: readonly string[]): string | null {
  if (arguments_.length === 0) return "unavailable";
  if (arguments_.length !== 1) return null;
  const value = arguments_[0];
  if (value === undefined || !value.startsWith("--fixture=")) return null;
  const fixture = value.slice("--fixture=".length);
  return ["adjacent", "demonstrated", "insufficient-evidence", "unavailable"].includes(fixture)
    ? fixture
    : null;
}
