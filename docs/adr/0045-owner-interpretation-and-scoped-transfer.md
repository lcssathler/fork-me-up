# ADR-0045: Owner interpretation view and scoped transfer proposals

- Status: Accepted
- Date: 2026-09-29

## Context

M3-S14 is integrated. M3-S15 needs the developer's existing agent to reason from selected profile evidence without making model output a Claim, a grant, or a consumer instruction. The canonical profile and its correction history already have a verified owner workflow. The public Demand Profile and DCP intentionally admit only current-project or global Claims.

## Decision

- Add a versioned, closed, first-party owner operation with two phases: `view` returns a minimized interpretation view; `admit` checks a structured proposal against a freshly loaded Store and the same selection. The owner must explicitly state that the selected metadata may be disclosed to the existing agent, with a short expiry. Neither phase is available from Provider/MCP.
- The view selects at most four source projects, sixteen active Claims and thirty-two referenced Evidence records by exact capability. Source projects must be present in the current resolved owner configuration. It omits source paths, raw content, notes, credentials, complete profile data, arbitrary limitation prose and correction notes. A digest binds selection, disclosure, Store generation, subject and algorithm version. The current Store is reloaded for each phase; stale generation, altered selection or expired disclosure fails closed. Admission rechecks observation age against the configured local cache-age ceiling without renewing it.
- An assessment may refer only to a selected active Claim and its already referenced Evidence. A transfer names an exact target project and capability, a selected source Claim, a closed relation kind and an explicit difference/unknown limit. A task need names a capability and relevance but asserts nothing about developer knowledge. Transfer retains source project, state, depth, confidence, risk limitations and evidence references; it is always a provisional hypothesis. Unknown target capabilities remain unverified. No proposal can set Response Policy, global scope, permission, observed depth or a Claim state.
- Proposals contain only typed identifiers and a closed relation vocabulary. Natural-language explanations remain the agent's untrusted presentation to the owner, not persisted evidence. No new excerpts are exposed in this slice: concept support unavailable from structured Evidence stays uncertain. The owner can use existing `declare`, `correct`, `dispute` and `reject` operations only after an explicit decision; their generation checks and verified writes remain authoritative.
- Views and proposals are ephemeral output. Nothing is added to the Store, catalog, DCP, portable export or adapter cache. The existing managed-data deletion and restart paths therefore have no new persisted inventory. Existing same-operating-system-user limits apply to the owner CLI.

## Compatibility and verification

Public Protocol schemas, Core intersection, Provider, DCP and Store format stay at `0.1.0`; no migration or consumer change is needed. This private owner contract starts at `0.1.0` and rejects unknown fields and versions. Synthetic FMU-E-022 and focused unit/integration tests cover invented references, historical/disputed claims, exact scope, unknown concepts, policy-bearing fields, stale generation, expired disclosure, correction precedence and no persistence. The live explanation and total-cost study remain M3-S16.
