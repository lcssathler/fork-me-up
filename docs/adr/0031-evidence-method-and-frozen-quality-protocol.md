# ADR-0031: Evidence interpretation and frozen quality protocol

- Status: Accepted
- Date: 2026-09-07

## Context and task contract

M2-S13 is integrated at `0c882e73d282c35bd70b7faec57612be1069463d`; clean local/remote main, no open PR or competing worktree were verified. Branch `docs/m2-s14-evidence-quality-protocol` claims M2-S14. After discussing the initial proposal, the owner explicitly delegated research, method/sample/threshold selection and application to the implementing agent, with special attention to modern AI-assisted programming. This supplies the missing decision authority; it is distinct from the earlier commit/PR/merge authorization. The owner is accountable and the implementing agent makes the documented technical decision under that delegation.

Traceability: M2-S14 and the M2 quality-measurement gate; P-01/P-02/P-03; FMU-FR-005/006/018/019; FMU-NFR-006; Project Specification Sections 11 and 17; ADR-0021/0022/0024. No new behavioral evaluation ID applies to this documentation/freeze slice. M2-S15 will exercise the frozen scenarios and existing behavioral/security controls.

Observable result: a primary-source research rationale and inspectable rule limitations, plus an exact frozen synthetic sample and scoring protocol committed before any measurement. Scope is documentation and synthetic manifest data. No runtime, schema, dependency, collector permission, confidence probability, human study or source access changes. Public wire compatibility and stored data are unchanged; no migration. Required checks: static sample completeness/hashes, source/claim and local-link review, full pinned aggregate, independent review and protected CI before authorized integration. Stop for inconsistent oracles, missing provenance, measurement before freeze, privacy expansion or failed checks. Temporary proposal files are not authoritative.

## Decision

Retain deterministic evidence rules as a limited project-context mechanism. Separate Git identity association, artifact-origin indicators and claim support. Generated-artifact path indicators do not detect AI, and AI assistance does not imply missing understanding. No code-style detector, KNN classifier, activity-based expertise score or automatic interpretation of prose is introduced. Existing coauthor/bot and uncertainty ceilings remain inspectable, conservative support limits. `demonstrated` at exposure means bounded selected evidence, not certification or proof of unaided ability.

The [evidence method](../EVIDENCE_METHOD.md) records the research, alternatives and what the current implementation cannot establish. The [experiment protocol](../evaluations/M2_QUALITY_PROTOCOL.md) freezes 48 cases across two languages and 24 scenario families, including assistance-invariance and human/bot collaboration. All expected assertions must pass: zero false demonstrated, correction-needed, rejected, attribution, ceiling, invariance or security failures. This is a deterministic conformance tolerance chosen under owner delegation, not an empirically calibrated population error threshold. The unmeasured 32-case draft and its 10%/5%/95% proposals are superseded before measurement.

## Consequences and rejected alternatives

The sample can expose rule violations and protect AI-assisted participation without pretending to measure real people's knowledge. Its labels are normative expectations from the accepted rule contract, reviewed independently; they are not independent human competence labels. More synthetic repetitions cannot supply external validity. KNN and learned detectors would require a defensible target, representative labels, a leakage-controlled evaluation and a separately justified data/model boundary. No reviewed source validates those conditions for this product.

The practical-use threshold of two qualifying observations remains a documented heuristic about selected project evidence. It does not become a scientific expertise threshold because this experiment passes. Future real-world usefulness or comprehension claims require an independently designed, consented evaluation and a new explicit decision, not relabeling this sample.

## Validation

M2-S14 validates the frozen recipe and documentation without invoking its pipeline. M2-S15 records actual results, implementation revision, hashes, denominators, missing outputs, fixed persistence exercises and failures without changing the accepted sample after results. M2-S16 still owns the full milestone exit audit. A green synthetic report alone cannot close every M2 gate.
