try {
  if (process.argv.length !== 2) throw new Error("Arguments are not supported.");
  const [
    { checkDcpFixtures },
    { checkClaimFixtures, checkEvidenceFixtures },
    { checkCommunityProfileStoreFixtures, checkPortableProfileExportFixtures },
    { checkDemandProfileFixtures },
  ] = await Promise.all([
    import("./dcp-fixtures.mjs"),
    import("./evidence-claim-fixtures.mjs"),
    import("./profile-export-fixtures.mjs"),
    import("./demand-profile-fixtures.mjs"),
  ]);
  const [dcp, evidence, claim, store, profileExport, demand] = await Promise.all([
    checkDcpFixtures(),
    checkEvidenceFixtures(),
    checkClaimFixtures(),
    checkCommunityProfileStoreFixtures(),
    checkPortableProfileExportFixtures(),
    checkDemandProfileFixtures(),
  ]);
  console.log(
    `Schema fixtures passed (DCP ${dcp.valid}/${dcp.invalid}, Evidence ${evidence.valid}/${evidence.invalid}, Claim ${claim.valid}/${claim.invalid}, Store ${store.valid}/${store.invalid}, Export ${profileExport.valid}/${profileExport.invalid}, Demand ${demand.valid}/${demand.invalid} valid/invalid).`,
  );
} catch {
  console.error("Schema fixture check failed.");
  process.exitCode = 1;
}
