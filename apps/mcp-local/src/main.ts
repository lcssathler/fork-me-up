#!/usr/bin/env node
import { createLocalFixtureProfileProvider } from "@fork-me-up/community-provider";
import adjacentProfile from "../../../fixtures/developer-profile/0.1.0/adjacent.json" with { type: "json" };
import demonstratedProfile from "../../../fixtures/developer-profile/0.1.0/demonstrated.json" with { type: "json" };
import insufficientProfile from "../../../fixtures/developer-profile/0.1.0/insufficient-evidence.json" with { type: "json" };
import { serveMcpStdio } from "./mcp-stdio-server.ts";

const fixtureName = readFixtureArgument(process.argv.slice(2));
const fixtureProfiles: Readonly<Record<string, unknown | null>> = {
  adjacent: adjacentProfile,
  demonstrated: demonstratedProfile,
  "insufficient-evidence": insufficientProfile,
  unavailable: null,
};

if (fixtureName === null) {
  console.error("Invalid fixture selection.");
  process.exitCode = 2;
} else {
  let identifierSequence = 0;
  const provider = createLocalFixtureProfileProvider({
    profile: fixtureProfiles[fixtureName] ?? null,
    clock: () => new Date(),
    createId: (kind) => {
      identifierSequence += 1;
      return `${kind}_local_${String(identifierSequence)}`;
    },
  });
  try {
    await serveMcpStdio(provider, process.stdin, process.stdout);
  } catch {
    console.error("Fork Me Up MCP server failed.");
    process.exitCode = 1;
  }
}

function readFixtureArgument(arguments_: readonly string[]): string | null {
  if (arguments_.length === 0) return "demonstrated";
  if (arguments_.length !== 1) return null;
  const value = arguments_[0];
  if (value === undefined || !value.startsWith("--fixture=")) return null;
  const fixture = value.slice("--fixture=".length);
  return ["adjacent", "demonstrated", "insufficient-evidence", "unavailable"].includes(fixture)
    ? fixture
    : null;
}
