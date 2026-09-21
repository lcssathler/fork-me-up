import assert from "node:assert/strict";
import test from "node:test";
import { readSelectedGitHubSources } from "@fork-me-up/community-provider";
import {
  selectedFixture,
  selectedConfig,
  currentTime,
  base,
} from "../tests/helpers/selected-github-fixture.mjs";

test("FMU-E-020 selected private reads remain local, minimized and bounded by separate authority", async () => {
  const fixture = selectedFixture();
  const json = JSON.stringify(selectedConfig());
  const options = { port: fixture.port, clock: () => currentTime, readAuthority: async () => json };
  const discovery = await readSelectedGitHubSources(json, "discover", options);
  assert.equal(discovery.ok, true);
  assert.ok(fixture.calls.every((value) => value === "/user" || value === base));
  fixture.calls.length = 0;
  const collection = await readSelectedGitHubSources(json, "collect", options);
  assert.equal(collection.ok, true);
  if (!collection.ok) return;
  assert.ok(collection.counts.requests <= selectedConfig().limits.requests);
  assert.ok(collection.counts.files > 0);
  assert.ok(collection.counts.commits > 0);
  assert.doesNotMatch(
    JSON.stringify(collection),
    /CANARY|synthetic@example|example-owner|src\/|demonstrated|responsePolicy/u,
  );
  const revoked = await readSelectedGitHubSources(json, "collect", {
    ...options,
    readAuthority: async () => null,
  });
  assert.equal(revoked.ok, false);
  assert.equal("observations" in revoked, false);
});
