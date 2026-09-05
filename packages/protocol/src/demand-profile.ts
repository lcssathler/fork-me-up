import { Ajv2020 } from "ajv/dist/2020.js";
import demandProfileSchema from "../../../schemas/demand-profile/0.1.0.schema.json" with { type: "json" };
import type { DemandProfile } from "./types.ts";

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
const validateShape = ajv.compile(demandProfileSchema);

export function isDemandProfile(value: unknown): value is DemandProfile {
  if (!validateShape(value)) return false;

  const demand = value as unknown as DemandProfile;
  const capabilities = demand.capabilities.map((item) => item.capability);
  return (
    new Set(capabilities).size === capabilities.length &&
    (demand.project.metadataStatus !== "unavailable" ||
      demand.capabilities.every((item) => item.basis === "task-input"))
  );
}

function isCanonicalTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z(?![\s\S])/u.test(value)) return false;
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value.replace("Z", ".000Z")
  );
}
