# Changelog

This file records notable repository and public-contract changes. There are no product releases yet; `Unreleased` describes development work and does not assert that a runtime or released schema is available. Version selection follows [VERSIONING.md](VERSIONING.md).

## Maintenance policy

- Add a concise entry for each notable behavior, contract, tooling, or governance change in the same pull request. Describe the effect and cite the applicable slice, requirement, gate, or ADR; do not copy the commit log.
- Group entries under `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, or `Security` when applicable. Omit empty categories. Explain breaking changes, migration requirements, and limitations explicitly.
- Keep pending changes in `Unreleased`. Only an authorized release receives its actual version, date, and verified release links. Do not backfill fictional releases for private bootstrap commits.
- A change with no notable effect may omit an entry if the pull request explains why. Keep related normative documents and examples synchronized regardless.
- Follow [SECURITY.md](SECURITY.md) for coordinated disclosure. Changelog text must not reveal credentials, protected data, sensitive reproduction details, or an unresolved vulnerability before disclosure is agreed.

## Unreleased

### Added

- Product, protocol, architecture, engineering, security/privacy, and milestone baselines with accepted client-neutral and Community/Cloud boundaries (`M0-S01`; ADR-0001 through ADR-0003).
- Apache-2.0 licensing, attribution notices, and a separate trademark policy (`M0-S03`; ADR-0004).
- Pinned Node.js/npm workspace foundation and lockfile-enforced installation, verified initially on Windows (`M0-S04`; ADR-0005).
- Deterministic formatter, lint, strict type checking, non-empty unit tests, explicit temporary integration/evaluation exceptions, and least-privilege Windows CI (`M0-S05`; ADR-0006).
- Contribution, vulnerability-reporting, changelog, and versioning policies tied to the existing verification path and public-cutover gates (`M0-S07`).
- Unreleased DCP `0.1.0` authoring schema, synthetic positive/negative fixtures, bounded offline validation, and `npm run schema:check` in the local/CI aggregate (`M0-S08`; `FMU-FR-009`, `FMU-NFR-009`, `FMU-NFR-011`; ADR-0007). This replaces the illustrative packet version `0.1`; no released data requires migration. Runtime security enforcement and consumer conformance remain separate gates.
- Independent unreleased Evidence and Claim `0.1.0` authoring schemas with synthetic positive/negative fixtures and shared bounded offline validation (`M0-S09`; `FMU-FR-004` through `FMU-FR-006`, `FMU-FR-009`, `FMU-NFR-006`, `FMU-NFR-009`, `FMU-NFR-011`; ADR-0008). Evidence stays an observation; Claim states require matching evidence, adjacency, declaration, insufficient-evidence, or dispute provenance. No released data requires migration, and runtime derivation, precedence, reference resolution, and disclosure remain later gates.
- Separate unreleased Community Profile Store and public Portable Profile Export `0.1.0` authoring schemas with cross-envelope rejection, explicit export exclusions, synthetic fixtures, and reference-integrity checks (`M0-S10`; `FMU-FR-004`, `FMU-FR-008`, `FMU-FR-009`, preparation for `FMU-FR-015`, `FMU-NFR-009`, `FMU-NFR-011`; ADR-0009). No released data requires migration; persistence, executable migrations, export/deletion commands, and runtime redaction remain later gates.
- Unreleased Demand Profile `0.1.0` authoring schema with synthetic fixtures, typed task/project capability basis, project-metadata availability states, unique-capability validation, and cross-envelope rejection (`M0-S11`; `FMU-FR-003`, `FMU-FR-009`, `FMU-NFR-009`, `FMU-NFR-011`; ADR-0010). No released data requires migration; project inspection, demand derivation, profile intersection, and DCP compilation remain M1 work.
