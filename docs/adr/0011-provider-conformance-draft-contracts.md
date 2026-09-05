# ADR-0011: Profile Provider and conformance draft contracts

- Status: Accepted
- Date: 2026-09-05

## Context and task contract

M0-S11 is integrated on remote `main` at `cf1f9fc` through pull request #9, its topic branch is deleted, and M0-S12 is the earliest eligible unclaimed slice. This task is claimed by `feat/m0-s12-provider-conformance-contracts`.

Traceability: `M0-S12`, `FMU-FR-010`, `FMU-FR-023`, `FMU-NFR-001`, `FMU-NFR-009`, `FMU-NFR-011`, PROJECT_SPEC Sections 5.3, 10, and 13, PROTOCOL Sections 8, 9, and 11 through 14, ARCHITECTURE Sections 3.1, 6, and 7, SECURITY_PRIVACY T-04/T-07/T-12, and ADR-0001/0002/0007. No behavioral `FMU-E-*` evaluation applies because this slice defines unreleased provider exchange and conformance contracts; it does not implement a provider, consumer adapter, transport, authorization, DCP compilation, or client behavior.

The observable result is that `npm run schema:check` validates public Profile Provider capability descriptors and provider/consumer conformance transcripts, including typed successes/errors, limits, version negotiation, subset operations, and safe extensions. In scope are public draft schemas, synthetic fixtures, bounded development validation, tests, synchronized documentation, and the queue transition proposed after checks pass. No Provider runtime, Evidence Collector, Source Adapter, MCP server, HTTP/stdio transport, authentication, private data, production dependency, release, publication, or remote configuration is in scope.

The contracts begin as unreleased `0.1.0` authoring drafts, so no released data requires migration. Local edits, deterministic checks, a cohesive commit, and synthetic test data are allowed. Stop on client/provider coupling, a need to expose profile existence or protected content in capabilities/errors, a weakened schema/redaction boundary, unresolved ownership, a high-severity finding, or any external authorization requirement.

## Decision

- Define `schemas/profile-provider/0.1.0.schema.json` as the public client-, model-, provider-, and transport-neutral capability descriptor. Its reusable fragments define four read-oriented operations, their exact request/response envelopes, protected profile metadata, bounded evidence metadata, and content-free typed errors.
- Keep `ProfileProvider` distinct from `EvidenceCollector`/`SourceAdapter`. Provider operations report capabilities, return protected profile metadata, compile task context, or return bounded authorized evidence metadata. They never accept source roots, repository credentials, collection instructions, arbitrary developer identifiers, or owner-administrative operations.
- Every provider advertises protocol versions, supported operation/source/disclosure subsets, deployment mode, deterministic task/output limits, and stale/partial-result support. Capability discovery is mandatory. Unsupported optional operations return `unsupported-operation`; they never silently reinterpret another operation.
- Requests and responses use matching opaque request IDs and operation names. Success data is discriminated by operation; an error contains no data. Errors expose only category, retryability, and supported versions. DCP success must validate the exact DCP contract, use an advertised protocol/disclosure version, correspond to the requested task/purpose, and remain inside provider byte/token/input limits. Metadata freshness and bounded evidence results must agree with the advertised freshness/source capabilities and the evidence query.
- Define `schemas/conformance/profile-provider/0.1.0.schema.json` for public provider/consumer exchange transcripts. Supplementary validation checks cross-record semantics that JSON Schema does not express. These fixtures are contract evidence, not proof that a runtime, transport, authorization layer, or client adapter conforms.
- Exact draft authoring remains closed. Optional extensions are accepted only through an explicit `extensions` object with namespaced keys and bounded label-like scalar/array values. Consumers ignore unknown entries there. Extensions cannot redefine versions, operations, errors, policy, authorization, limits, or core claim semantics; arbitrary unknown fields still fail.
- Compile only committed fixed schemas with the existing Ajv development dependency and bounded fixture reader. No network loader, user-provided schema/path, coercion, defaults, property removal, or content-bearing diagnostics is introduced.

## Consequences and alternatives

Independent providers can declare honest subsets and test shared request/response meaning without importing a client SDK or source collector. Consumers can negotiate versions and limits before protected operations and fail safely on unavailable or unsupported behavior. Explicit extension containment makes forward evolution testable without treating arbitrary unknown input as safe.

A client-specific interface, MCP-only schema, source-collector methods on the provider, arbitrary `developerId`, free-form error messages, raw evidence/source fields, and silent operation fallback are rejected. TypeScript interfaces, executable provider/consumer SDKs, transport bindings, authorization, behavioral equivalence across clients, and runtime conformance remain later milestones.

## Validation

Run the pinned Windows Node.js/npm clean path and `npm run check`. Cover complete and subset capability descriptors; all four operations; success and typed error outcomes; request/response correlation; advertised operations/versions; input, token, and output limits; DCP semantic validation; namespaced extensions; unsupported major versions; prohibited credentials, identifiers, raw data, policy, and client fields; non-mutation; bounded fixtures; fixed canary-safe diagnostics; and local-only preloaded schema references. Manually review links, fixture sensitivity, compatibility notes, complete diff, and the absence of dependency/lockfile changes. CI for the reviewed revision must pass before integration; proposed queue transitions become authoritative only after review and integration into `main`.
