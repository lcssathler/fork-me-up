import { Ajv2020 } from "ajv/dist/2020.js";
import dcpSchema from "../../../schemas/dcp/0.1.0.schema.json" with { type: "json" };
import type { DeveloperContextPacket } from "./types.ts";

const ajv = new Ajv2020({
  strict: true,
  allErrors: false,
  verbose: false,
  logger: false,
  $data: false,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
});

ajv.addFormat("date-time", { type: "string", validate: isCanonicalTimestamp });
const validateShape = ajv.compile(dcpSchema);

export function isDeveloperContextPacket(value: unknown): value is DeveloperContextPacket {
  if (!validateShape(value)) return false;
  const packet = value as unknown as DeveloperContextPacket;
  return (
    packet.generatedAt < packet.expiresAt &&
    utf8ByteLength(JSON.stringify(packet)) <= packet.budget.maxBytes
  );
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isCanonicalTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z(?![\s\S])/u.test(value)) return false;
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value.replace("Z", ".000Z")
  );
}
