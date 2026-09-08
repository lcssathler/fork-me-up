# Documentation map

Start with [AGENTS.md](../AGENTS.md) for reading routes, authority and task rules; its [detailed workflow policy](AGENT_POLICY.md) preserves the operational rules by subject. Select the relevant sections below; historical records are read only when a task needs their evidence. A milestone exit, security audit or release retains its complete required coverage.

| Question | Authoritative source |
|---|---|
| What should the product do? | [Product specification](PROJECT_SPEC.md): principles, use cases and stable requirement IDs. |
| What may cross a public boundary? | [Protocol](PROTOCOL.md): objects, semantics, disclosure, versions and conformance; [schemas](../schemas/). |
| Which component owns a responsibility? | [Architecture](ARCHITECTURE.md): layers, data flow and failure semantics. |
| What must fail closed? | [Security and privacy](SECURITY_PRIVACY.md): data classes, trust boundaries, threats and security gates. |
| How should this change be delivered and checked? | [Engineering](ENGINEERING.md#24-verification): verification matrix, Git workflow, editorial rules and Definition of Done. |
| What is eligible next? | [Roadmap](ROADMAP.md#15-current-m3-execution-queue): current queue; [state rules](ROADMAP.md#12-m0-execution-record) and milestone gates. |
| Why was an architectural choice made? | [ADR index](adr/README.md): read the accepted decisions relevant to the affected boundary. |
| How do I run or control local data? | [Local Community](LOCAL_COMMUNITY.md) and [owner workflow](OWNER_WORKFLOW.md). |
| What does the evidence mean? | [Evidence method](EVIDENCE_METHOD.md) and [frozen measurement/results](evaluations/M2_QUALITY_RESULTS.md). |
| How do I contribute or report a vulnerability? | [Contributing](../CONTRIBUTING.md), [security policy](../SECURITY.md) and [versioning](../VERSIONING.md). |

## Evidence on demand

Completed execution narratives: [M0](history/M0_EXECUTION.md), [M1](history/M1_EXECUTION.md), [M2](history/M2_EXECUTION.md). These records preserve their original decisions, prerequisites, test results and task authorizations; they do not grant authority to a new task.

Exit audits: [M0](audits/M0_EXIT_AUDIT.md), [M1](audits/M1_EXIT_AUDIT.md), [M2 summary](audits/M2_EXIT_AUDIT.md) and [M2 complete evidence](audits/details/M2_EXIT_AUDIT.md).

Previous navigation material: [M2 development baseline](history/README_M2_BASELINE.md), [M2 generic handoff](history/HANDOFF_M2_BASELINE.md) and [S15 machine handoff](handoffs/M2_NEXT_MACHINE.md). Start new work from the [current handoff](HANDOFF.md).

## Maintaining this structure

Use `npm run docs:check` for local links, heading fragments and entry-document budgets. Product requirements, security invariants and roadmap gates keep their existing authority; this map is navigation only. Keep current state in the roadmap, decisions in ADRs and detailed evidence in its own record. Frozen experiment files and raw reports retain their bytes and paths. See [editorial policy](ENGINEERING.md#11-documentation-and-traceability).
