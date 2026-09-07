# ADR-0027: Local owner inspection and correction workflow

- Status: Accepted
- Date: 2026-09-07

## Context and task contract

M2-S09 is integrated at `8800577` through PR #29 with successful CI. No open PR or competing assignment exists. Main is synchronized, the integrated branch is deleted, and M2-S10 is claimed on `feat/m2-s10-owner-corrections`.

Traceability: M2-S10; FMU-FR-013/014; UC-07/08/10; FMU-E-005/011; ADR-0008/0009/0013/0023/0024/0026; SECURITY_PRIVACY T-04/T-06/T-10/T-12. The observable outcome is a no-LLM local owner interface for inspecting, declaring, correcting, disputing and rejecting Claims with persistent history, conservative precedence and acknowledgments only after verified writes.

Scope: a Community owner service, bounded first-party JSON CLI, correction-preserving composition with authentic derivation, synthetic tests/evaluations and synchronized documentation. Existing Store, Evidence, Claim and export schemas remain unchanged. No Provider/MCP owner operation, model/network dependency, import/export/deletion, source discovery, release or real private data access. Local edits, synthetic checks, isolated English commits and the authorized PR workflow are allowed. Stop on lost correction history, public contract expansion, unverified success, unauthorized effects or unresolved high-severity defects.

## Decision

- Use one closed versioned JSON request on stdin with explicit existing Store configuration. Commands are inspect, declare, correct, dispute and reject. Mutations require the observed generation and explicit timestamp; never retry automatically. This first-party owner command is separate from model-facing Provider/MCP operations and inherits the documented same-OS-user trust boundary.
- Correct/dispute append an adjustment record; reject appends a rejection. Only evidence-backed observed Claims can be disputed. Preserve the original assessment and exact referenced Evidence as immutable historical copies with deterministic opaque identifiers, then replace the effective target with a disputed assessment. Repeated edits append history and update the effective correction in commit order, including same-second edits. Never turn owner prose into demonstrated knowledge or observed depth.
- Explicit declarations produce self-declared Claims with no observed depth or evidence. They are independent assertions, not automated evidence. Inspection exposes bounded structured assessment, provenance and correction metadata; free-text notes remain private Store data and are omitted from normal CLI output. No source file is opened by inspection.
- Compose only authentic complete derivations with the loaded Store. Preserve declarations, corrections, disputed effective Claims and historical target/Evidence copies. Suppress new automated assessments for the same corrected capability and scope. Historical Evidence IDs are distinct from live extractor IDs, so changed or removed sources cannot rewrite the evidence that was corrected. Other automated Claims refresh normally.
- Validate the complete bounded Profile/Store graph before committing through M2-S06. Use the loaded next unused generation and expected active generation; acknowledge only exact verified commitment. Propagate conflicts, recovery, maintenance and uncertain commit outcomes without input-bearing diagnostics. History reaching schema/byte ceilings fails closed rather than pruning owner records.

## Consequences and validation

Core excludes historical target Claims linked by effective disputes before task intersection, preserving self-targeted legacy disputes. History stays private rather than appearing as current demonstrated knowledge in a DCP. Effective disputes conservatively become stale when source fingerprint, presence or observation time changes; their archived provenance is immutable and correction precedence survives. Derivations older than the Store's last validated mutation and corrections predating their target observation are rejected. This scoped Core projection adjustment is part of the task contract.

The owner can amend interpretation without erasing automated provenance. Corrections remain authoritative until a future explicit owner operation changes that policy; source refresh alone cannot revoke them. Inspection is a minimized private owner view, not an export or source viewer. The CLI operates on configured Stores; source selection and an end-to-end source-to-consumer command remain M2-S13.

Run pinned Windows clean installation and aggregate checks, point-in-time audit, real Store/CLI integration, malformed/oversized input and canary cases, repeated/same-second edits, stale generations and times, interrupted/uncertain writes, history bounds, and refresh/removal/restart preservation. FMU-E-005 must exercise persisted correction precedence through Core; FMU-E-011 must exercise verified owner persistence. Focused human review and required PR CI precede integration.
