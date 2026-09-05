# ADR-0013: Claim behavior precedence and response policy

- Status: Accepted
- Date: 2026-09-05

## Context and task contract

M1-S01 is integrated on `main` at `0f03c94`, making M1-S02 the earliest eligible slice. The observable result is pure Core logic that preserves already validated, task-relevant Claims and their provenance while selecting a deterministic, client-neutral Response Policy for demonstrated, adjacent, self-declared, insufficient-evidence, disputed, mixed, and empty inputs.

Traceability is `M1-S02`, `FMU-FR-005` through `FMU-FR-007`, `FMU-NFR-006`, `FMU-E-001` through `FMU-E-004`, PROJECT_SPEC principles P-01 through P-04 and use cases UC-02 through UC-04, and ADR-0002/0008/0012. In scope are pure Core behavior, the Protocol type matching the existing DCP Response Policy shape, deterministic unit and behavioral evaluation coverage, a synthetic fixture refinement for the exact Angular-to-React scenario, and synchronized documentation.

Demand Profile derivation/intersection, DCP projection and budgets, claim derivation, correction persistence/history mutation, source analysis, provider or transport behavior, an adapter, an actual model response, network access, publication, and release are excluded. Callers must supply Claims that were already validated and selected as relevant; M1-S03 owns that selection.

## Decision

- Preserve every input Claim as a detached, deeply immutable record. Precedence never deletes, merges, relabels, upgrades, or downgrades a Claim and therefore never erases its evidence, declaration, correction, scope, freshness, or limitations.
- Apply one conservative behavior priority, from highest to lowest: `disputed`, `insufficient-evidence`, `self-declared`, `adjacent`, then `demonstrated`. This is response-safety precedence, not a new truth or confidence ranking. Ties use capability and then opaque claim identifier with code-unit comparison, making output invariant to input order and locale.
- The highest-priority relevant state selects the minimum guidance: disputed, insufficient, self-declared, or an empty set uses `teach-while-doing`; adjacent uses `analogy`; demonstrated uses `concise`. One uncertain relevant capability therefore prevents a mixed packet from under-explaining the task.
- A `guided` developer preference may increase guidance to `teach-while-doing`; preferences never reduce the state-required minimum. Teach-while-doing forces purpose-before-command, expected-result, and risk/rollback flags. Other modes retain the developer's booleans. `questionBudget` remains the validated preference and is never interpreted as a requirement to ask a question.
- `analogyCapabilities` is the sorted unique union of only the structured `adjacentFrom` fields on adjacent Claims. Rationale, limitations, correction summaries, and other free text remain inert data and cannot set policy.
- Use the existing DCP policy vocabulary exactly: `concise`, `analogy`, `teach-while-doing`, three booleans, bounded analogy capability identifiers, and question budget zero or one. No client instruction string or client/model type enters Protocol or Core.

## Consequences and alternatives

M1-S03 can supply task-relevant Claims without reimplementing behavioral precedence, and M1-S04 can project the result into the existing DCP schema. Consumers receive explicit state-preserving intent rather than inferred expertise or free-form privileged instructions.

Selecting the strongest Claim, collapsing conflicting Claims into one state, using confidence as a numeric score, treating absence as demonstrated, letting preferences suppress uncertainty safeguards, locale-sensitive sorting, and generating prose instructions are rejected. Full developer-correction conflict handling and persistence remain M2; a disputed Claim is respected here without mutating profile history.

The FMU-E-001 through FMU-E-004 tests verify the structured behavioral intent at the client-neutral Core boundary. They do not claim that an adapter or model produced compliant prose; adapter-level and integrated behavioral evidence remain M1-S06 and M1-S07 gates.

## Validation

Run the pinned Windows Node.js `24.20.0` and npm `11.19.0` clean path and `npm run check`. Unit tests cover all five states, empty and mixed inputs, permutation invariance, deterministic order, complete provenance retention, detached deep immutability, preference escalation, uncertainty safeguards, analogy allowlisting, and free-text isolation. Behavioral evaluations cover FMU-E-001 through FMU-E-004 using only synthetic fixtures. Review the full diff, local links, package boundaries, fixture sensitivity, and absence of dependency or lockfile changes.

Local Windows verification passed the complete aggregate with 75 unit tests, all draft schema corpora, and four behavioral evaluations, plus both package-level type checks and a point-in-time audit reporting zero vulnerabilities. Integration retains its explicit `bootstrap-not-applicable` exception because no process, transport, persistence, or external-system boundary exists. No manifest, dependency, or lockfile changed.

The proposed M1-S02 `Complete` and M1-S03 `Ready` transitions become authoritative only after this revision passes required pull-request CI and integrates into `main`.
