# M0 Exit Audit

> Result: Pass, pending pull-request review, required CI, and integration
>
> Audit date: September 5, 2026
>
> Audited `main` revision: `0c570ed8cf0730e9fb93956bfd09e50432683003`

## Task contract

This audit serves `M0-S13`, the complete M0 exit gate, the cross-milestone quality gates, and the requirements and accepted ADRs traced by the completed M0 slices. No `FMU-E-*` behavioral evaluation applies to this audit because it verifies foundations and governance rather than introducing product behavior. The existing schema and security tests are evidence only for their documented authoring boundaries, not for a runtime, client, transport, or released compatibility claim.

The observable result is a reproducible pass or a named blocker for every M0 exit criterion, followed by an ordered M1 queue only if no blocker remains. In scope are normative consistency, public draft contracts and synthetic fixtures, threat/control planning, the pinned clean-checkout path, licensing evidence, repository governance, required CI, and first-slice readiness. No M1 implementation, schema change, production dependency, release, package publication, deployment, private-source access, OAuth, Cloud behavior, or compatibility claim is in scope.

The audit changes documentation and, under the owner's explicit authorization, closes one repository-governance gap by enabling GitHub private vulnerability reporting. It does not change a public contract or require migration. A failed local or remote check, contradictory normative requirement, confirmed unmitigated critical/high finding, or unresolved M1 architecture decision would stop the transition.

## Exit-gate evidence

| M0 exit criterion | Result | Evidence |
|---|---|---|
| Normative documents do not contradict one another. | Pass | `PROJECT_SPEC.md`, `PROTOCOL.md`, `ARCHITECTURE.md`, `SECURITY_PRIVACY.md`, `ENGINEERING.md`, `ROADMAP.md`, the ADR index, and all 11 accepted ADRs were read in full. Product boundaries, contract semantics, privacy invariants, milestone scope, unreleased status, and delivery gates agree. The status and navigation updates in this slice remove the remaining stale M0-in-progress language. |
| Public contracts have draft schemas plus valid and invalid fixtures. | Pass | DCP (3 valid/5 invalid), Evidence (3/6), Claim (5/9), Portable Profile Export (2/5), Demand Profile (3/9), Profile Provider (2/6), and Provider conformance transcripts (2/5) have versioned `0.1.0` schemas and synthetic corpora. `npm run schema:check` validates all outcomes and cross-envelope constraints. The Community Profile Store (2/5) remains explicitly implementation-internal. |
| Threats have named controls and planned negative tests. | Pass | `SECURITY_PRIVACY.md` names controls for T-01 through T-13 and maintains the required negative-test matrix. Current authoring-boundary tests cover malformed input, traversal-like references, symlink/junction fixture escape, bounded reads, state/provenance mismatches, sensitive fields, canary-safe diagnostics, unsafe policy fields, and client/provider boundary violations. Runtime-only cases remain assigned to later milestone gates without being claimed as implemented. |
| Toolchain installs and baseline checks run from a clean checkout on the first declared platform. | Pass | A fresh local clone of the audited revision on Windows used Node.js `24.20.0`, npm `11.19.0`, `npm ci --ignore-scripts`, and `npm run check`. Installation added the exact 95-package development graph; formatting, lint, strict type checking, all 63 unit tests, and all schema corpora passed. Integration and behavioral suites reported only their valid M0 `bootstrap-not-applicable` entries. `npm audit --audit-level=high` reported zero vulnerabilities. |
| License and ownership implications are explicitly accepted. | Pass | `LICENSE` matches the official Apache-2.0 text modulo transport-only boundary blank lines; `NOTICE`, `TRADEMARKS.md`, ADR-0004, and the owner-acceptance record agree. The residual trademark-search limitation remains explicit. No release or package publication is implied. |
| Public-cutover audit, `main` protection, and established required CI are active and read back. | Pass | The pre-publication audit and authorized cutover are recorded in `ROADMAP.md`. Fresh authenticated readback found public visibility, default branch `main`, protected revision `0c570ed8...`, and one active ruleset (`22336912`) targeting exactly `refs/heads/main`, with no bypass actors. It requires squash-only pull requests, blocks deletion and non-fast-forward updates, and requires the strict `Windows baseline` check from GitHub Actions integration `15368`. The current-main CI run `33971345295` passed. PR #12 previously demonstrated blocked merge while that check was pending and `CLEAN` state only after success. |
| The first M1 branch is one observable outcome with no unresolved architecture decision. | Pass | The ordered M1 queue scopes `M1-S01` to the fixture-profile and Protocol/Core package foundation governed by ADR-0002, ADR-0005, ADR-0008, and ADR-0009. Later behavior, compilation, transport, adapter, and exit work remain separate blocked slices. |

## Additional quality and security review

- All 36 resulting Markdown files were checked across 212 links: 154 local targets and nine heading fragments resolved.
- The audit inventoried 157 tracked files, 15 reachable commits, 72 synthetic JSON fixtures, the package/workflow configuration, and every accepted ADR.
- High-confidence credential patterns produced no match in the tracked tree or reachable patch history. No unexpected personal absolute path was found; the two matching expressions are the deliberate `path-canary` unit-test input/assertion. The tracked email set contains the published trademark-policy contact and one reserved synthetic `example.invalid` address.
- CI actions are pinned to immutable commit SHAs, workflow permissions remain `contents: read`, checkout credentials are not persisted, lifecycle scripts remain disabled, and only Windows is claimed as currently verified.
- Repository readback found squash as the only merge method, automatic head-branch deletion, and no open pull request at audit time. Private vulnerability reporting was initially disabled; the authorized audit enabled it and verified `enabled: true`, bringing the public reporting policy and repository capability into agreement.
- No public contract lacks its M0 authoring validation, no implemented security behavior is claimed beyond its executable evidence, no real profile/private-repository fixture was found, and no client/platform/release compatibility is overstated.

## Limitations and conclusion

The repository still has no product runtime. Integration and behavioral suites remain intentionally inapplicable until M1 introduces their named boundaries. macOS/Linux verification, complete pull-request fast-gate automation, package artifacts, SBOMs, provenance, install/uninstall tests, runtime redaction/authorization, and cross-client compatibility remain later gates. The historical remote `codex/m0-s04-toolchain-workspace` branch points to an ancestor already contained in `main`; it is not an active claim or additional content boundary.

No M0 exit blocker remains. M0 may become `Complete`, and the M1 queue may become routable, only when this audit revision passes required pull-request CI and is integrated into protected `main`.
