# ADR-0025: Source-backed Demand Profile producer

- Status: Accepted
- Date: 2026-09-07

## Context and task contract

M2-S07 is integrated on `main` at `ef20385` through PR #27 with successful required CI. Remote readback found no open PR and no competing slice branch; the clean local tree has one worktree. This task claims only M2-S08 on `feat/m2-s08-demand-profile`.

Traceability: `FMU-FR-003`, `FMU-FR-021`, `FMU-NFR-011`, `FMU-NFR-013`, `FMU-E-009`, `FMU-E-010`, UC-06, PROJECT_SPEC P-04/P-09, PROTOCOL 2.5, ARCHITECTURE 5.5, SECURITY_PRIVACY T-01/T-04/T-07/T-12, ADR-0010/0014/0019. The observable outcome is a deterministic, schema-valid Demand Profile from bounded explicit task capabilities and authorized current-project source-language metadata, with at most one clarification for a materially different task interpretation.

Scope: a private Community producer, authenticity marking at the existing filesystem collector, synthetic tests/evaluations, and synchronized documentation. Data stays inside the local private metadata boundary until a separately authorized compiler projection. No public schema, dependency, migration, Claim production, Store/cache orchestration, owner UI, MCP/adapter change, model/network call, release, or source-repository write. Allowed effects are local edits, synthetic fixtures, checks, an isolated commit and the user-authorized PR workflow. Stop on ownership conflict, contract expansion, protected-check failure, or an unresolved high-severity finding.

## Decision

- Keep the producer pure in Community. Accept an exact versioned JSON request capped at 32 KiB plus either an authentic, deeply immutable M2-S02 snapshot or `null`. The collector marks successful snapshots in process; serialized/forged copies have no source authority. This does not grant any new source access.
- Bind one explicit repository to the current opaque project reference. An optional exact list of up to 128 collected relative paths narrows metadata to task-selected files; `null` selects the repository's bounded metadata. Missing repository/path references fail closed. Other repositories never contribute.
- Only normalized source languages produce project-derived `language.*` demand, always supporting. Explicit task capability/relevance pairs are authoritative task input, not developer knowledge. Exact duplicates merge with required priority and `task-and-project` basis. Documents, dependencies, script names, paths and prose never infer capabilities. The union must fit the existing 32-capability contract; no silent truncation.
- Report metadata as unavailable only for `null` source, partial when the selected repository reports unsupported files, and available otherwise. This reports bounded collector coverage, not freshness or complete repository understanding. A deterministic opaque hash of selected metadata provides the revision; identifiers and generated time are injected. An empty demand is valid and asks no question by itself.
- An optional set of two to four explicit task interpretations carries only opaque option IDs, task capability/relevance pairs, and a closed operation category (`read-only`, `source-write`, `destructive`). Compare their effective demand and operation categories. Equal interpretations require no question. Different interpretations return one fixed question with structured options and no Demand Profile yet. Risk categories describe ambiguity and never authorize execution.
- A continuation accepts only the authentic pending clarification and one offered option. It produces the selected Demand Profile without another question. No answer leaves the pending decision unresolved; invalid/forged continuations return no demand. This in-process pending object is not persistent state or a model-facing operation.
- Task prose is bounded input but has no selection, permission or policy authority. Output uses a fixed minimized summary rather than echoing potentially sensitive prose. Internal file references, repository IDs, raw source, manifests and diagnostics are absent from output. Validate every completed Demand Profile through Protocol and return detached, deeply immutable output or a fixed content-free failure.

## Consequences and alternatives

Community can establish task demand without a Developer Profile, Git identity or model. A dependency cannot establish task relevance or personal proficiency. Callers supply explicit capability labels and candidate interpretations; automatic natural-language understanding, taxonomy aliases and arbitrary clarification prose are excluded. The one-question continuation is bounded to one decision; callers must retain that pending object instead of opening duplicate decisions. Unsupported files and the source-language-only taxonomy remain visible limits of this first producer.

## Validation

Run pinned Windows Node.js 24.20.0/npm 11.19.0, a lockfile-enforced install, the full aggregate, and dependency audit before integration. Cover source/task/combined/empty demand, current-project isolation, exact path selection, availability, stable revisions, exact shapes/versions/bounds, malformed/forged inputs, deterministic immutability, canaries, and capability overflow. Real synthetic filesystem integration composes collection, demand production and Core intersection. FMU-E-009 verifies one material clarification and its continuation; FMU-E-010 verifies non-material and absent ambiguity continue without questions. Review the entire diff and required PR checks before integration. Queue transitions remain proposals until reviewed integration into `main`.
