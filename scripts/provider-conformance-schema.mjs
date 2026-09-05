import { Buffer } from "node:buffer";
import { isDeepStrictEqual } from "node:util";
import { validateDcp } from "./dcp-schema.mjs";
import { compileAuthoringSchema } from "./schema-validator.mjs";

const dcpSchemaUrl = new URL("../schemas/dcp/0.1.0.schema.json", import.meta.url);
const providerSchemaUrl = new URL("../schemas/profile-provider/0.1.0.schema.json", import.meta.url);
const validateCapabilitiesShape = await compileAuthoringSchema(
  providerSchemaUrl,
  "Profile Provider capabilities",
  [dcpSchemaUrl],
);
const validateConformanceShape = await compileAuthoringSchema(
  new URL("../schemas/conformance/profile-provider/0.1.0.schema.json", import.meta.url),
  "Profile Provider conformance transcript",
  [dcpSchemaUrl, providerSchemaUrl],
);

/** @param {unknown} value */
export function validateProfileProviderCapabilities(value) {
  if (!validateCapabilitiesShape(value)) return false;
  const provider = /** @type {ProviderCapabilities} */ (value);
  return (
    provider.protocolVersions.includes("0.1.0") &&
    (!provider.operations.includes("get-task-context") ||
      provider.disclosureClasses.includes("task-context"))
  );
}

/** @param {unknown} value */
export function validateProfileProviderConformance(value) {
  if (!validateConformanceShape(value)) return false;
  const transcript = /** @type {{provider: ProviderCapabilities, exchanges: Exchange[]}} */ (value);
  if (!validateProfileProviderCapabilities(transcript.provider)) return false;

  for (const { request, response } of transcript.exchanges) {
    if (request.requestId !== response.requestId || request.operation !== response.operation) {
      return false;
    }
    const advertised = transcript.provider.operations.includes(request.operation);
    if (!advertised) {
      if (response.outcome !== "error" || response.error?.category !== "unsupported-operation") {
        return false;
      }
      continue;
    }
    if (response.outcome === "error") {
      if (response.error?.category === "unsupported-operation") return false;
      if (
        response.error?.category === "unsupported-version" &&
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
      const metadata = /** @type {{freshnessStatus: string}} */ (response.data);
      if (
        (metadata.freshnessStatus === "partial" &&
          !transcript.provider.freshnessSupport.partialResults) ||
        (metadata.freshnessStatus === "stale" && !transcript.provider.freshnessSupport.staleResults)
      ) {
        return false;
      }
    }
    if (request.operation === "get-task-context") {
      const input = /** @type {TaskContextInput} */ (request.input);
      if (
        Buffer.byteLength(input.task, "utf8") > transcript.provider.limits.maxTaskBytes ||
        input.maxTokens > transcript.provider.limits.maxOutputTokens ||
        input.requestedCapabilities.length > transcript.provider.limits.maxRequestedCapabilities
      ) {
        return false;
      }
      const packet =
        /** @type {Record<string, unknown> & {schemaVersion: string, purpose: string, task: {summary: string}, disclosure: {class: string}}} */ (
          response.data
        );
      if (
        !validateDcp(packet) ||
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
      const input = /** @type {{capability?: string, claimRef?: string}} */ (request.input);
      const result =
        /** @type {{capability: string, claimRef: string | null, evidence: {sourceClass: string}[]}} */ (
          response.data
        );
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

/** @typedef {{protocolVersions: string[], operations: string[], sourceClasses: string[], disclosureClasses: string[], limits: {maxTaskBytes: number, maxOutputBytes: number, maxOutputTokens: number, maxRequestedCapabilities: number}, freshnessSupport: {partialResults: boolean, staleResults: boolean}}} ProviderCapabilities */
/** @typedef {{task: string, purpose: string, maxTokens: number, requestedCapabilities: string[]}} TaskContextInput */
/** @typedef {{request: {requestId: string, operation: string, input: unknown}, response: {requestId: string, operation: string, outcome: string, data: unknown, error: null | {category: string, supportedVersions: string[]}}}} Exchange */
