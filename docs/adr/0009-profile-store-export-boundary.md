# ADR-0009: Internal Profile Store and Portable Profile Export boundary

- Status: Accepted
- Date: 2026-09-05

## Context and task contract

M0-S09 is integrated on remote `main` at `beeca89` through pull request #7, its topic branch is deleted, and M0-S10 is the earliest eligible unclaimed slice. This task is claimed by `feat/m0-s10-profile-export-boundary`.

Traceability: `M0-S10`, `FMU-FR-004`, `FMU-FR-008`, `FMU-FR-009`, contract preparation for `FMU-FR-015`, `FMU-NFR-009`, `FMU-NFR-011`, PROJECT_SPEC Sections 10 and 13, PROTOCOL Sections 2.3/2.4 and 6/12, ARCHITECTURE Sections 3.1/3.3 and 5.4, SECURITY_PRIVACY T-04/T-06/T-10 and Sections 8/9, and ADR-0001/0002/0008. No behavioral `FMU-E-*` evaluation applies because this slice defines unreleased storage/export authoring boundaries and fixtures; it does not persist, migrate, export, delete, compile, or deliver profile data.

The observable result is that `npm run schema:check` accepts valid internal Community Profile Store and public Portable Profile Export fixtures, rejects their invalid fixtures and each other's envelope, and rejects a DCP at both boundaries. In scope are one implementation-internal store schema, one public export schema, synthetic fixtures, bounded development validation with reference-integrity checks, tests, and synchronized contract/governance documentation. No runtime package, filesystem write, migration executor, export/delete command, source access, Demand Profile, Provider API, MCP operation, production dependency, release, publication, or remote configuration is in scope.

Both formats begin as unreleased `0.1.0` authoring drafts, so no released data requires migration. Local edits, deterministic tests, a cohesive commit, and the queue transition proposed after checks pass are allowed. Stop on a conflict with the private-store/public-export distinction, a need to expose credentials or raw source, unresolved ownership, a high-severity finding, or an external authorization requirement.

## Decision

- The public Portable Profile Export lives at `schemas/portable-profile-export/0.1.0.schema.json`, declares `schemaVersion: "0.1.0"` and `kind: "portable-profile-export"`, and uses the stable schema identifier `urn:fork-me-up:portable-profile-export:0.1.0`.
- The Community reference provider's implementation-internal store lives under `schemas/internal/community-profile-store/0.1.0.schema.json`, declares `storeSchemaVersion: "0.1.0"` and `kind: "community-profile-store"`, and uses an explicitly internal schema identifier. Its public repository location makes the reference implementation inspectable; it does not make the store an interchange contract or bind independent providers to it.
- Both envelopes reuse the exact Evidence and Claim authoring contracts by preloaded URN references. The export defines its public profile payload of evidence, claims, declarations, corrections, project references, and typed preferences. The internal store may reuse that exportable payload while adding only required store identity, subject/profile revision, and internal generation/validation/migration bookkeeping. Consumers still exchange the export envelope, never the store file.
- The export requires an explicit exclusions object fixed to credentials, raw source, Source Grants, Sharing Grants, and internal state. Closed authoring objects also reject those fields. The flags document the contract boundary but do not prove that a future exporter performed redaction; runtime export must construct, validate, and safely write the projection before reporting success.
- Declarations and corrections are bounded typed provenance records inside the export contract. Corrections distinguish assertion, rejection, and adjustment; rejection/adjustment target an existing Claim, while assertion has no target. This does not define correction precedence behavior or a standalone Correction interchange contract.
- Development validation supplements JSON Schema with deterministic in-envelope integrity checks: identifiers are unique within each record class; every Claim evidence, declaration, correction, and project reference resolves; every correction target resolves; and referenced declaration/correction capabilities match the Claim. Store creation/update/validation timestamps are monotonically ordered. No external lookup, current clock, filesystem path, or network service participates.
- Empty profiles are valid. Missing evidence remains uncertainty rather than negative knowledge. Profile Store, Portable Profile Export, and DCP envelopes reject one another and remain semantically distinct: private canonical state, owner-initiated portability artifact, and minimized task projection respectively.
- Extend the fixed offline checker using the existing Ajv dependency and bounded fixture reader. Dependency schemas are loaded only from committed fixed URLs before compilation. Arbitrary schema paths, remote references, coercion, defaults, property removal, and content-bearing diagnostics remain prohibited.

## Consequences and alternatives

The boundary is executable before persistence exists: future Community code has an internal activation format, while independent providers and owners have an open migration artifact that does not expose provider bookkeeping. Reusing exact Evidence/Claim schemas prevents a second meaning for observations and assessments. The internal reference store can evolve independently, but any public export change remains governed by protocol compatibility and migration evidence.

Publishing the internal store as the portable contract is rejected because it would leak implementation lifecycle fields and lock independent providers to one storage design. Encoding a complete profile as a DCP is rejected because it violates minimization, purpose, expiry, and task scope. Exporting arbitrary JSON, credentials, raw source, grants, or cache state is rejected. Implementing atomic writes, migrations, export/delete commands, or correction precedence is deferred to their runtime slices.

## Validation

Run the pinned Windows Node.js/npm clean path and `npm run check`. Cover valid empty and populated envelopes, unsupported versions, unknown/sensitive fields, exclusions, cross-envelope and DCP rejection, duplicate and dangling references, capability mismatches, correction target rules, timestamp ordering, bounded fixture behavior, fixed canary-safe CLI diagnostics, and local-only preloaded schema dependencies. Manually review links, fixture sensitivity, complete diff, compatibility notes, and the absence of dependency/lockfile changes. CI for the reviewed revision must pass before integration; proposed roadmap transitions become authoritative only after review and integration into `main`.
