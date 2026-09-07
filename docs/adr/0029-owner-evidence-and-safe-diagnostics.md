# ADR-0029: Bounded owner evidence and secret-safe diagnostics

- Status: Accepted
- Date: 2026-09-07

## Context and task contract

M2-S11 was integrated through PR #31 at `cfbb1b0` after successful Windows CI and secret scanning. The owner explicitly authorizes tested PR integration and sequential completion of M2. Main is synchronized, the integrated branch is removed, and M2-S12 is claimed on `feat/m2-s12-owner-diagnostics` with no competing assignment.

Traceability: M2-S12; FMU-FR-010/022/023/026; UC-07; FMU-E-015; ADR-0011/0016/0017/0027/0028. Implement read-only bounded owner capability evidence and diagnostics for the actual local installation, Store schema/state, adapter cache and optional context size. Scope includes Community owner diagnostics, adapter-owned read-only cache inspection, the local CLI, synthetic tests/evaluations and synchronized documentation. Public schemas, dependencies and consumer/MCP operations stay unchanged. No source reads, automatic repair, migration, cache clearing, profile writes, network service, private-data access or M2-S13 composition is included.

## Decision

Use exact private JSON requests with explicit Store authority. `get-capability-evidence` selects one exact capability with bounded results and explicit truncation. Return only typed assessment/provenance metadata, opaque hashed references and fixed limitation descriptions; never return private notes, source locations, author identity, extractor prose or native diagnostics. Keep historical observations distinguishable from effective corrections. Capability input is a selector and is never reflected into errors or diagnostic output. Consumer evidence disclosure remains disabled by default.

`doctor` is a read-only owner operation. Report fixed component states, bounded counts and measured context bytes; do not serialize profiles, packets, cache records, input strings or filesystem locations. Probe the adapter through a trusted callback implemented in the adapter layer, preserving Community's client neutrality. Missing, invalid, deleted, busy, stale and unavailable state must remain distinct where observable. Validate any optional DCP before reporting its size and budget status. Installation failure must produce a fixed, content-free CLI diagnostic rather than an import stack. Report only capabilities actually checked; no automatic repair or broad compatibility claim.

## Validation and limits

Run pinned clean installation, complete aggregate checks, audit and required PR CI before authorized integration. Use synthetic Store/cache fixtures and controlled subprocesses for valid/absent/deleted/corrupt/oversized inputs, links and redirected roots, byte/count/output bounds, exact versions, stale caches, packet budgets, mutation-free diagnostics and redaction canaries. Independently review diagnostic allowlists and filesystem/cache boundaries. Preserve existing source/consumer isolation and correction precedence. Stop on any unverified health claim, diagnostic content leak or mutation during a read-only operation.
