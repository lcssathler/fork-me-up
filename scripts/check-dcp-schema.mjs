try {
  if (process.argv.length !== 2) throw new Error("Arguments are not supported.");
  // Catch loading/compilation failures too: diagnostics must never expose input or paths.
  const { checkDcpFixtures } = await import("./dcp-fixtures.mjs");
  const counts = await checkDcpFixtures();
  console.log(`DCP schema fixtures passed (${counts.valid} valid, ${counts.invalid} invalid).`);
} catch {
  console.error("DCP schema fixture check failed.");
  process.exitCode = 1;
}
