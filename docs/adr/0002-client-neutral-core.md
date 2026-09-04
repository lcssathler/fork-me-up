# ADR-0002: Client-neutral Core and reference adapters

- Status: Accepted
- Date: 2026-09-04

## Context

The initial specifications described Fork Me Up primarily as a Codex plugin. Codex provides useful skills, MCP support, and lifecycle hooks, but making those concepts part of the domain model would prevent the developer profile from being reused by other AI tools and harnesses.

Different clients support different transports, authentication flows, lifecycle events, context budgets, and instruction mechanisms. Universal compatibility cannot be assumed.

## Decision

- Protocol and Core contain no client- or model-specific types.
- The public DCP is the primary interoperability artifact.
- Providers and consumers communicate through versioned schemas and a small read-oriented contract.
- Client lifecycle behavior belongs in adapters.
- Codex may be the first reference adapter, but it is not a product dependency or privileged protocol consumer.
- Local delivery starts with MCP `stdio` plus file/SDK options.
- Future managed delivery may use MCP Streamable HTTP over HTTPS with OAuth.
- Every adapter documents and tests the transport, authentication, lifecycle, schema versions, output limits, and behaviors it actually supports.
- Portability is not claimed until the same DCP semantics work through at least two materially different consumers without a Core fork.

## Consequences

### Positive

- The developer profile is portable across tools.
- Client integrations can evolve independently.
- The Core is easier to test without a running client.
- No external product becomes a roadmap dependency.

### Negative

- The project must define explicit adapter capabilities and typed unsupported behavior.
- Lifecycle conveniences such as automatic session injection may not exist in every client.
- Conformance tests and compatibility documentation become required work.

## Rejected alternatives

- **Codex-specific Core:** rejected because it contradicts profile portability.
- **Lowest-common-denominator behavior only:** rejected because adapters should use client capabilities without redefining Core semantics.
- **Native partner integrations before a stable contract:** rejected because it creates coupling before product validation.

## Validation

Core must compile without adapter dependencies, and the Community release must demonstrate equivalent claim meaning and required behavioral intent in two materially different consumers.
