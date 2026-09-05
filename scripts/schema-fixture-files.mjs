import { Buffer } from "node:buffer";
import { lstat, open } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

export const maximumFixtureFileBytes = 65_536;

/** @param {URL} url */
export async function assertNoSymlinkAncestors(url) {
  let path = fileURLToPath(url);
  for (let depth = 0; depth < 64; depth++) {
    if ((await lstat(path)).isSymbolicLink()) throw new Error("Schema fixture symlink rejected.");
    const parent = dirname(path);
    if (parent === path) return;
    path = parent;
  }
  throw new Error("Schema fixture path depth exceeded.");
}

/**
 * Fixed development files only; callers never supply paths from contract content.
 * @param {URL} url
 * @returns {Promise<unknown>}
 */
export async function readBoundedJson(url) {
  await assertNoSymlinkAncestors(url);
  const metadata = await lstat(url);
  if (!metadata.isFile() || metadata.size > maximumFixtureFileBytes) {
    throw new Error("Invalid schema fixture file.");
  }
  const handle = await open(url, "r");
  try {
    const openedMetadata = await handle.stat();
    if (
      !openedMetadata.isFile() ||
      openedMetadata.size > maximumFixtureFileBytes ||
      openedMetadata.dev !== metadata.dev ||
      openedMetadata.ino !== metadata.ino
    ) {
      throw new Error("Invalid schema fixture file.");
    }
    const buffer = Buffer.alloc(maximumFixtureFileBytes + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > maximumFixtureFileBytes || bytesRead !== openedMetadata.size) {
      throw new Error("Schema fixture file limit or consistency check failed.");
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytesRead));
    return JSON.parse(text);
  } finally {
    await handle.close();
  }
}
