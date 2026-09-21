import { readConfiguration } from "./read-owner-configuration.mjs";

try {
  const args = process.argv.slice(2);
  if (
    args.length !== 4 ||
    args[0] !== "--config" ||
    typeof args[1] !== "string" ||
    args[2] !== "--operation" ||
    (args[3] !== "discover" && args[3] !== "collect")
  )
    throw new Error("invalid-input");
  const selected = args[1];
  const configuration = await readConfiguration(selected);
  const { readSelectedGitHubSources } = await import("@fork-me-up/community-provider");
  const result = await readSelectedGitHubSources(configuration, args[3], {
    readAuthority: async () => {
      try {
        return await readConfiguration(selected);
      } catch {
        return null;
      }
    },
  });
  // Never serialize the internal source observations through this model-visible receipt.
  process.stdout.write(
    `${JSON.stringify(result.ok ? { ok: true, status: "read", coverage: args[3] === "discover" ? "metadata-only" : "bounded-sample", counts: result.counts } : result)}\n`,
  );
  if (!result.ok) process.exitCode = 1;
} catch {
  process.stdout.write(
    `${JSON.stringify({ ok: false, error: { category: "source-unavailable" } })}\n`,
  );
  process.exitCode = 1;
}
