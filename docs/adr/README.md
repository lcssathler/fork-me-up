# Architecture Decision Records

Accepted ADRs refine architecture within the subject-specific authority order in [`AGENTS.md`](../../AGENTS.md). They cannot override product, security/privacy, delivery-process, milestone, or released-contract invariants unless every affected higher-authority source is updated and explicitly accepted in the same change. Superseded records remain in place and link to their replacement.

| ADR | Status | Decision |
|---|---|---|
| [ADR-0001](0001-open-contracts-managed-intelligence.md) | Accepted | Keep contracts and a useful Community runtime public; monetize managed intelligence and operations. |
| [ADR-0002](0002-client-neutral-core.md) | Accepted | Keep Protocol and Core client-neutral; use adapters for client capabilities. |
| [ADR-0003](0003-separate-source-and-sharing-grants.md) | Accepted | Treat evidence-source access and context sharing as independent grants. |

## Record format

Each ADR should contain status, date, context, decision, consequences, rejected alternatives when relevant, and validation evidence. ADRs record durable decisions, not implementation progress.
