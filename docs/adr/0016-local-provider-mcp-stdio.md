# ADR-0016: Local fixture Provider and MCP stdio mapping

- Status: Accepted
- Date: 2026-09-05

## Context and task contract

M1-S04 is integrated on protected remote `main` at `49c38b4` through pull request #17, its topic branch is deleted, and M1-S05 is the earliest eligible unclaimed slice. This task is claimed by `feat/m1-s05-local-provider-mcp-stdio` after authenticated readback found no open pull request or competing remote branch.

Traceability: `M1-S05`, `FMU-FR-010`, `FMU-FR-011`, `FMU-FR-016`, `FMU-FR-023`, `FMU-NFR-004`, `FMU-NFR-011`, PROJECT_SPEC Sections 5.1, 10, 13, and 15, PROTOCOL Sections 8, 9, 11, and 12, ARCHITECTURE Sections 3.3, 6, 8, and 10, SECURITY_PRIVACY Sections 7, 8, and 10, and ADR-0002/0007/0011/0015. No new `FMU-E-*` evaluation applies: this slice implements the provider/transport boundary and preserves the already evaluated Core compilation behavior; reference-adapter degraded behavior remains `FMU-E-014` in M1-S06.

The observable result is a local fixture-backed Profile Provider that returns exact public request/response envelopes and an MCP subprocess that exposes `get_task_context` and `get_profile_metadata` over `stdio`. Valid context is minimized and redacted; invalid, incompatible, unavailable, and too-small-budget states are typed and content-free. The real process is covered for lifecycle, tools, success, errors, canaries, bounded framing, and recovery.

In scope are Protocol runtime types/validation for the existing draft Provider schema, one Community Provider workspace, one local MCP application workspace, synthetic fixture selection, integration coverage, removal of the stale integration-suite exception, and synchronized documentation. Hard constraints are no network request/listener, arbitrary path, source root, credential, developer identifier, raw evidence, owner operation, persistence, new external dependency, client-specific Core type, schema revision, release, or publication. Local files, workspace lock metadata, a short-lived branch, tests, an authorized pull request, and authorized squash integration are allowed. Stop on a public-contract change, unsafe error content, network requirement, missing authorization, ownership conflict, unresolved high-severity finding, or failure of protected CI.

## Decision

- Implement `@fork-me-up/community-provider` in the accepted dependency direction: Community Provider depends on Core and Protocol; neither Core nor Protocol imports MCP or a client.
- Validate Provider capabilities, requests, and responses at runtime against the committed `0.1.0` schema. The provider advertises capability discovery plus profile metadata and task context, with selected-local-repository/task-context limits that do not reveal whether a profile is loaded. Unadvertised evidence access returns `unsupported-operation`.
- Load only a constructor-injected validated Portable Profile Export or an explicit unavailable state. The reference application selects one of four committed synthetic states through an exact command-line allowlist and accepts no file path.
- Derive a minimal task-input-only Demand Profile from validated tool input, then call the existing intersection and compiler. Clock and opaque Demand/DCP identifiers are injected. Compiler budget exhaustion maps to `budget-too-small`; incompatible draft input reports supported versions; failures expose no task, profile, path, source, or stack content.
- Implement the repository's referenced MCP revision `2025-11-25` directly over newline-delimited JSON-RPC. Support initialization, initialized notification, ping, deterministic tool listing, and tool calls. Return the exact Provider response in `structuredContent` and serialized text; mark Provider errors with `isError`. Tool definitions declare read-only, non-destructive, idempotent, closed-world behavior.
- Bound input lines at 65,536 UTF-8 bytes and output lines at 131,072 bytes, accommodating the bounded Provider object plus its structured-content compatibility text copy. Discard only an offending input frame and emit fixed protocol errors. Reserve `stdout` for JSON-RPC and emit only fixed content-free fatal diagnostics on `stderr`.
- Accept JSON-RPC request IDs only as safe integers or bounded opaque identifier strings, rejecting sensitive or content-bearing identifiers with a null correlation. This prevents the protocol correlation field from reflecting canaries, paths, or secrets.
- Add no MCP SDK yet. The implemented surface is small, synchronous, and covered by subprocess interoperability tests; an SDK would add a production supply-chain decision without increasing this slice's required behavior. Reconsider when a later revision, transport, or broader MCP feature makes hand-maintained compatibility materially riskier.

## Consequences and alternatives

Community now has a runnable offline process boundary and exact typed provider port without putting transport semantics in Core. Clients that support the declared MCP revision can discover and invoke the two operations, while unavailable context remains an explicit result. The integration suite is no longer exempt or empty.

Compatibility is intentionally narrow. The process does not implement MCP revisions after `2025-11-25`, resources, prompts, tasks, sampling, HTTP, authorization, persisted profiles, evidence lookup, or owner controls. `stdio` does not isolate same-user processes. These limitations prevent claims of universal client support or production profile security.

Embedding MCP types in Core, accepting arbitrary fixture/profile paths, exposing evidence or administration to the model, returning free-form error details, opening a loopback listener, adding an HTTP transport, and silently accepting later MCP revisions are rejected. Treating malformed tool arguments as JSON-RPC failures is also rejected; they return typed tool-execution errors so Provider semantics remain visible without leaking input.

## Validation

Run the pinned Windows Node.js/npm path and `npm run check`. Unit coverage validates exact capability and response shapes, bounded metadata, deterministic DCP compilation, unsupported operations, invalid/incompatible/unavailable/budget states, immutability, and safe rejection of an invalid fixture. Integration coverage launches the real entrypoint, completes MCP initialization, lists exactly two tools, invokes both successes and typed failures, proves canary redaction in valid/invalid calls, verifies no task reflection on errors, bounds/recovers an oversized frame, and rejects network imports/listeners. Review exact workspace dependencies, lockfile-only workspace additions, MCP compatibility text, full diff, and a zero-vulnerability audit. Protected pull-request CI must pass before integration; proposed queue transitions become authoritative only after merge to `main`.
