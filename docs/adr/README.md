# Architecture Decision Records

Accepted ADRs refine architecture within the subject-specific authority order in [`AGENTS.md`](../../AGENTS.md). They cannot override product, security/privacy, delivery-process, milestone, or released-contract invariants unless every affected higher-authority source is updated and explicitly accepted in the same change. Superseded records remain in place and link to their replacement.

| ADR | Status | Decision |
|---|---|---|
| [ADR-0001](0001-open-contracts-managed-intelligence.md) | Accepted | Keep contracts and a useful Community runtime public; monetize managed intelligence and operations. |
| [ADR-0002](0002-client-neutral-core.md) | Accepted | Keep Protocol and Core client-neutral; use adapters for client capabilities. |
| [ADR-0003](0003-separate-source-and-sharing-grants.md) | Accepted | Treat evidence-source access and context sharing as independent grants. |
| [ADR-0004](0004-apache-license-and-trademark-policy.md) | Accepted | License public repository content under Apache-2.0 and govern project marks separately. |
| [ADR-0005](0005-node-npm-workspace-toolchain.md) | Accepted | Pin the Node.js/npm toolchain and define the public npm workspace foundation. |
| [ADR-0006](0006-baseline-checks-and-ci.md) | Accepted | Establish deterministic baseline checks and least-privilege Windows CI. |
| [ADR-0007](0007-dcp-draft-schema-validation.md) | Accepted | Define the first DCP draft schema and offline authoring-fixture validation. |
| [ADR-0008](0008-evidence-claim-draft-contracts.md) | Accepted | Define independent Evidence and Claim draft contracts with state-matched provenance. |
| [ADR-0009](0009-profile-store-export-boundary.md) | Accepted | Separate the reference provider's internal Profile Store from the public Portable Profile Export and every DCP. |
| [ADR-0010](0010-demand-profile-draft-contract.md) | Accepted | Define a task-scoped Demand Profile contract without developer assessment, raw project data, or policy authority. |
| [ADR-0011](0011-provider-conformance-draft-contracts.md) | Accepted | Define client-neutral Profile Provider exchanges and public provider/consumer conformance transcripts. |
| [ADR-0012](0012-fixture-profile-package-foundation.md) | Accepted | Load synthetic fixture profiles through minimal client-neutral Protocol and Core packages. |
| [ADR-0013](0013-claim-precedence-response-policy.md) | Accepted | Preserve Claims under conservative behavior precedence and select a client-neutral Response Policy. |
| [ADR-0014](0014-demand-profile-intersection.md) | Accepted | Intersect validated task demand with only applicable global or current-project Claims. |
| [ADR-0015](0015-deterministic-bounded-dcp-compiler.md) | Accepted | Compile immutable task intersections into redacted, deterministic, strictly bounded DCPs. |
| [ADR-0016](0016-local-provider-mcp-stdio.md) | Accepted | Implement a fixture-backed client-neutral Provider behind a bounded MCP `stdio` mapping. |

## Record format

Each ADR should contain status, date, context, decision, consequences, rejected alternatives when relevant, and validation evidence. ADRs record durable decisions, not implementation progress.
