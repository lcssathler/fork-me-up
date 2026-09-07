import { Buffer } from "node:buffer";
import { TextDecoder } from "node:util";
import { setTimeout, clearTimeout } from "node:timers";
import {
  ownerWorkflowMaximumInputBytes,
  ownerWorkflowMaximumOutputBytes,
  resolveLocalProfileStoreConfig,
  runOwnerProfileOperation,
} from "@fork-me-up/community-provider";

const invalid = { ok: false, error: { category: "invalid-input", retryable: false } };
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
  const configuration = await resolveLocalProfileStoreConfig(JSON.stringify(value.store));
  const result = configuration.ok
    ? await runOwnerProfileOperation(configuration.value, JSON.stringify(value.request))
    : configuration;
  const output = JSON.stringify(result);
  if (Buffer.byteLength(output, "utf8") > ownerWorkflowMaximumOutputBytes)
    throw new Error("invalid");
  process.stdout.write(`${output}\n`);
  process.exitCode = result.ok ? 0 : 1;
} catch {
  process.stdout.write(`${JSON.stringify(invalid)}\n`);
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
      if (length > ownerWorkflowMaximumInputBytes) {
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
