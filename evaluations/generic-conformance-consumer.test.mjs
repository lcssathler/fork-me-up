import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { mapPacketToCodexGuidance } from "../adapters/codex/src/index.ts";
import { consumeDeveloperContextPacket } from "../consumers/generic/src/index.mjs";

const fixture = new URL("../fixtures/dcp/0.1.0/valid/claim-states.json", import.meta.url);
const now = new Date("2026-09-04T12:00:00Z");

test("FMU-E-016: Codex and the generic consumer preserve the same DCP semantics", async () => {
  const packet = JSON.parse(await readFile(fixture, "utf8"));
  const codex = mapPacketToCodexGuidance(packet);
  const generic = consumeDeveloperContextPacket(packet, {
    clock: () => now,
    consumerId: "consumer_synthetic",
  });

  assert.equal(generic.outcome, "context");
  assert.deepEqual(generic.context.claims, codex.claims);
  assert.deepEqual(generic.context.responsePolicy, codex.responsePolicy);
  assert.equal(generic.context.expiresAt, codex.expiresAt);
  assert.equal(generic.context.authority, "none");
  assert.deepEqual(
    new Set(generic.context.claims.map((claim) => claim.state)),
    new Set(["demonstrated", "adjacent", "self-declared", "insufficient-evidence", "disputed"]),
  );
});
