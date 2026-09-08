#!/usr/bin/env node

import { Buffer } from "node:buffer";
import { TextDecoder } from "node:util";
import { consumeDeveloperContextPacket } from "./index.mjs";

const maximumInputBytes = 65_536;
const opaqueIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;

let result;
try {
  const consumerId = parseConsumerId(process.argv.slice(2));
  const text = await readBoundedStandardInput();
  result = consumeDeveloperContextPacket(text === null ? null : JSON.parse(text), { consumerId });
} catch {
  result = consumeDeveloperContextPacket(null);
}

process.stdout.write(`${JSON.stringify(result)}\n`);

/** @param {string[]} arguments_ */
function parseConsumerId(arguments_) {
  if (arguments_.length === 0) return null;
  if (
    arguments_.length === 2 &&
    arguments_[0] === "--consumer-id" &&
    opaqueIdentifierPattern.test(arguments_[1] ?? "")
  ) {
    return /** @type {string} */ (arguments_[1]);
  }
  throw new Error("invalid-arguments");
}

async function readBoundedStandardInput() {
  /** @type {Buffer[]} */
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8");
    totalBytes += bytes.byteLength;
    if (totalBytes > maximumInputBytes) return null;
    chunks.push(bytes);
  }
  if (totalBytes === 0) return null;
  return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, totalBytes));
}
