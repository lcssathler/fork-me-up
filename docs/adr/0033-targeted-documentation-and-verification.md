# ADR-0033: Targeted documentation and verification

- Status: Accepted
- Date: 2026-09-08

## Context and authority

The owner explicitly requested a faster development process after a retrospective identified repeated full-document reads, redundant checks, oversized execution narratives and stale duplicated status. Content must remain available. This decision implements that process change in AGENTS and Engineering, which retain their authority over delivery. It does not change product/security requirements, released contracts, milestone gates or external-action authority.

## Decision

- Route reading by task and affected boundary. Reuse unchanged context; reload affected authority when scope or base changes. Keep product/security invariants in AGENTS and move detailed operational sections unchanged into the active `docs/AGENT_POLICY.md` appendix, selected by subject rather than recursively read in full. Full audits and release gates retain complete coverage.
- Keep milestone definitions, states, queue and gates in the roadmap. Move completed narratives into dated history with adjusted links. Preserve detailed audit evidence behind a short verdict page. Keep frozen experiment inputs/reports byte-identical at their existing paths.
- Use one preflight and one sufficient verification set for each change. Prose-only local verification checks documents and the diff; runtime/tooling changes receive focused tests and one final aggregate. Required PR CI and risk-specific gates remain mandatory.
- Enforce entry-document byte budgets and offline local-link/heading validation with `npm run docs:check`, included in the existing aggregate. Add no dependency or network step. Preserve the existing runtime test/evaluation order after the new document check.
- Keep contracts/results in one durable record and reference them elsewhere. Detailed history is available on demand rather than recursively mandatory for every task.

## Consequences and validation

This reduces the default reading surface; it does not promise a measured development-time or token reduction. Histories retain duplication for provenance but are no longer active routing documents. The link checker supports repository Markdown conventions (inline links, reference definitions, ATX headings and explicit HTML anchors); it is not a general Markdown renderer or an external URL checker.

Validate moved content against main `cc93ae9`, preserve the M2 freeze and result hashes, test broken-link/heading and budget failures, review authority/routing consistency, and run the pinned aggregate once after tooling changes stabilize. Traceability: owner-requested process improvement; `FMU-NFR-017`; Engineering Sections 2.4 and 11; roadmap cross-milestone documentation/reproducibility gates. No behavioral `FMU-E-*` applies because product/consumer behavior is unchanged. No migration is required. Publication and integration remain separate workflow actions.
