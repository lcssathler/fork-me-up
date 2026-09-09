# Documentation map

Choose the question you need to answer. Understanding or using the product does not require reading the agent development instructions.

## Understand and use the product

| I want to… | Read |
|---|---|
| Understand the product and its limits | [Project overview](../README.md) |
| Understand the business rules | [Product specification](PROJECT_SPEC.md): evidence, corrections, sharing and user control |
| Run the local workflow | [Local Community guide](LOCAL_COMMUNITY.md) |
| Inspect, correct, export or delete my profile | [Owner guide](OWNER_WORKFLOW.md) |
| See progress and what can happen next | [Roadmap and current queue](ROADMAP.md#15-current-m3-execution-queue) |
| Report a vulnerability | [Security reporting](../SECURITY.md) |

## Develop and integrate

Agents enter through [AGENTS.md](../AGENTS.md), which selects the reading required for a task. The [contribution guide](../CONTRIBUTING.md) covers setup and checks. A full audit or release still requires its complete gate coverage.

| Reference | Owns |
|---|---|
| [Protocol](PROTOCOL.md), [schemas](../schemas/) and [versioning](../VERSIONING.md) | Public objects, wire semantics and compatibility |
| [Architecture](ARCHITECTURE.md) | Components, data flow and failure behavior |
| [Security and privacy](SECURITY_PRIVACY.md) | Protected data, permissions, threats, retention and security gates |
| [Engineering](ENGINEERING.md) | Task contracts, Git, verification and delivery rules |
| [Roadmap](ROADMAP.md) | Milestone scope, states, ordered queue and gates |
| [Evidence method](EVIDENCE_METHOD.md) | How evidence is interpreted and what it cannot prove |
| [ADR index](adr/README.md) | Architectural decisions and their reasons |

Accepted ADRs remain applicable within the authority order in AGENTS. Superseded ADRs preserve the reason for an older choice; they do not govern current behavior.

<a id="evidence-on-demand"></a>

## Consult evidence when needed

Execution records: [M0](history/M0_EXECUTION.md), [M1](history/M1_EXECUTION.md), [M2](history/M2_EXECUTION.md) and [M3](history/M3_EXECUTION.md).

Exit audits: [M0](audits/M0_EXIT_AUDIT.md), [M1](audits/M1_EXIT_AUDIT.md), [M2 verdict](audits/M2_EXIT_AUDIT.md) and [complete M2 evidence](audits/details/M2_EXIT_AUDIT.md). The [quality results](evaluations/M2_QUALITY_RESULTS.md) retain the frozen measurement and its limits.

The [handoff entry](HANDOFF.md) helps resume a task. Older navigation is retained in the [M2 development baseline](history/README_M2_BASELINE.md), [M2 generic handoff](history/HANDOFF_M2_BASELINE.md) and [measurement handoff](handoffs/M2_NEXT_MACHINE.md).

<a id="maintaining-this-structure"></a>

Historical results and authorizations describe their original tasks. They do not establish current status or authorize a new action. This map is navigation; the [editorial policy](ENGINEERING.md#11-documentation-and-traceability) defines how to keep each rule in its responsible source.
