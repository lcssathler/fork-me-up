# M2 handoff for the next machine

## Stop point and owner direction

The owner requested completion of the current M2-S15 stage and then a stop to continue on another machine. **Do not start M2-S16 automatically.** M2 as a whole is not complete. This handoff belongs to the M2-S15 integration; only after its PR checks and main integration are verified does S16 become eligible.

The preceding M2-S14 integrated as PR34, main commit `3bf29ea6c8ba5671ed673c128acb8d2f8b855db0`. It researched and documented the core evidence method, explicitly delegated by the owner after discussion of AI-assisted programming. Full local checks and PR/postmerge CI passed. The branch was deleted before S15 began.

S15's final clean evaluator measurement at `747ad89e5a2491332b6a413813108af99590918f` passed every frozen gate. Its [final raw report](../evaluations/results/m2-quality-final.json) is committed alongside earlier passing and failed reports. The S15 PR title is `test: measure frozen evidence quality [M2-S15]`; locate its merge and exact CI evidence using the Git/GitHub commands below. The proposed roadmap transitions become authoritative upon successful protected integration. After that integration, stop on clean updated `main` with the S15 branch removed; S16 remains unstarted and requires a new owner request.

## Decisions that must survive the move

- [Core method and primary sources](../EVIDENCE_METHOD.md): Git association, artifact indicators and human understanding are separate. No KNN, trained classifier or AI-code detector was added. AI assistance is neither a competence penalty nor evidence of competence. Generated-style paths are limited indicators; unflagged origin remains unverified. The two-file practical-use rule is a documented project-evidence heuristic, not a validated expertise scale.
- [ADR-0031](../adr/0031-evidence-method-and-frozen-quality-protocol.md): owner delegated research and exact technical/sample/threshold choices. The prior request for approval of 32 cases and 10%/5%/95% tolerances is obsolete. Do not reopen it as a blocker.
- [Frozen protocol](../evaluations/M2_QUALITY_PROTOCOL.md): `m2-quality-0.2.0`, 48 cases in two languages, 52 primary Evidence records, ten invariances, two owner exercises, zero conformance failures tolerated. [Freeze record](../evaluations/m2-quality-freeze.json) pins exact sample/protocol/method/ADR and existing control/helper bytes. Never tune them after results. Synthetic rates are not human acceptance or knowledge accuracy.
- [ADR-0032](../adr/0032-reproducible-local-quality-measurement.md) and [results](../evaluations/M2_QUALITY_RESULTS.md): real source-to-Store/Provider/owner measurement and independent adversarial scoring. Initial and verified reports are committed; two clean standalone runs were byte-identical. All 48 cases, 52 attribution records, ten invariances, two owner exercises and 23 controls passed. A later nested-control failure is also retained: inherited Node test context skipped child controls, which correctly failed the measurement. Subprocess isolation and a regression fixed it; the complete aggregate then passed with 250 unit tests, all schema corpora, 59 integrations and 19 behavioral evaluations.
- Authorizations persist: English commits, short branches, PR publication and integration after tests. Work one eligible slice at a time. Update main and remove the integrated branch before the next. No release, deployment, real private-source access or new connector was authorized by these changes.

## Reproduce on the new machine

Use the repository's pinned Node.js **24.20.0** and npm **11.19.0**, with Git available. The validated platform is Windows x64; broader platform claims remain later work. Paths from the former machine and its local tool/cache directories are not required. All necessary source, schemas, fixtures, manifests, decisions and reports are in Git.

```text
git clone https://github.com/lcssathler/fork-me-up.git
cd fork-me-up
git switch main
git pull --ff-only origin main
git status --short --branch
git log -3 --oneline
npm ci --ignore-scripts
npm run check
npm run measure:m2 -- --output <new-report-path.json>
```

Use a full clone, not a shallow history: the evaluator verifies the integrated S14 freeze commit is an ancestor and compares its committed freeze bytes. The output path must not already exist. Normal checks include the full 48-case integration and its frozen security controls. Never point this evaluator at real sources; it creates and safely removes its own temporary repositories/Stores. Failed integration reports remain in ignored `build/m2-quality-failures/` and CI uploads only those minimized JSON artifacts on failure. No external model/account/service is needed to run the product or tests; a first dependency install may need the npm registry.

With authenticated GitHub CLI, inspect current PR/CI state using `gh pr list --state open` and `gh run list --branch main --limit 3`. Repository files and current Git/CI evidence outrank this handoff if another change has since integrated. Preserve unrelated working-tree changes and active task claims.

## Next eligible work, only after a new request

Read `AGENTS.md`, the six normative documents, the ordered [roadmap](../ROADMAP.md) and relevant accepted ADRs. Confirm S15 is integrated, its CI passed, and no task already claims S16. Create one short S16 branch from updated main and record its task contract.

M2-S16 must audit **every** M2 deliverable, required evaluation (`FMU-E-005`, `FMU-E-007` through `FMU-E-011`, `FMU-E-015`), named security case, exit criterion and cross-milestone quality gate against integrated code and current results. It needs a fresh checkout/install/check, source/consumer/owner boundary evidence, persistence/recovery/cache/deletion checks, documentation/compatibility review, dependency/security review and remote protected-main evidence. The quality report alone does not close M2. Add tests or fixes only for demonstrated gaps, using synthetic data. Complete M2 only after that audit's required checks, reviewed authorized integration and successful postmerge CI. Do not start M3 or publish a release as part of this handoff.

Known limits: ephemeral source cache; same-OS-user trust boundary; content-free Store/adapter deletion barriers intentionally remain; no automatic stale-lock breaking; platform-specific directory-sync limits; exported copies/backups are not erased by local deletion. Consumers do not trigger collection. The existing Codex fixture hooks remain limited; actual Community delivery is through the tested Store-backed MCP launcher, not a claimed new live-client integration.
