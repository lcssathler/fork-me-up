import { Buffer } from "node:buffer";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";
const maximumConfigBytes = 131072;

/** @param {string} selected */
export async function readConfiguration(selected) {
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
