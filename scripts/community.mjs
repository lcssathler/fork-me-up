import { Buffer } from "node:buffer";
import { once } from "node:events";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";

const maximumConfigBytes = 131072;
const maximumLineBytes = 4194304;
const unavailable = { ok: false, error: { category: "community-unavailable", retryable: false } };
let mcp = false;
try {
  const args = process.argv.slice(2);
  if (
    args.length !== 4 ||
    args[0] !== "--config" ||
    typeof args[1] !== "string" ||
    args[2] !== "--mode" ||
    !["owner", "mcp"].includes(args[3] ?? "")
  )
    throw new Error("invalid-input");
  mcp = args[3] === "mcp";
  const configuration = await readConfiguration(args[1]);
  const { createLocalCommunityRuntime } = await import("@fork-me-up/community-provider");
  const { clearFileCodexSessionState, inspectFileCodexSessionState } =
    await import("@fork-me-up/codex-adapter");
  const created = await createLocalCommunityRuntime(configuration, {
    clearAdapterCache: () => clearFileCodexSessionState({ scope: "all-adapter-cache" }),
    inspectAdapterCache: (at) => inspectFileCodexSessionState({ at }),
    installation: {
      modules: "available",
      runtime: process.versions.node === "24.20.0" ? "supported" : "unsupported",
    },
  });
  if (!created.ok) throw new Error("invalid-config");
  if (mcp) {
    const { serveMcpStdio } = await import("../apps/mcp-local/src/mcp-stdio-server.ts");
    await serveMcpStdio(created.value.provider, process.stdin, process.stdout);
  } else {
    let pending = Buffer.alloc(0);
    let count = 0;
    for await (const chunk of process.stdin) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      let start = 0;
      for (let index = 0; index < bytes.length; index += 1) {
        if (bytes[index] !== 10) continue;
        const part = bytes.subarray(start, index);
        if (pending.byteLength + part.byteLength > maximumLineBytes || ++count > 256)
          throw new Error("limit-exceeded");
        const line = Buffer.concat([pending, part]);
        pending = Buffer.alloc(0);
        start = index + 1;
        await execute(line, created.value);
      }
      const remainder = bytes.subarray(start);
      if (pending.byteLength + remainder.byteLength > maximumLineBytes)
        throw new Error("limit-exceeded");
      pending = Buffer.concat([pending, remainder]);
    }
    if (pending.byteLength > 0) {
      if (++count > 256) throw new Error("limit-exceeded");
      await execute(pending, created.value);
    }
  }
} catch {
  if (!mcp) process.stdout.write(`${JSON.stringify(unavailable)}\n`);
  process.exitCode = 1;
}

/** @param {Buffer} line @param {import('@fork-me-up/community-provider').LocalCommunityRuntime} runtime */
async function execute(line, runtime) {
  const source = new TextDecoder("utf-8", { fatal: true }).decode(line);
  const result = await runtime.run(source);
  const output = JSON.stringify(result);
  if (Buffer.byteLength(output, "utf8") > 262144) throw new Error("limit-exceeded");
  if (!process.stdout.write(`${output}\n`)) {
    await once(process.stdout, "drain");
  }
  if (typeof result === "object" && result !== null && "ok" in result && result.ok === false)
    process.exitCode = 1;
}

/** @param {string} selected */
async function readConfiguration(selected) {
  const requested = path.resolve(selected);
  const before = await lstat(requested, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || before.size > BigInt(maximumConfigBytes))
    throw new Error("invalid-config");
  const canonical = await realpath(requested);
  const handle = await open(
    canonical,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || !sameStamp(before, opened)) throw new Error("invalid-config");
    const buffer = Buffer.alloc(maximumConfigBytes + 1);
    let bytes = 0;
    while (bytes < buffer.length) {
      const result = await handle.read(buffer, bytes, buffer.length - bytes, bytes);
      if (result.bytesRead === 0) break;
      bytes += result.bytesRead;
    }
    const after = await handle.stat({ bigint: true });
    if (
      bytes > maximumConfigBytes ||
      BigInt(bytes) !== after.size ||
      !sameStamp(opened, after) ||
      !sameStamp(opened, await lstat(requested, { bigint: true })) ||
      (await realpath(requested)) !== canonical
    )
      throw new Error("invalid-config");
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytes));
  } finally {
    await handle.close();
  }
}
/** @param {import('node:fs').BigIntStats} a @param {import('node:fs').BigIntStats} b */
function sameStamp(a, b) {
  return (
    a.dev === b.dev &&
    a.ino === b.ino &&
    a.mode === b.mode &&
    a.size === b.size &&
    a.mtimeNs === b.mtimeNs &&
    a.ctimeNs === b.ctimeNs
  );
}
