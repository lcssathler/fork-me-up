import { Buffer } from "node:buffer";
import { TextDecoder } from "node:util";
import { setTimeout, clearTimeout } from "node:timers";
const ownerPortabilityMaximumInputBytes = 4_194_304;
const ownerWorkflowMaximumOutputBytes = 262_144;

const invalid = { ok: false, error: { category: "invalid-input", retryable: false } };
let loadingInstallation = false;
try {
  if (process.argv.length !== 2) throw new Error("invalid");
  const bytes = await readInput();
  const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== 2 ||
    !Object.hasOwn(value, "store") ||
    !Object.hasOwn(value, "request")
  )
    throw new Error("invalid");
  loadingInstallation = true;
  const {
    resolveLocalProfileStoreConfig,
    runOwnerProfileOperation,
    runOwnerPortabilityOperation,
    runOwnerDiagnostics,
  } = await import("@fork-me-up/community-provider");
  const { clearFileCodexSessionState, inspectFileCodexSessionState } =
    await import("@fork-me-up/codex-adapter");
  loadingInstallation = false;
  const diagnostics = ["doctor", "get-capability-evidence"].includes(value.request?.operation);
  const configuration =
    value.store === null && value.request?.operation === "doctor"
      ? { ok: true, value: null }
      : await resolveLocalProfileStoreConfig(JSON.stringify(value.store));
  const result = configuration.ok
    ? diagnostics
      ? await runOwnerDiagnostics(configuration.value, JSON.stringify(value.request), {
          installation: {
            modules: "available",
            runtime: process.versions.node === "24.20.0" ? "supported" : "unsupported",
          },
          inspectAdapterCache: (at) => inspectFileCodexSessionState({ at }),
        })
      : configuration.value === null
        ? invalid
        : ["import", "export", "delete"].includes(value.request?.operation)
          ? await runOwnerPortabilityOperation(configuration.value, JSON.stringify(value.request), {
              clearAdapterCache: () => clearFileCodexSessionState({ scope: "all-adapter-cache" }),
            })
          : await runOwnerProfileOperation(configuration.value, JSON.stringify(value.request))
    : configuration;
  const output = JSON.stringify(result);
  if (Buffer.byteLength(output, "utf8") > ownerWorkflowMaximumOutputBytes)
    throw new Error("invalid");
  process.stdout.write(`${output}\n`);
  process.exitCode = result.ok ? 0 : 1;
} catch {
  const result = loadingInstallation
    ? { ok: false, error: { category: "installation-unavailable", retryable: false } }
    : invalid;
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = 1;
}

/** @returns {Promise<Buffer>} */
function readInput() {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    let length = 0;
    const timer = setTimeout(() => {
      process.stdin.destroy();
      reject(new Error("invalid"));
    }, 30_000);
    process.stdin.on("data", (chunk) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      length += bytes.length;
      if (length > ownerPortabilityMaximumInputBytes) {
        clearTimeout(timer);
        process.stdin.destroy();
        reject(new Error("invalid"));
        return;
      }
      chunks.push(bytes);
    });
    process.stdin.once("end", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
    process.stdin.once("error", () => {
      clearTimeout(timer);
      reject(new Error("invalid"));
    });
  });
}
