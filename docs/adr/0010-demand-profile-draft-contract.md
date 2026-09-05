# ADR-0010: Demand Profile draft contract

- Status: Accepted
- Date: 2026-09-05

## Context and task contract

M0-S10 is integrated on remote `main` at `1dce975` through pull request #8, its topic branch is deleted, and M0-S11 is the earliest eligible unclaimed slice. This task is claimed by `feat/m0-s11-demand-profile-contract`.

Traceability: `M0-S11`, `FMU-FR-003`, `FMU-FR-009`, `FMU-NFR-009`, `FMU-NFR-011`, PROJECT_SPEC Sections 10 and 13, PROTOCOL Sections 2.5 and 3/12, ARCHITECTURE Sections 3.1, 5.5, and 5.6, SECURITY_PRIVACY T-01/T-04/T-07/T-12, and ADR-0001/0002/0007. No behavioral `FMU-E-*` evaluation applies because this slice defines an unreleased authoring contract and development fixtures; it does not derive demand, inspect a project, compile a DCP, or change consumer behavior.

The observable result is that `npm run schema:check` accepts valid Demand Profile fixtures, rejects invalid and cross-envelope fixtures, and runs through the existing local/CI aggregate. In scope are one public schema, synthetic fixtures, bounded development validation, tests, synchronized documentation, and the queue transition proposed after checks pass. No project or repository read, Demand Profile producer, profile intersection, DCP compiler, Provider interface, MCP operation, runtime package, production dependency, release, publication, or remote configuration is in scope.

The contract begins as an unreleased `0.1.0` authoring draft, so no released data requires migration. Local edits, deterministic checks, a cohesive commit, and synthetic test data are allowed. Stop on a conflict with task relevance, a need to include raw project/source data or policy-bearing text, unresolved ownership, a high-severity finding, or any external authorization requirement.

## Decision

- Define a self-contained JSON Schema draft 2020-12 contract at `schemas/demand-profile/0.1.0.schema.json`, identified by `urn:fork-me-up:demand-profile:0.1.0`. It declares `schemaVersion: "0.1.0"` and `kind: "demand-profile"` and remains distinct from the DCP, Portable Profile Export, and internal Store envelopes.
- Bind each Demand Profile to an opaque demand identifier, an opaque current-project reference, an explicit bounded task summary and purpose, a generated timestamp, and a bounded capability list. The contract contains no user identity or stable consumer identifier.
- Represent project metadata availability as `available`, `partial`, or `unavailable`. An available snapshot requires an opaque metadata revision reference; an unavailable snapshot prohibits one; partial metadata may carry one. These fields report input availability only and do not authorize a source read or prove freshness.
- Each capability has a client-neutral relevance of `required` or `supporting` and a typed basis of `task-input`, `project-metadata`, or `task-and-project`. Capability identifiers must be unique, and project-derived bases are prohibited when project metadata is unavailable. The basis records why a capability entered demand without copying task or repository content into a privileged rationale.
- Allow an empty capability list. When the task does not support a reliable capability label, the contract preserves that uncertainty instead of inventing demand. Runtime derivation and the one-question policy remain M1 behavior.
- Treat the task summary as bounded untrusted data. Closed authoring objects reject claims, evidence, profile data, response policy, grants, credentials, raw project metadata, source content, paths, and arbitrary extensions. Schema validity does not establish authorization, task relevance, safe redaction, or instruction authority.
- Extend the existing fixed, bounded, offline fixture checker. The schema is self-contained and compiled from its committed URL only, with no network loader, arbitrary path, coercion, defaults, property removal, or content-bearing diagnostics. A supplementary deterministic check enforces unique capability identifiers.

## Consequences and alternatives

The public contract gives the future Core a client-neutral input to intersect with a private Developer Profile while keeping task demand separate from developer ability. Typed basis and availability states preserve the distinction between explicit task input and authorized project metadata without creating a generic repository digest.

Embedding Demand Profile fields directly in a DCP is rejected because demand exists before private-profile intersection and disclosure policy. Embedding Claim or Evidence records is rejected because demand describes the task, not the developer. Free-form rationales, raw manifests, filenames, repository names, task-generated instructions, provider-specific taxonomies, and runtime derivation rules are deferred or rejected at this boundary.

## Validation

Run the pinned Windows Node.js/npm clean path and `npm run check`. Cover empty, task-only, and task-plus-project demand; exact versions and closed objects; metadata availability/revision consistency; duplicate and invalid capabilities; task bounds and inert instruction-like text; cross-envelope rejection; non-mutation; bounded fixture behavior; fixed canary-safe diagnostics; and local-only schema references. Manually review links, fixture sensitivity, compatibility notes, complete diff, and the absence of dependency/lockfile changes. CI for the reviewed revision must pass before integration; proposed roadmap transitions become authoritative only after review and integration into `main`.
