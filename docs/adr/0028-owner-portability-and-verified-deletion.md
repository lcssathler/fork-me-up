# ADR-0028: Owner portability and verified local deletion

- Status: Accepted
- Date: 2026-09-07

## Context and task contract

M2-S10 is integrated at `ae22fc0` through PR #30 with successful CI. The tree is clean, no open PR or competing assignment exists, main is synchronized and the integrated branch is deleted. M2-S11 is claimed on `feat/m2-s11-owner-portability`.

Traceability: M2-S11; FMU-FR-015/026; FMU-NFR-009/011/014/020; UC-09/15; FMU-E-015; ADR-0009/0023/0026/0027; SECURITY_PRIVACY T-04/T-06/T-10/T-12. The outcome is explicit owner import, redacted Portable Profile Export creation and verified deletion of managed local Store/cache data. In scope are Community portability, coordinated Store deletion, cache disposal, adapter-owned cache cleanup, the first-party CLI, synthetic tests and synchronized documentation. Public schemas and dependency versions stay unchanged. No source deletion, arbitrary recursive cleanup, network/model runtime, release, or real private-data access. Local edits, synthetic tests, isolated English commits and the authorized PR workflow are permitted.

## Decision

- Import only bounded exact Portable Profile Exports into an absent Store with matching subject identity. Reject Store/DCP envelopes, malformed graphs, future observations and occupied destinations; never silently replace existing owner corrections. Reuse validated atomic Store commitment.
- Export an explicit allowlist projection preserving all Claim/Evidence/declaration/correction edges and order. Replace private prose with fixed text and source-relative locations with opaque references. Preserve semantic capabilities only after sensitive-content checks; scan the final serialization and validate the public schema. Create an explicit destination artifact exclusively, sync and reread it before acknowledging; never overwrite an existing export.
- Coordinate Store mutations and deletion with an exclusive bounded mutation marker. This refines ADR-0023 for deletion: generation compare-and-set remains, while a mutation gate prevents deletion from racing late activation. There is no automatic stale-gate breaking; a crashed holder fails closed and requires owner recovery after all writers stop.
- A durable content-free deletion barrier blocks load, write and migration. Delete only recognized generation/temporary files, recheck canonical directory identity and verify absence. Preserve unknown entries and the directory itself. Interrupted deletion retains its barrier for explicit resume. The barrier prevents generation-reset resurrection; reinitialization uses a new owner-selected directory.
- Dispose active in-process incremental sessions for the selected subject, clearing source cache and prior derivation and denying subsequent reuse. In-flight work cannot publish after disposal. Already returned objects and other processes require their owners to release/stop them; deletion is not secure RAM or disk erasure.
- The Codex fixture adapter cache is not Store-bound. Clearing it requires explicit all-adapter-cache scope and remains implemented in the adapter layer under its fixed root. Coordinate its writes against a deletion barrier, remove only bounded recognized regular cache/temporary files and verify absence. Do not infer ownership of arbitrary JSON files.

## Validation and limits

The CLI accepts at most 4 MiB within 30 seconds; export artifacts reserve 32 KiB for the import wrapper. Import/export intentionally remap opaque identifiers and replace private prose and source locations, preserving typed behavior and reference integrity rather than private backup fidelity. Incremental-session discovery is bounded to 128 live entries. Store deletion scans at most 64 directory entries and adapter deletion at most 256, including unrelated names. Oversized corrupt Store files above the 4 MiB bounded read, links, special entries and redirected roots require owner maintenance; they cannot produce a successful deletion acknowledgment. Directory synchronization precedes removal on every deletion attempt, including resume.

Failed temporary/gate cleanup remains observable as `maintenanceRequired` after verified commitment/export, or `deletion-incomplete` for deletion. Owner recovery requires stopped writers and removal of only the exact abandoned mutation lock; deletion barriers remain. Exported copies and independent backups are outside the managed deletion scope. [Owner workflow](../OWNER_WORKFLOW.md) documents the inventory and recovery procedure.

Run pinned Windows clean installation and complete checks plus audit. Cover reference-preserving round trips and correction behavior, redaction canaries, malformed/oversized imports, unsupported envelopes, occupied destinations, exclusive/readback export failures, interrupted/resumed deletion, concurrent writers, corrupt files, stale gates, cache disposal/resurrection, actual links/junctions and untouched sources/unrelated files. FMU-E-015 proves portable output and errors omit canaries. Document the cache inventory, independent exported copies, recovery and same-OS-user limits. Stop on unauthorized deletion, unverified success, history loss, schema expansion or unresolved high-severity defects. Required CI and focused human review precede integration.
