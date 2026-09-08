> Detailed evidence retained from the integrated M2-S16 audit. See the [audit summary](../M2_EXIT_AUDIT.md) for the decision.

# M2 Exit Audit

> Result: Pass, pending pull-request review, required CI, and integration
>
> Audit date: September 8, 2026
>
> Audited `main` revision: `b95e3cb89b8a6543e3de8d966fe147abd0eaa395`

## Task contract

This audit serves `M2-S16`, the complete M2 exit gate, the M2 required evaluation set, and the cross-milestone quality gates. It begins only after M2-S01 through M2-S15 are integrated into protected `main`. The audit treats prior slice reports and the frozen quality measurement as claims to verify against current source, executable behavior, a full clean checkout, dependency state, documentation, and authenticated repository readback.

The observable result is a reproducible pass or a named blocker for every M2 deliverable, required evaluation, security case, and exit criterion. M2 may close and an ordered M3 queue may become routable only if all evidence is direct and no blocker remains. In scope are authorized source configuration, filesystem and Git collection, identity/authorship and source-risk assessment, Evidence/Claim and Demand production, atomic persistence and recovery, incremental caching, owner correction/import/export/deletion/diagnostics, Store-backed consumer delivery, the complete local workflow, the frozen evidence-quality experiment, documentation and compatibility claims, clean Windows verification, dependency and repository inventory, and protected GitHub integration.

Hard constraints and non-goals are no M3 implementation, second consumer, public package or release, network source, private-repository access, Cloud behavior, new connector, schema revision, production dependency, persistent source cache, or broader platform claim. The audit may add synthetic tests or narrow fixes only for demonstrated gaps; it may update audit/status/navigation documentation and add the ordered M3 queue only after all M2 gates pass. No public contract, stored-data migration, or runtime behavior change is expected.

Required checks are a lockfile-enforced full clean install; formatting, lint, strict type checking, unit, schema, integration, and behavioral suites; every named M2 evaluation and security class; an independent frozen measurement; source/owner/consumer authority review; persistence/recovery/cache/deletion checks; canary, credential, path, symlink, network, subprocess, and output-bound review; local Markdown target validation; dependency/license audit; complete diff review; protected pull-request CI; and post-merge `main` CI. Allowed effects are local temporary synthetic repositories/Stores/caches, the short-lived audit branch, and documentation changes. Push, pull-request creation, merge, publication, release, deployment, remote configuration, or private-data access remain outside this task unless separately authorized.

## Integrated S15 commit review

The latest `main` commit is `b95e3cb`, the squash integration of [PR 35](https://github.com/lcssathler/fork-me-up/pull/35), `test: measure frozen evidence quality [M2-S15]`. It changes 22 files with 8,659 additions and three deletions. Most volume is four deliberately retained JSON measurement reports; the executable change is the bounded runner, independent scorer, command wrapper, tests, and failure-artifact CI policy. The commit adds no production dependency, public schema, source connector, network surface, or release behavior.

Focused review confirmed that the scorer keeps missing, malformed, duplicated, excess, and false-`demonstrated` observations in their denominators; owner and invariance exercises remain independent; nested controls run in isolated processes and skipped controls fail the measurement; failed CI reports are minimized and retained; and the workflow checks out full history because the frozen revision must be an ancestor. `git diff --check main^ main` passes. Runtime, package, schema, test, and workflow paths on current `main` are byte-identical to measured revision `747ad89e5a2491332b6a413813108af99590918f`; current-main changes beyond it are result and navigation records. The committed final report hash is `493be6ca4440520a9f954f19201469b5fa30053e8de564bd94b58a82847f1c20`.

## Deliverable and evaluation evidence

| M2 deliverable | Result | Evidence |
|---|---|---|
| Authorized roots and selected repositories | Pass | Closed M2-S01 configuration, canonical path identity, point-of-use reauthorization, exact ceilings, and traversal/sibling-prefix/alias/junction failures are covered by unit and real-filesystem tests. Absolute paths remain private authority data. |
| Deterministic document, manifest, source, and Git metadata collection | Pass | M2-S02/S03 collectors use fixed bounded formats and Git plumbing, reject links, special files, binary/invalid UTF-8, malicious configuration, external object stores, growth and exhaustion, and emit only sanitized metadata. Repository code, scripts, hooks, filters, URLs, and package installation are never invoked. |
| Versioned Store, atomic writes, recovery, and migration | Pass | Generation-addressed persistence validates the internal Store envelope, synchronizes staging, activates without overwrite, rereads exactly, retains rollback state, recovers below corruption, ignores orphan staging, and rehearses the synthetic `0.0.0` to `0.1.0` migration. Fault injection covers every pre/post-activation interruption. |
| Identity and authorship states | Pass | Private identities are normalized immediately to digests; direct, shared, coauthored, bot, pair-work, merge, squash, and unknown states remain distinct. `FMU-E-008` proves shared and unknown authorship cannot independently establish high-confidence depth. |
| Source-risk handling | Pass | Explicit and fixed indicators retain fork, template, generated, vendor, tutorial, duplicate, and uncertainty limitations. `FMU-E-007` proves risky records are down-ranked; unflagged records remain origin-unverified rather than declared original. |
| Multi-repository support, provenance, freshness, and invalidation | Pass | The refresh session enforces aggregate count/byte/time/cache ceilings, rescans changed sources, reuses authentic unchanged snapshots without source-content or Git calls, preserves original observation age, reassesses cross-repository duplicates, withholds incomplete aggregate output, and reports fresh/stale/partial/invalid origins. |
| Evidence, Claim, and Demand production | Pass | Pure private producers accept only authentic bounded snapshots, map only selected source languages, preserve project scope/provenance/ceilings, use stable IDs and fingerprints, report invalidation, and ask at most one material clarification. Public envelopes are revalidated before use. |
| Owner inspection, correction, and rejection | Pass | The no-LLM CLI preserves original Evidence/Claims and immutable correction history; explicit declarations remain unobserved; corrected targets are excluded from current task knowledge; conflicts, stale time, interrupted writes, and history exhaustion fail closed. `FMU-E-005` and `FMU-E-011` prove precedence and verified acknowledgment. |
| Import, export, deletion, evidence lookup, and doctor | Pass | Export is an exclusive, reread, schema-valid allowlist projection; import is absent-only and preserves typed correction behavior; deletion uses durable barriers, removes only recognized Store/cache state, preserves sources/unknown files/exports, and resumes after partial failure. Bounded owner evidence and diagnostics hash or omit private data. `FMU-E-015` covers all protected outputs. |
| Complete local Community workflow | Pass | A real subprocess integration over two temporary Git repositories covers first refresh, unchanged reuse, persisted rejection, changed-source refresh, restart, Store-backed MCP context, doctor, export, and verified deletion. It requires no account, network, hosted service, proprietary component, or dedicated LLM API. Consumer requests cannot collect, persist, mutate, or carry source authority. |
| Frozen evidence-quality experiment | Pass | The accepted S14 protocol freezes 48 cases, 52 primary records, ten invariance pairs, two owner exercises, and 23 security controls. The integrated S15 measurement and this independent rerun accept every case/control with no skip, false-`demonstrated`, correction-needed, rejection, unexpected-unknown, or ceiling-violation outcome. These are synthetic conformance results, not human-understanding or population-accuracy claims. |

| Required evaluation or security class | Result | Executable proof |
|---|---|---|
| `FMU-E-005` | Pass | Persisted owner rejection overrides automated interpretation without projecting archived knowledge as current. |
| `FMU-E-007` | Pass | Risky source classes remain visible, weak-capped, and unable to establish demonstrated depth alone. |
| `FMU-E-008` | Pass | Shared and unknown authorship remain conservative and cannot establish personal depth alone. |
| `FMU-E-009` | Pass | Material capability/relevance or operation-risk ambiguity asks exactly one bounded clarification. |
| `FMU-E-010` | Pass | Equivalent, absent, or insufficient ambiguity continues without a questionnaire. |
| `FMU-E-011` | Pass | Owner/Store success follows exact readback; failed staging or write preserves the prior valid state. |
| `FMU-E-015` | Pass | Packet, cache, task, profile, export, error, and diagnostic canaries stay out of protected output while useful bounded state remains visible. |
| Path, link, and authorization cases | Pass | Exact-root, traversal, sibling-prefix, duplicate-alias, replacement, symlink/junction, special-entry, Store/export destination, cache, and deletion tests fail closed without following targets. |
| Command and repository-instruction cases | Pass | The filesystem collector has no execution primitive; Git uses fixed argument arrays in a trusted quarantine. Hostile config, attributes, hooks, filters, messages, names, task text, manifests, and scripts remain inert data. |
| Size, depth, time, binary, and interruption cases | Pass | Exact and next-byte/count/depth/deadline boundaries, invalid UTF-8/binary data, growth/change races, subprocess output bounds, interrupted Store/export/deletion operations, and cleanup debt have direct unit/integration coverage. |

No new behavioral evaluation ID is introduced by M2-S16 because the slice changes no product or consumer behavior; it audits the existing required IDs and milestone gates.

## Exit-gate evidence

| M2 exit criterion | Result | Evidence |
|---|---|---|
| No repository code or script is executed during collection. | Pass | Recursive source-boundary tests, fixed collector ports, real hostile-repository integration, and static inspection prohibit execution, package installation, dynamic imports, hooks/filters, shell evaluation, and embedded URL following. |
| Only canonical authorized roots are read. | Pass | M2-S01/S02/S03 authority, point-of-use canonicalization and containment checks reject escape, alias, replacement, link, linked object store, and unauthorized selections before protected output. |
| Unknown authorship cannot produce high-confidence demonstrated depth on its own. | Pass | Authorship ceilings, derivation tests, `FMU-E-008`, and the frozen sample retain unknown records as unknown/insufficient evidence with no ceiling violation. |
| Correction precedence, persistence, recovery, export, and deletion are verified. | Pass | Owner, Store, portability, deletion, end-to-end, and `FMU-E-005`/`FMU-E-011`/`FMU-E-015` tests cover successful, failed, interrupted, stale, corrupt, partially available, and restarted states. |
| Unchanged inputs avoid a full rescan. | Pass | Unit and real multi-repository integrations assert zero collector/Git calls for authenticated unchanged cache hits, while age, configuration, metadata change, and invalid clocks trigger conservative rescan or invalidation. |
| A frozen experiment precedes measurement and its thresholds pass. | Pass | S14's integrated hash manifest predates S15. Current clean rerun at `b95e3cb` reports 48/48 accepted cases, 52/52 attribution records, ten expected unknown records, 10/10 invariances, 2/2 owner exercises, and 23/23 controls with no skip. The fresh report SHA-256 is `aaeccd85e5f9d153f4fed4067ac15f84a3fd7758cf9c46d7d06ff97534eb4a91`. |
| The local workflow is useful without account, dedicated LLM API, or proprietary service. | Pass | Documented owner and Store-backed MCP commands plus the complete subprocess workflow prove the local loop entirely offline after dependency installation. No runtime account, network request, model service, or proprietary module exists. |

## Cross-milestone quality gates

| Gate | Result | Evidence |
|---|---|---|
| Public contracts have schemas and compatibility tests. | Pass | All seven draft `0.1.0` public contract families retain positive/negative fixtures, exact validation, cross-envelope rejection, version failures, and Provider conformance tests. M2-S16 changes no contract. |
| Security claims have executable negative tests. | Pass | Every named M2 path, symlink/junction, command, size/depth/time, binary, malicious-text, canary, authorization, interrupted-write, cache, recovery, and deletion class appears in the passing aggregate or frozen controls. |
| Fixtures contain no real personal/private repository data. | Pass | All tracked fixtures and temporary repositories are explicitly synthetic. Inventory and sensitive-pattern review found no credential or unexpected personal/private source. |
| High-confidence Claims require attribution or declaration. | Pass | Automated M2 derivation is at most medium confidence/project scoped and requires attributable/coauthored evidence for demonstrated state; declarations stay separately self-declared. Adversarial scoring rejects false demonstrated and ceiling violations. |
| Optional failure does not weaken security. | Pass | Partial/unavailable collection withholds aggregate context, Store/adapter/provider failures return fixed errors, and Codex/provider degradation continues host work without bypassing authorization, validation, or redaction. |
| Clean local setup is reproducible. | Pass | A full local clone of `main` used Node.js `24.20.0`, npm `11.19.0`, `npm ci --ignore-scripts --offline`, and `npm run check`; 250 unit tests, every schema corpus, 59 integrations, and 19 evaluations passed with zero failure or skip. |
| The branch is one bounded change. | Pass | The only demonstrated gap is stale status/navigation documentation. This branch adds the audit, corrects those claims, closes the historical queue, and adds the ordered M3 queue; runtime, contracts, schemas, dependencies, and generated artifacts are unchanged. |
| Documentation agrees with executable behavior. | Pass after this diff | Review covered the six normative documents, all accepted ADRs through ADR-0032, README, contribution/security/versioning policies, owner/local workflow guides, handoff, reports, manifests, tests, and current commands. Stale M1/M2 status and obsolete integration-exception text are corrected in this branch. |
| No unresolved critical/high finding exists. | Pass | Current `npm audit --audit-level=high --ignore-scripts` reports zero vulnerabilities. Manual dependency, source, credential, workflow, CI, and repository-control review found no unresolved high-severity issue. |
| Compatibility is not overstated. | Pass | Claims remain limited to Windows x64, Node.js `24.20.0`, npm `11.19.0`, local MCP `stdio` revision `2025-11-25`, current Store/Provider/DCP drafts, the tested Codex fixture hooks, and the limited synthetic taxonomy. A second consumer, released packages, macOS/Linux, public-history network access, and a Community release remain M3 gates. |

## Reproducibility, inventory, and repository controls

- The full clean clone at audited `main` installed the exact lockfile without lifecycle scripts and passed formatting, lint, strict type checking, 250 unit tests, every schema corpus, 59 integrations, and 19 behavioral evaluations with no failure or skip. The source branch passed the same aggregate before documentation changes.
- The independent `npm run measure:m2` rerun was clean and passed all 48 cases, 52 attribution records, ten invariances, two owner exercises, and 23 controls. Its different byte hash from the S15 final report is expected because the report truthfully records current implementation revision `b95e3cb`; frozen inputs, evaluator hashes, thresholds, and outcomes remain unchanged.
- `npm ls --depth=0 --omit=optional` contains only the five internal workspaces and the exact reviewed top-level packages: `@eslint/js` `10.0.1`, `@types/node` `24.13.3`, Ajv `8.20.0`, ESLint `10.9.1`, Prettier `3.9.6`, TypeScript ESLint `8.69.0`, and TypeScript `6.0.3`. The lockfile contains 106 root/workspace/dependency entries under Apache-2.0, BSD-2-Clause, BSD-3-Clause, BlueOak-1.0.0, ISC, or MIT identifiers.
- The audited inventory contains 311 tracked files and 2,133,969 bytes with no tracked symbolic link. The roadmap is the largest tracked file; the other largest artifacts are the frozen sample, lockfile, and intentionally retained quality reports. No unexpected binary or generated artifact was found.
- High-confidence AWS, GitHub-token, OpenAI-key, and private-key patterns produced no content match in the tracked tree. The three apparent OpenAI-pattern matches in 38 reachable commits are the same substring in the historical path `task-context-without-disclosure.json`, not secret content. PR 35's GitGuardian check also passed.
- A final local Markdown audit checked 331 local targets and 17 heading fragments across 67 Markdown files, including this report and all status updates, with no missing destination or fragment.
- Authenticated GitHub readback found public visibility, default branch `main`, automatic merged-branch deletion, squash as the only merge method, no open pull request, and private vulnerability reporting enabled. Active ruleset `22336912` targets exactly `refs/heads/main`, has no bypass actors, blocks deletion/non-fast-forward updates, requires an up-to-date pull request, and requires the strict `Windows baseline` from GitHub Actions integration `15368`. PR 35 passed both that job and GitGuardian; post-merge `main` run `34159862891` passed at `b95e3cb`.

## Identified gap and resolution

The executable M2 gates passed, but current navigation and contribution text still described M2 as in progress, routed new work to an early M2 slice, retained an ended integration-suite exception, and listed only early evaluations. That disagreement is itself a cross-milestone blocker. This branch corrects README, contribution/security status, handoff/navigation links, the historical S15 machine handoff, and roadmap/changelog state. It adds no runtime, schema, dependency, compatibility, release, or migration behavior.

## Limitations and conclusion

M2 proves a trustworthy bounded local workflow on synthetic repositories and the declared Windows platform. The source cache is process-local; restart performs a cold source refresh while persisted profile/correction state remains. Same-OS-user processes are not mutually isolated. Content-free Store/adapter deletion barriers and abandoned mutation gates require documented owner maintenance; directory synchronization has platform-specific limits; local deletion does not erase independent exports/backups or already returned objects. Consumers never collect repositories. Automated language Claims remain project scoped, at most medium/practical-use, and based on a limited deterministic taxonomy. The frozen experiment measures conformance, not human authorship, comprehension, acceptance, or population accuracy.

No M2 exit blocker remains. M2-S16 may become `Complete`, M2 may become `Complete`, M3 may become `Ready`, and M3-S01 may become the earliest eligible slice only when this audit revision passes required pull-request CI and integrates into protected `main`. Publication, release, a second consumer, network history access, and broader platform support are not authorized or claimed by this audit.
