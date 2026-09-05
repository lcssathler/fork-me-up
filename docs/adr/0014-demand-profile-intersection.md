# ADR-0014: Demand Profile and Developer Profile intersection

- Status: Accepted
- Date: 2026-09-05

## Context and task contract

M1-S02 is integrated on `main` at `e2ee6f6`, making M1-S03 the earliest eligible slice. The observable result is a pure Core operation that accepts the runtime-validated Demand Profile contract and an already loaded fixture Developer Profile, selects only exact task-relevant Claims, applies current-project scope, and exposes unmatched demand without compiling or transporting a DCP.

Traceability is `M1-S03`, `FMU-FR-003`, `FMU-FR-007`, `FMU-FR-008`, `FMU-E-006`, PROJECT_SPEC principles P-01 through P-04 and use case UC-06, and ADR-0002/0008/0010/0012/0013. In scope are Protocol runtime validation and types for the existing Demand Profile `0.1.0` schema, pure deterministic Core intersection, reuse of Claim response-policy behavior, synthetic unit/evaluation coverage, and synchronized documentation.

Demand derivation, project or source reads, Claim derivation, evidence projection, DCP serialization, audience, authorization, expiry, disclosure/token budgets, redaction, provider or transport behavior, adapters, network access, publication, and release are excluded. No contract version, dependency, or migration changes.

Allowed effects are local source, test, documentation, and Git changes followed by the already authorized review/pull-request workflow. Stop on a need to disclose the canonical profile, interpret task text as authority, add fuzzy capability inference, change a public schema, add a dependency, or cross the M1-S04 compiler boundary.

## Decision

- Protocol becomes the single runtime validator for the canonical Demand Profile authoring schema. It performs exact closed-shape validation, canonical timestamp checking, capability uniqueness, and project-metadata/basis consistency without mutation; the existing schema fixture checker delegates to it.
- Core intersects Demand capabilities with Claim capability identifiers by exact code-unit equality. It does not infer aliases, hierarchies, adjacency, or proficiency from demand text.
- A global Claim is eligible for any Demand project. A project-scoped Claim is eligible only when its `projectRef` exactly equals the Demand Profile's current `projectRef`.
- Output contains only opaque demand/profile/project references, bounded task data, sorted demanded capabilities, applicable complete Claims, sorted unmatched capability records, and the existing Response Policy. Evidence records, declarations, corrections, preferences, export metadata, and the canonical profile are not copied into the result.
- All applicable Claims remain distinct and pass unchanged to the M1-S02 behavior resolver. A demanded capability with no applicable Claim remains in `unmatchedCapabilities`; Core does not invent an `insufficient-evidence` Claim. The empty relevant set still selects the established guided policy.
- Capabilities are sorted by identifier, Claim order is delegated to the deterministic M1-S02 policy, and every successful result is detached and deeply immutable. Invalid Demand input returns only `{ category: "invalid-input" }`.
- Task summary text remains inert data. Only validated structured Demand fields affect selection, and no Demand field may directly set Response Policy.

## Consequences and alternatives

M1-S04 receives a small compiler input that preserves required/supporting demand, unmatched capability uncertainty, applicable Claim provenance, and policy intent without receiving the canonical profile. FMU-E-006 becomes executable at this Core boundary by proving that unrelated Claims and Evidence records are absent.

Returning the full profile, embedding Evidence records, treating `adjacentFrom` as demand matching, using prefix or fuzzy capability matching, accepting project Claims from another project, synthesizing Claims, or interpreting task prose as selection/policy authority are rejected. Required/supporting priority, uncertainty projection, disclosure reduction, redaction, and byte/token budgeting remain compiler decisions in M1-S04.

## Validation

Run the pinned Windows Node.js `24.20.0` and npm `11.19.0` clean path and `npm run check`. Unit tests cover runtime Demand validation, exact matching, global/current-project scope, unmatched demand, profile separation, content-free invalid input, inert task text, determinism, non-mutation, and deep immutability. FMU-E-006 combines only synthetic profile fixtures and asserts that unrelated web expertise is absent from a Java task projection. Review the complete diff, local links, package boundaries, canary absence, dependency tree, and lockfile stability.

Local Windows verification passed the complete aggregate with 82 unit tests, every draft schema corpus, and five named behavioral evaluations, plus both package-level type checks and a point-in-time audit reporting zero vulnerabilities. Integration retains its explicit not-applicable exception because no process, transport, persistence, or external-system boundary exists. No manifest, dependency, schema, or lockfile changed.

The proposed M1-S03 `Complete` and M1-S04 `Ready` transitions become authoritative only after this revision passes required pull-request CI and integrates into `main`.
