try {
  if (process.argv.length !== 2) throw new Error("Arguments are not supported.");
  const [{ checkDcpFixtures }, { checkClaimFixtures, checkEvidenceFixtures }] = await Promise.all([
    import("./dcp-fixtures.mjs"),
    import("./evidence-claim-fixtures.mjs"),
  ]);
  const [dcp, evidence, claim] = await Promise.all([
    checkDcpFixtures(),
    checkEvidenceFixtures(),
    checkClaimFixtures(),
  ]);
  console.log(
    `Schema fixtures passed (DCP ${dcp.valid}/${dcp.invalid}, Evidence ${evidence.valid}/${evidence.invalid}, Claim ${claim.valid}/${claim.invalid} valid/invalid).`,
  );
} catch {
  console.error("Schema fixture check failed.");
  process.exitCode = 1;
}
