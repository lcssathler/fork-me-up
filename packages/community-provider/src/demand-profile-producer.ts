import { createHash } from "node:crypto";
import { isDemandProfile, type DemandCapability, type DemandProfile } from "@fork-me-up/protocol";
import {
  isIssuedFilesystemMetadataSnapshot,
  type FilesystemMetadataSnapshot,
} from "./filesystem-metadata-collector.ts";

export const demandProfileProducerVersion = "0.1.0" as const;
export const demandProfileProducerHardLimits = Object.freeze({
  requestBytes: 32_768,
  outputBytes: 32_768,
  capabilities: 32,
  sourcePaths: 128,
  alternatives: 4,
});

export interface DemandTaskCapability {
  readonly capability: string;
  readonly relevance: DemandCapability["relevance"];
}

export interface DemandTaskInterpretation {
  readonly optionId: string;
  readonly operation: "read-only" | "source-write" | "destructive";
  readonly capabilities: readonly DemandTaskCapability[];
}

export interface DemandProfileProducerRequest {
  readonly producerVersion: typeof demandProfileProducerVersion;
  readonly demandId: string;
  readonly generatedAt: string;
  readonly project: {
    readonly projectRef: string;
    readonly repositoryId: string;
    readonly sourcePaths: readonly string[] | null;
  };
  readonly task: DemandProfile["task"] & {
    readonly capabilities: readonly DemandTaskCapability[];
    readonly alternatives: readonly DemandTaskInterpretation[];
  };
}

export interface DemandClarification {
  readonly kind: "demand-clarification";
  readonly question: "Which capability scope and operation should guide this task?";
  readonly options: readonly DemandTaskInterpretation[];
}

export type DemandProfileProducerErrorCategory =
  "invalid-input" | "not-collected" | "source-mismatch" | "limit-exceeded" | "invalid-continuation";

export type ProduceDemandProfileResult =
  | { readonly ok: true; readonly status: "ready"; readonly value: DemandProfile }
  | {
      readonly ok: true;
      readonly status: "clarification-required";
      readonly clarification: DemandClarification;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly category: DemandProfileProducerErrorCategory;
        readonly retryable: false;
      };
    };

const identifier = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}(?![\s\S])/u;
const pending = new WeakMap<DemandClarification, ReadonlyMap<string, DemandProfile>>();
const summary = "Task-scoped capability context from explicit input and selected project metadata.";

class DemandFault extends Error {
  readonly category: DemandProfileProducerErrorCategory;
  constructor(category: DemandProfileProducerErrorCategory) {
    super(category);
    this.category = category;
  }
}

export function produceDemandProfile(
  requestJson: string,
  source: FilesystemMetadataSnapshot | null,
): ProduceDemandProfileResult {
  try {
    const request = parseRequest(requestJson);
    const metadata = selectMetadata(request, source);
    const base = makeDemand(request, metadata, request.task.capabilities);
    const options = request.task.alternatives;
    if (options.length === 0) return ready(base);

    const candidates = options.map((option) => ({
      option,
      demand: makeDemand(
        request,
        metadata,
        mergeTaskCapabilities(request.task.capabilities, option.capabilities),
      ),
    }));
    const signatures = new Set(
      candidates.map(({ option, demand }) =>
        JSON.stringify([
          option.operation,
          demand.capabilities.map(({ capability, relevance }) => ({ capability, relevance })),
        ]),
      ),
    );
    if (signatures.size === 1) {
      // Equivalent behavior needs no answer. Retain only task input shared by every interpretation.
      const tasks = options.map((option) =>
        mergeTaskCapabilities(request.task.capabilities, option.capabilities),
      );
      const first = tasks[0];
      if (first === undefined) throw new DemandFault("invalid-input");
      const common = first
        .filter((item) =>
          tasks.every((task) => task.some((candidate) => candidate.capability === item.capability)),
        )
        .map((item): DemandTaskCapability => ({
          capability: item.capability,
          relevance: tasks.every((task) =>
            task.some(
              (candidate) =>
                candidate.capability === item.capability && candidate.relevance === "required",
            ),
          )
            ? "required"
            : "supporting",
        }));
      return ready(makeDemand(request, metadata, common));
    }

    const clarification: DemandClarification = freeze({
      kind: "demand-clarification",
      question: "Which capability scope and operation should guide this task?",
      options: candidates.map(({ option, demand }) => ({
        optionId: option.optionId,
        operation: option.operation,
        capabilities: demand.capabilities.map(({ capability, relevance }) => ({
          capability,
          relevance,
        })),
      })),
    });
    if (
      Buffer.byteLength(JSON.stringify(clarification), "utf8") >
      demandProfileProducerHardLimits.outputBytes
    ) {
      throw new DemandFault("limit-exceeded");
    }
    pending.set(
      clarification,
      new Map(candidates.map(({ option, demand }) => [option.optionId, demand])),
    );
    return freeze({ ok: true, status: "clarification-required", clarification });
  } catch (error) {
    return failure(error instanceof DemandFault ? error.category : "invalid-input");
  }
}

export function resolveDemandProfileClarification(
  clarification: DemandClarification,
  optionId: string,
): ProduceDemandProfileResult {
  const demand = pending.get(clarification)?.get(optionId);
  return demand === undefined ? failure("invalid-continuation") : ready(demand);
}

function parseRequest(text: string): DemandProfileProducerRequest {
  if (typeof text !== "string") throw new DemandFault("invalid-input");
  if (Buffer.byteLength(text, "utf8") > demandProfileProducerHardLimits.requestBytes) {
    throw new DemandFault("limit-exceeded");
  }
  const value: unknown = JSON.parse(text);
  if (
    !shape(value, ["producerVersion", "demandId", "generatedAt", "project", "task"]) ||
    value["producerVersion"] !== demandProfileProducerVersion ||
    !shape(value["project"], ["projectRef", "repositoryId", "sourcePaths"]) ||
    !shape(value["task"], ["summary", "purpose", "capabilities", "alternatives"])
  ) {
    throw new DemandFault("invalid-input");
  }
  const project = value["project"];
  const task = value["task"];
  const paths = project["sourcePaths"];
  if (
    typeof project["repositoryId"] !== "string" ||
    !identifier.test(project["repositoryId"]) ||
    !(
      paths === null ||
      (Array.isArray(paths) &&
        paths.length <= demandProfileProducerHardLimits.sourcePaths &&
        paths.every(safePath) &&
        new Set(paths).size === paths.length)
    ) ||
    !validCapabilities(task["capabilities"]) ||
    !Array.isArray(task["alternatives"])
  ) {
    throw new DemandFault("invalid-input");
  }
  const alternatives: unknown[] = task["alternatives"];
  if (
    alternatives.length === 1 ||
    alternatives.length > demandProfileProducerHardLimits.alternatives
  ) {
    throw new DemandFault("invalid-input");
  }
  const ids = new Set<string>();
  for (const option of alternatives) {
    if (
      !shape(option, ["optionId", "operation", "capabilities"]) ||
      typeof option["optionId"] !== "string" ||
      !identifier.test(option["optionId"]) ||
      ids.has(option["optionId"]) ||
      typeof option["operation"] !== "string" ||
      !["read-only", "source-write", "destructive"].includes(option["operation"]) ||
      !validCapabilities(option["capabilities"])
    )
      throw new DemandFault("invalid-input");
    ids.add(option["optionId"]);
  }
  if (
    !isDemandProfile({
      schemaVersion: "0.1.0",
      kind: "demand-profile",
      demandId: value["demandId"],
      generatedAt: value["generatedAt"],
      project: {
        projectRef: project["projectRef"],
        metadataStatus: "unavailable",
        metadataRevisionRef: null,
      },
      task: { summary: task["summary"], purpose: task["purpose"] },
      capabilities: task["capabilities"].map((item) => ({ ...item, basis: "task-input" })),
    })
  )
    throw new DemandFault("invalid-input");
  return value as unknown as DemandProfileProducerRequest;
}

interface SelectedMetadata {
  readonly project: DemandProfile["project"];
  readonly capabilities: readonly string[];
}

function selectMetadata(
  request: DemandProfileProducerRequest,
  source: FilesystemMetadataSnapshot | null,
): SelectedMetadata {
  const selection = request.project;
  if (source === null) {
    if (selection.sourcePaths !== null) throw new DemandFault("source-mismatch");
    return {
      project: {
        projectRef: selection.projectRef,
        metadataStatus: "unavailable",
        metadataRevisionRef: null,
      },
      capabilities: [],
    };
  }
  if (!isIssuedFilesystemMetadataSnapshot(source)) throw new DemandFault("not-collected");
  const repository = source.repositories.find(
    (item) => item.repositoryId === selection.repositoryId,
  );
  if (repository === undefined) throw new DemandFault("source-mismatch");
  const selected = selection.sourcePaths === null ? null : new Set(selection.sourcePaths);
  const files = repository.files
    .filter((item) => selected === null || selected.has(item.relativePath))
    .sort((left, right) => compare(left.relativePath, right.relativePath));
  if (selected !== null && files.length !== selected.size) throw new DemandFault("source-mismatch");
  const hash = createHash("sha256")
    .update(
      JSON.stringify([
        demandProfileProducerVersion,
        selection.projectRef,
        repository.repositoryId,
        repository.rootId,
        repository.unsupportedFileCount,
        files,
      ]),
    )
    .digest("hex");
  return {
    project: {
      projectRef: selection.projectRef,
      metadataStatus: repository.unsupportedFileCount > 0 ? "partial" : "available",
      metadataRevisionRef: `metadata_${hash}`,
    },
    capabilities: [
      ...new Set(
        files
          .filter((file) => file.category === "source")
          .map((file) => `language.${file.language}`),
      ),
    ].sort(compare),
  };
}

function makeDemand(
  request: DemandProfileProducerRequest,
  metadata: SelectedMetadata,
  task: readonly DemandTaskCapability[],
): DemandProfile {
  const capabilities = new Map<string, DemandCapability>(
    metadata.capabilities.map((capability) => [
      capability,
      { capability, relevance: "supporting", basis: "project-metadata" },
    ]),
  );
  for (const item of task) {
    capabilities.set(item.capability, {
      ...item,
      basis: capabilities.has(item.capability) ? "task-and-project" : "task-input",
    });
  }
  if (capabilities.size > demandProfileProducerHardLimits.capabilities)
    throw new DemandFault("limit-exceeded");
  const value = {
    schemaVersion: "0.1.0",
    kind: "demand-profile",
    demandId: request.demandId,
    generatedAt: request.generatedAt,
    project: { ...metadata.project },
    task: { summary, purpose: request.task.purpose },
    capabilities: [...capabilities.values()].sort((left, right) =>
      compare(left.capability, right.capability),
    ),
  };
  if (!isDemandProfile(value)) throw new DemandFault("invalid-input");
  if (
    Buffer.byteLength(JSON.stringify(value), "utf8") > demandProfileProducerHardLimits.outputBytes
  )
    throw new DemandFault("limit-exceeded");
  return freeze(value);
}

function mergeTaskCapabilities(
  base: readonly DemandTaskCapability[],
  extra: readonly DemandTaskCapability[],
): readonly DemandTaskCapability[] {
  const values = new Map<string, DemandTaskCapability>();
  for (const item of [...base, ...extra]) {
    if (values.get(item.capability)?.relevance !== "required") values.set(item.capability, item);
  }
  return [...values.values()].sort((left, right) => compare(left.capability, right.capability));
}

function validCapabilities(value: unknown): value is DemandTaskCapability[] {
  if (
    !Array.isArray(value) ||
    value.length > demandProfileProducerHardLimits.capabilities ||
    !value.every((item: unknown) => shape(item, ["capability", "relevance"]))
  )
    return false;
  return isDemandProfile({
    schemaVersion: "0.1.0",
    kind: "demand-profile",
    demandId: "validation",
    generatedAt: "2026-09-07T00:00:00Z",
    project: { projectRef: "validation", metadataStatus: "unavailable", metadataRevisionRef: null },
    task: { summary: "validation", purpose: "coding-assistance" },
    capabilities: value.map((item) => ({ ...item, basis: "task-input" })),
  });
}

function safePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 1024 &&
    !/[\\:]/u.test(value) &&
    [...value].every(
      (character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127,
    ) &&
    value.split("/").every((part) => part !== "" && part !== "." && part !== "..")
  );
}

function shape(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function ready(value: DemandProfile): ProduceDemandProfileResult {
  return freeze({ ok: true, status: "ready", value });
}

function failure(category: DemandProfileProducerErrorCategory): ProduceDemandProfileResult {
  return freeze({ ok: false, error: { category, retryable: false } });
}

function freeze<Value>(value: Value): Value {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
