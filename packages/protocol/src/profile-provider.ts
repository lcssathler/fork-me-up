import { Ajv2020 } from "ajv/dist/2020.js";
import dcpSchema from "../../../schemas/dcp/0.1.0.schema.json" with { type: "json" };
import providerSchema from "../../../schemas/profile-provider/0.1.0.schema.json" with { type: "json" };
import type {
  DeveloperContextPacket,
  ProfileProviderCapabilities,
  ProfileProviderRequest,
  ProfileProviderResponse,
} from "./types.ts";
import { isDeveloperContextPacket } from "./developer-context-packet.ts";

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
ajv.addSchema(dcpSchema);
ajv.addSchema(providerSchema);
const validateCapabilitiesShape = ajv.compile({
  $ref: "urn:fork-me-up:profile-provider:0.1.0#/$defs/providerCapabilities",
});
const validateRequestShape = ajv.compile({
  $ref: "urn:fork-me-up:profile-provider:0.1.0#/$defs/request",
});
const validateResponseShape = ajv.compile({
  $ref: "urn:fork-me-up:profile-provider:0.1.0#/$defs/response",
});

export function isProfileProviderCapabilities(
  value: unknown,
): value is ProfileProviderCapabilities {
  if (!validateCapabilitiesShape(value)) return false;
  const capabilities = value as ProfileProviderCapabilities;
  return (
    capabilities.protocolVersions.includes("0.1.0") &&
    (!capabilities.operations.includes("get-task-context") ||
      capabilities.disclosureClasses.includes("task-context"))
  );
}

export function isProfileProviderRequest(value: unknown): value is ProfileProviderRequest {
  return validateRequestShape(value);
}

export function isProfileProviderResponse(value: unknown): value is ProfileProviderResponse {
  if (!validateResponseShape(value)) return false;
  const response = value as ProfileProviderResponse;
  if (
    response.outcome === "error" &&
    response.error.category === "unsupported-version" &&
    response.error.supportedVersions.length === 0
  ) {
    return false;
  }
  return (
    response.outcome !== "success" ||
    response.operation !== "get-task-context" ||
    isDeveloperContextPacket(response.data as DeveloperContextPacket)
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
