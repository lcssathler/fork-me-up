# ADR-0015: Deterministic bounded DCP compiler

- Status: Accepted
- Date: 2026-09-05

## Context and task contract

M1-S03 is integrated on `main` at `927d44d`, making M1-S04 the earliest eligible slice. The observable result is a pure Core compiler that turns the immutable Demand/Profile intersection into an exact schema-valid DCP using injected identifiers and timestamps, while enforcing authorization, disclosure class, redaction, byte and token budgets, and deterministic progressive reduction.

Traceability is `M1-S04`, `FMU-FR-007`, `FMU-FR-009`, `FMU-FR-026`, `FMU-NFR-002`, `FMU-NFR-005`, `FMU-NFR-007`, `FMU-NFR-011`, `FMU-E-012`, `FMU-E-013`, PROJECT_SPEC P-01/P-02/P-04/P-07 and UC-06, and ADR-0002/0007/0013/0014. In scope are Protocol runtime types/validation for the existing DCP `0.1.0` schema, pure compilation and reduction, fixed sensitive-text controls, synthetic tests/evaluations, and synchronized documentation.

Demand or Claim derivation, project/source access, real grant resolution, persistence, provider/MCP transport, adapters, model-specific tokenization, network access, publication, and release are excluded. The schema and dependencies do not change; no released data requires migration.

Allowed effects are local source, test, documentation, and Git changes followed by the authorized review/pull-request workflow. Stop on a need to expose raw Evidence/profile data, accept caller prose as authority, weaken closed validation/redaction, introduce a tokenizer/model dependency, or cross the M1-S05 process/transport boundary.

## Decision

- Protocol is the single runtime validator for the existing DCP authoring schema, including canonical timestamps, expiry ordering, and exact compact UTF-8 byte size. The development fixture checker delegates to it.
- Core accepts only an immutable M1-S03 intersection and a closed compilation request. Packet ID, generation time, and expiry are injected values; Core reads neither clock nor randomness. Local `task-context` requires a null consumer ID, while external `consumer-session` requires an opaque consumer ID.
- The request carries a previously resolved `allow` or `deny` authorization decision. `deny` returns only `unauthorized`; this is an internal fail-closed boundary, not permission for a client to self-authorize. Real local-provider authorization remains M1-S05.
- Full Claims become compact DCP summaries. Independent Claim basis objects, the canonical profile, Evidence records, declarations, corrections, preferences, source names, paths, and raw content are never packet fields. Provenance counts unique opaque evidence references without claiming unavailable source-class metadata.
- Required Demand capabilities populate `task.requiredCapabilities`; supporting capabilities may contribute relevant Claim summaries. Unmatched or conservatively leading non-demonstrated states become structured uncertainties, with `material` derived only from required/supporting demand.
- The compiler scans every packet free-text source. A secret/canary, credential assignment, private-key marker, or absolute personal path replaces the entire affected string with fixed text and records `sensitive-free-text`; the final serialized packet is scanned again and redaction failure returns no packet. Task and profile prose never changes structured Response Policy.
- `maxBytes` is the exact existing DCP limit. `maxTokens` is an input-only portable upper bound accounted conservatively as one token per UTF-8 byte; it is not serialized and never assumes a client/model tokenizer. The emitted byte count must satisfy both limits.
- Reduction attempts are deterministic: full summaries; remove limitations; remove non-demonstrated evidence references; remove non-material uncertainties; then remove Claim summaries while retaining required before supporting and conservative states before demonstrated. Omitted required capabilities become `omitted-by-budget` uncertainties when space permits. Provenance counts only the Claims actually emitted. If the minimum valid projection does not fit, return only `budget-exceeded`.
- Successful packets and usage metadata are detached and deeply immutable. Invalid requests, authorization denials, budget failures, and redaction failures expose only a typed category.

## Consequences and alternatives

M1-S05 can expose a fixture-backed provider without reimplementing packet semantics. FMU-E-012 proves hostile bounded text cannot set policy or disclose a canary. FMU-E-013 proves an exact tight budget causes deterministic progressive reduction while the result remains relevant, schema-valid, and within both accounting limits.

Using wall clock/randomness, estimating four bytes per token, depending on a model tokenizer, truncating JSON or arbitrary Unicode strings, leaking Ajv diagnostics/input content, serializing complete Claims/Evidence, silently exceeding budget, or treating authorization input as free-form prose are rejected. Provider grant lookup, partial-result transport semantics, and runtime availability remain M1-S05.

## Validation

Run the pinned Windows Node.js `24.20.0` and npm `11.19.0` clean path and `npm run check`. Unit coverage verifies exact DCP projection, runtime validation consolidation, injection, uncertainty mapping, local/external disclosure, unauthorized and malformed failures, byte/token bounds, deterministic reduction, minimum-budget failure, redaction, canary absence, policy isolation, and deep immutability. Run FMU-E-012 and FMU-E-013 with synthetic fixtures, inspect the full diff and dependency tree, and verify zero schema/lockfile change.

Local Windows verification passed the complete aggregate with 90 unit tests, every draft schema corpus, and seven named behavioral evaluations, plus both package-level type checks and a point-in-time audit reporting zero vulnerabilities. Integration retains its explicit not-applicable exception because no process, transport, persistence, or external-system boundary exists. No manifest, dependency, schema, or lockfile changed.

The proposed M1-S04 `Complete` and M1-S05 `Ready` transitions become authoritative only after this revision passes required pull-request CI and integrates into `main`.
