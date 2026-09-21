import { readConfiguration } from "./read-owner-configuration.mjs";

try {
  const args = process.argv.slice(2);
  if (
    (args.length !== 6 && args.length !== 7) ||
    args[0] !== "--config" ||
    typeof args[1] !== "string" ||
    args[2] !== "--operation" ||
    !["select", "export", "delete"].includes(args[3] ?? "") ||
    args[4] !== "--languages" ||
    typeof args[5] !== "string"
  )
    throw new Error("invalid-input");
  const operation = /** @type {'select'|'export'|'delete'} */ (args[3]);
  if (
    (operation === "delete" && args[6] !== "--confirm-delete-catalog") ||
    (operation === "export" && args.length !== 6) ||
    (operation === "select" && args.length === 7 && args[6] !== "--refresh")
  )
    throw new Error("invalid-input");
  const selected = args[1];
  const configuration = await readConfiguration(selected);
  const { runSourceCatalog } = await import("@fork-me-up/community-provider");
  const result = await runSourceCatalog(
    configuration,
    {
      operation,
      languages: args[5] === "" ? [] : args[5].split(","),
      refresh: args[6] === "--refresh",
    },
    {
      readAuthority: async () => {
        try {
          return await readConfiguration(selected);
        } catch {
          return null;
        }
      },
    },
  );
  const output = result.ok
    ? {
        ok: true,
        status: result.status,
        profile: result.profile,
        profileCoverage: result.profileCoverage,
        recovered: result.recovered,
        counts: result.counts,
        ...(operation === "export" ? { inventory: result.inventory } : {}),
      }
    : result;
  process.stdout.write(`${JSON.stringify(output)}\n`);
  if (!result.ok) process.exitCode = 1;
} catch {
  process.stdout.write('{"ok":false,"error":{"category":"catalog-unavailable"},"saved":false}\n');
  process.exitCode = 1;
}
