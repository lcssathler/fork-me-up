import { spawnSync } from "node:child_process";
import { baselineChecks } from "./baseline-checks.mjs";

const npmCli = process.env["npm_execpath"];

if (npmCli === undefined) {
  console.error("Run the aggregate check through npm so the pinned package manager is used.");
  process.exitCode = 1;
} else {
  for (const check of baselineChecks) {
    console.log(`Running ${check}...`);
    const result = spawnSync(process.execPath, [npmCli, "run", "--silent", check], {
      shell: false,
      stdio: "inherit",
    });

    if (result.error !== undefined || result.status !== 0) {
      console.error(`${check} failed.`);
      process.exitCode = result.status ?? 1;
      break;
    }
  }
}
