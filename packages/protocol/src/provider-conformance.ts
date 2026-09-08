import { Buffer } from "node:buffer";
import { isDeepStrictEqual } from "node:util";
import { Ajv2020 } from "ajv/dist/2020.js";
import conformanceSchema from "../../../schemas/conformance/profile-provider/0.1.0.schema.json" with { type: "json" };
import dcpSchema from "../../../schemas/dcp/0.1.0.schema.json" with { type: "json" };
import providerSchema from "../../../schemas/profile-provider/0.1.0.schema.json" with { type: "json" };
import { isDeveloperContextPacket } from "./developer-context-packet.ts";
import { isProfileProviderCapabilities } from "./profile-provider.ts";
import type {
  CapabilityEvidence,
  DeveloperContextPacket,
  ProfileMetadata,
  ProfileProviderConformanceTranscript,
  TaskContextInput,
} from "./types.ts";

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
ajv.addSchema(conformanceSchema);
const validateConformanceShape = ajv.compile({
  $ref: "urn:fork-me-up:conformance:profile-provider:0.1.0",
});

export function isProfileProviderConformanceTranscript(
  value: unknown,
): value is ProfileProviderConformanceTranscript {
  if (!validateConformanceShape(value)) return false;
  const transcript = value as ProfileProviderConformanceTranscript;
  if (!isProfileProviderCapabilities(transcript.provider)) return false;

  for (const { request, response } of transcript.exchanges) {
    if (request.requestId !== response.requestId || request.operation !== response.operation) {
      return false;
    }
    const advertised = transcript.provider.operations.includes(request.operation);
    if (!advertised) {
      if (response.outcome !== "error" || response.error.category !== "unsupported-operation") {
        return false;
      }
      continue;
    }
    if (response.outcome === "error") {
      if (response.error.category === "unsupported-operation") return false;
      if (
        response.error.category === "unsupported-version" &&
        response.error.supportedVersions.length === 0
      ) {
        return false;
      }
      continue;
    }
    if (request.operation === "get-provider-capabilities") {
      if (!isDeepStrictEqual(response.data, transcript.provider)) return false;
    }
    if (request.operation === "get-profile-metadata") {
      const metadata = response.data as ProfileMetadata;
      if (
        (metadata.freshnessStatus === "partial" &&
          !transcript.provider.freshnessSupport.partialResults) ||
        (metadata.freshnessStatus === "stale" && !transcript.provider.freshnessSupport.staleResults)
      ) {
        return false;
      }
    }
    if (request.operation === "get-task-context") {
      const input = request.input as TaskContextInput;
      const packet = response.data as DeveloperContextPacket;
      if (
        Buffer.byteLength(input.task, "utf8") > transcript.provider.limits.maxTaskBytes ||
        input.maxTokens > transcript.provider.limits.maxOutputTokens ||
        input.requestedCapabilities.length > transcript.provider.limits.maxRequestedCapabilities ||
        !isDeveloperContextPacket(packet) ||
        !transcript.provider.protocolVersions.includes(packet.schemaVersion) ||
        packet.purpose !== input.purpose ||
        packet.task.summary !== input.task ||
        !transcript.provider.disclosureClasses.includes(packet.disclosure.class) ||
        Buffer.byteLength(JSON.stringify(packet), "utf8") >
          transcript.provider.limits.maxOutputBytes
      ) {
        return false;
      }
    }
    if (request.operation === "get-capability-evidence") {
      const input = request.input;
      const result = response.data as CapabilityEvidence;
      if (
        (input.capability !== undefined && result.capability !== input.capability) ||
        (input.claimRef !== undefined && result.claimRef !== input.claimRef) ||
        !result.evidence.every((item) =>
          transcript.provider.sourceClasses.includes(item.sourceClass),
        )
      ) {
        return false;
      }
    }
  }
  return true;
}

function isCanonicalTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z(?![\s\S])/u.test(value)) return false;
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value.replace("Z", ".000Z")
  );
}
