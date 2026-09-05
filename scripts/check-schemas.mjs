try {
  if (process.argv.length !== 2) throw new Error("Arguments are not supported.");
  const [
    { checkDcpFixtures },
    { checkClaimFixtures, checkEvidenceFixtures },
    { checkCommunityProfileStoreFixtures, checkPortableProfileExportFixtures },
  ] = await Promise.all([
    import("./dcp-fixtures.mjs"),
    import("./evidence-claim-fixtures.mjs"),
    import("./profile-export-fixtures.mjs"),
  ]);
  const [dcp, evidence, claim, store, profileExport] = await Promise.all([
    checkDcpFixtures(),
    checkEvidenceFixtures(),
    checkClaimFixtures(),
    checkCommunityProfileStoreFixtures(),
    checkPortableProfileExportFixtures(),
  ]);
  console.log(
    `Schema fixtures passed (DCP ${dcp.valid}/${dcp.invalid}, Evidence ${evidence.valid}/${evidence.invalid}, Claim ${claim.valid}/${claim.invalid}, Store ${store.valid}/${store.invalid}, Export ${profileExport.valid}/${profileExport.invalid} valid/invalid).`,
  );
} catch {
  console.error("Schema fixture check failed.");
  process.exitCode = 1;
}
