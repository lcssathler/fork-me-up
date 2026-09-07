# ADR-0032: Reproducible local evidence-quality measurement

- Status: Accepted
- Date: 2026-09-07

## Context and task contract

M2-S14 and its exact freeze are integrated at `3bf29ea6c8ba5671ed673c128acb8d2f8b855db0` (PR34). Main was synchronized, its prior branch removed, and raw-byte freeze hashes revalidated before claiming `test/m2-s15-frozen-quality-measurement`. The owner authorized sequential implementation, English commits, PRs and integration after tests, and delegated the recorded research decisions.

Traceability: M2-S15, the M2 measurement gate, Project Specification profile-quality metrics, ADR-0031 and the frozen `m2-quality-0.2.0` protocol. Observable result: one documented command executes all 48 frozen real source cases, scores exact expected observations and ten invariances, verifies two persisted owner exercises and frozen security controls, and emits a minimized reproducible report with failures retained.

Scope: internal evaluation scripts, scoring regression tests, synthetic result reports and documentation. No production/schema/dependency changes are planned. No real private source, adapter cache, model, network runtime, human study or future milestone implementation. Repository recipe, expected labels, thresholds and frozen security inputs cannot change after measurement. Tests must prove incorrect/missing/extra outputs cannot pass the scorer. Validate bounded Git argument-array execution, temporary root cleanup, hash/ancestor checks, controls without skips, report redaction, duplicate run agreement and full pinned aggregate/clean install before protected CI and authorized integration. Any production defect requires an isolated fix with the first failed report preserved. Public compatibility and Store format are unchanged; no migration.

## Decision

Keep evaluation separate from runtime authority. Load only the checked-in frozen sample after validating hashes and the integrated freeze revision. Create new bounded synthetic roots per case; execute the existing real collectors, assessment, derivation, Store, Provider and owner APIs. A pure scorer compares results to the frozen oracle without invoking the production derivation algorithm. Native errors are replaced with fixed stage codes, all cases remain in denominators, and missing/skipped controls fail the gate.

Reports contain safe case IDs, typed observations, counts and version/hash provenance. They never contain source snapshots, identity strings, private paths or native diagnostics. Deliberately malformed evaluator outputs test the evaluator rather than merely repeating the production rules. Reproduction compares minimized behavioral observations; wall-clock duration and unspecified Git object hashes are not claimed deterministic.

## Consequences and validation

This closes a bounded synthetic conformance gate when every required assertion passes. It cannot validate the two-file heuristic as a human-knowledge measure or establish population accuracy. The frozen method's limitations continue to apply. M2-S16 owns the subsequent complete milestone audit. Actual result references and executed validation are recorded in the quality report and roadmap after measurement, never inferred from this ADR.
