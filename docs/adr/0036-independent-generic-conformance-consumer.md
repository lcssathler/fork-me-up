# ADR-0036: Independent generic conformance consumer

- Status: Accepted
- Date: 2026-09-08

## Context and task contract

M3-S02 is integrated on `main` at `5fddfe2`, making M3-S03 the earliest eligible unclaimed slice. ADR-0035 provides a private local Protocol artifact, but the only behavioral consumer remains the Codex lifecycle adapter. Portability requires a second materially different consumer to preserve the same DCP meaning without importing or reproducing Core.

Traceability is `M3-S03`, hypothesis H-04, `FMU-FR-024`, `FMU-E-016`, the M3 two-consumer exit gate, ADR-0002/0013/0017/0035, PROTOCOL Sections 5.6, 7, 9, 12 and 13, ARCHITECTURE Sections 3.4 and 7, and SECURITY_PRIVACY T-04/T-07/T-11/T-12. The observable result is a stateless generic command-line harness that installs only the public Protocol candidate, consumes a DCP and emits the same structured Claim and Response Policy meaning as Codex while admitting no free text or authority.

In scope are the private unreleased consumer, exact Protocol dependency, bounded process input/output, consumer-side validation, expiry and audience checks, synthetic negative tests, artifact-only installation and the cross-client evaluation. Schema or Core changes, Provider/source/profile access, lifecycle integration, persistence, network access, authorization, a public package version, registry publication, general client compatibility and model-authored prose are excluded. Local ignored artifacts and non-destructive checks are allowed; stop before push, merge, publication, release or another external effect.

## Decision

- Add `consumers/generic` outside Protocol, Core, Community Provider and the Codex adapter. Its manifest depends only on `@fork-me-up/protocol` `0.0.0`; the root clean install does not treat it as another public release candidate.
- Use a stateless JSON standard-input/standard-output process rather than a Provider call, client lifecycle hook or cache. Raw input is capped at 65,536 bytes and the structured context result at 8,192 UTF-8 bytes. The process opens no listener and performs no write.
- Clone the candidate before validating it with the distributed `isDeveloperContextPacket` SDK function. Reject incompatible, malformed, expired and audience-mismatched packets through one fixed content-free `no-context` result. A local packet accepts no external consumer identifier; an external packet requires the exact opaque `consumerId`. This is audience binding, not authorization proof.
- Retain only Claim capability/state/observed-depth, DCP expiry and the six closed Response Policy fields. Sort identifier-bearing fields deterministically, detach and freeze the result, and mark `authority: "none"`. Task summaries, limitations, rationales, corrections, provenance, evidence references, identifiers and every other free-text field remain unprivileged and absent.
- Extend the existing Protocol artifact integration test instead of adding another concurrent package builder. The serial flow builds one tarball, derives the Protocol production closure from the official repository lockfile, installs with `npm ci --offline --ignore-scripts` using a Windows-compatible `file:C:/...` reference, then runs the generic process only against package exports.
- Make `FMU-E-016` executable by feeding the same all-Claim-state DCP fixture to the Codex structured mapper and the generic consumer, then comparing the complete retained Claim summaries, Response Policy and expiry. This proves structured consumer behavior, not equivalent model prose or universal client compatibility.

## Consequences and validation

The second consumer has a different process and lifecycle shape while sharing no Core or client code. A malicious or unsupported DCP cannot promote text into instructions, reveal validation detail or grant a host capability. The fixed fallback lets an optional integration continue without Fork Me Up context, but callers must treat `no-context` as absence rather than an assessment.

The consumer remains a private repository harness and the Protocol tarball remains unpublished. M3-S04 retains import/export compatibility, M3-S05 retains cross-platform application installation and removal, M3-S08 retains the public compatibility table, and M3-S10 retains publication authorization.

Validation requires Node.js `24.20.0` and npm `11.19.0`, the red-to-green focused unit path, isolated artifact installation, `FMU-E-016`, strict type checking, one final aggregate, a clean checkout/cache reproduction and complete-diff review. Tests cover all five Claim states, exact policy retention, free-text canaries, incompatible/expired/audience-mismatched/oversized inputs, fixed failure output, immutability, absence of Core/Provider/Codex dependencies and artifact-only execution. Required pull-request CI and human review remain pending until the branch is proposed and integrated.
