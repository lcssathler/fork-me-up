# ADR-0012: Fixture profile and package foundation

- Status: Accepted
- Date: 2026-09-05

## Context and task contract

M0 is complete on `main`, making M1-S01 the earliest eligible slice. The observable result is that minimal Protocol and Core workspace packages validate and load versioned synthetic fixture Developer Profiles through a deterministic, client-neutral boundary while enforcing Core → Protocol dependency direction.

Traceability is `M1-S01`, `FMU-FR-004`, `FMU-FR-008`, `FMU-FR-009`, `FMU-NFR-001`, `FMU-NFR-009`, `FMU-NFR-011`, and ADR-0002/0005/0008/0009. No behavioral `FMU-E-*` evaluation applies because this slice establishes fixture input and package boundaries; it does not select response policy or affect an agent.

In scope are private unreleased workspace packages, runtime validation, synthetic fixtures, unit coverage, dependency recording, and synchronized documentation. Response policy, claim precedence, Demand Profile intersection, DCP compilation, persistence, transport, provider, adapter, network access, publication, and release are excluded.

## Decision

- `@fork-me-up/protocol` owns the runtime types and exact validation for the public Portable Profile Export `0.1.0` authoring contract. It reuses the canonical committed schemas and the already reviewed exact Ajv `8.20.0` dependency without a network loader, coercion, defaults, or mutation.
- Versioned Developer Profile fixtures use valid Portable Profile Export envelopes as synthetic input carriers instead of inventing a second interchange contract. `@fork-me-up/core` validates the carrier through Protocol, copies and deeply freezes only `profileVersion` and the profile payload, and discards subject, export, generation, and exclusion metadata. This does not make an internal Store acceptable as an export.
- Core depends on Protocol; Protocol does not depend on Core, clients, model providers, transports, MCP, Cloud, or Pro code. Both workspaces remain private and at unreleased version `0.0.0`.
- Source TypeScript and root schemas are intentionally consumed in-place during repository development under the pinned Node.js/npm runtime. Artifact layout, declarations, bundling, and public package publication remain M3 release work.
- Existing Store/Export authoring checks delegate Portable Export and shared profile-reference semantics to Protocol, preventing parallel runtime definitions while retaining Store-only timestamp checks.

## Consequences and alternatives

Later M1 slices receive deterministic, immutable profile inputs representing demonstrated, adjacent, and insufficient-evidence states without gaining policy authority or client semantics. Invalid and cross-boundary input fails with a single content-free `invalid-input` category.

A new Developer Profile envelope, mutable Core state, Core-owned protocol validation, duplicated validators, package publication, and client-specific package dependencies are rejected. The fixture carrier does not prove owner intent, redaction, persistence, compatibility, behavioral correctness, or released package usability.

Ajv moves from a root-only development dependency to the Protocol package's exact runtime dependency, but the resolved dependency graph and version do not change. No lifecycle script or new transitive dependency is introduced.

## Validation

Use the pinned Windows Node.js `24.20.0` and npm `11.19.0` path. Run `npm ci --ignore-scripts`, `npm run check`, and a point-in-time `npm audit --audit-level=high`. Unit coverage must accept all three synthetic fixtures; reject malformed, unknown, dangling, duplicate, timestamp-invalid, Store, and DCP inputs; prove detached deep immutability and deterministic output; and assert the package dependency direction and absence of client-specific imports. Review fixtures for personal or sensitive data and review the full dependency and lockfile diff.

Local Windows verification passed a clean lockfile installation, the complete aggregate with 68 unit tests, all schema corpora, exact package-level type checks, and a point-in-time audit reporting zero vulnerabilities. Integration and behavioral evaluation retain explicit `bootstrap-not-applicable` exceptions because this slice introduces neither an external/cross-package integration boundary nor agent behavior. Manual review found only synthetic fixture identifiers and relative paths, valid local Markdown targets, the two expected workspace links, and no new resolved dependency version or transitive package.

The proposed M1-S01 `Complete` and M1-S02 `Ready` transitions become authoritative only when this revision passes required pull-request CI and integrates into `main`.
