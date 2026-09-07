import assert from "node:assert/strict";
import test from "node:test";
import {
  produceDemandProfile,
  resolveDemandProfileClarification,
} from "@fork-me-up/community-provider";
import {
  demandRequest,
  demandSnapshot,
  readyDemand,
} from "../tests/helpers/demand-profile-fixture.mjs";

test("FMU-E-009: material capability or operation ambiguity asks once and resolves only the selected interpretation", async () => {
  const request = demandRequest();
  const source = await demandSnapshot();
  for (const alternatives of [
    [
      {
        optionId: "local",
        operation: "source-write",
        capabilities: [{ capability: "testing.unit", relevance: "required" }],
      },
      {
        optionId: "pipeline",
        operation: "source-write",
        capabilities: [{ capability: "delivery.ci", relevance: "required" }],
      },
    ],
    [
      { optionId: "inspect", operation: "read-only", capabilities: [] },
      { optionId: "delete", operation: "destructive", capabilities: [] },
    ],
  ]) {
    const result = produceDemandProfile(
      JSON.stringify({ ...request, task: { ...request.task, alternatives } }),
      source,
    );
    assert.equal(result.status, "clarification-required");
    assert.equal("value" in result, false);
    assert.equal(typeof result.clarification.question, "string");
    assert.equal("questions" in result.clarification, false);
    const selected = resolveDemandProfileClarification(
      result.clarification,
      alternatives[0].optionId,
    );
    const demand = readyDemand(selected);
    assert.equal("clarification" in selected, false);
    assert.equal("operation" in demand, false);
    assert.deepEqual(
      demand.capabilities.map((item) => item.capability).sort(),
      [
        "language.typescript",
        ...alternatives[0].capabilities.map((item) => item.capability),
      ].sort(),
    );
    assert.doesNotMatch(
      JSON.stringify([result, selected]),
      /CANARY|SOURCE_CANARY|TASK_CANARY|responsePolicy|authorization/u,
    );
  }
});

test("FMU-E-010: equivalent interpretations, no ambiguity and missing evidence continue without a questionnaire", async () => {
  const request = demandRequest();
  const source = await demandSnapshot();
  const task = {
    ...request.task,
    capabilities: [{ capability: "language.typescript", relevance: "required" }],
  };
  const alternatives = [
    {
      optionId: "one",
      operation: "source-write",
      capabilities: [{ capability: "language.typescript", relevance: "supporting" }],
    },
    {
      optionId: "two",
      operation: "source-write",
      capabilities: [{ capability: "language.typescript", relevance: "required" }],
    },
  ];
  const ordinary = produceDemandProfile(JSON.stringify({ ...request, task }), source);
  assert.deepEqual(
    produceDemandProfile(JSON.stringify({ ...request, task: { ...task, alternatives } }), source),
    ordinary,
  );
  assert.equal("clarification" in ordinary, false);
  const metadataOnly = produceDemandProfile(JSON.stringify(request), source);
  const provenanceOnly = [
    {
      optionId: "explicit",
      operation: "read-only",
      capabilities: [{ capability: "language.typescript", relevance: "supporting" }],
    },
    { optionId: "implicit", operation: "read-only", capabilities: [] },
  ];
  assert.deepEqual(
    produceDemandProfile(
      JSON.stringify({ ...request, task: { ...request.task, alternatives: provenanceOnly } }),
      source,
    ),
    metadataOnly,
  );
  assert.deepEqual(
    produceDemandProfile(
      JSON.stringify({
        ...request,
        task: { ...request.task, alternatives: [...provenanceOnly].reverse() },
      }),
      source,
    ),
    metadataOnly,
  );
  assert.deepEqual(
    readyDemand(produceDemandProfile(JSON.stringify(request), null)).capabilities,
    [],
  );
});
