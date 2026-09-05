# M1 Exit Audit

> Result: Pass, pending pull-request review, required CI, and integration
>
> Audit date: September 5, 2026
>
> Audited `main` revision: `f7b9f83be40c1a96af288e91a86576246eb27d91`

## Task contract

This audit serves `M1-S07`, the complete M1 exit gate, the M1 required evaluation set, and the cross-milestone quality gates. It begins only after M1-S01 through M1-S06 are integrated into protected `main`. The audit treats prior slice reports as claims to verify against current files, executable behavior, clean-checkout results, dependency state, and authenticated repository readback.

The observable result is a reproducible pass or a named blocker for every M1 deliverable, required evaluation, and exit criterion. M1 may close and an ordered M2 queue may become routable only if all evidence is direct and no blocker remains. In scope are fixture Profiles, Core policy/intersection/compiler behavior, Provider and MCP `stdio`, the Codex reference adapter and compaction restoration, typed degradation, redaction/instruction isolation, client-neutral dependency boundaries, offline/no-listener behavior, deterministic budgets, current documentation/ADRs, clean Windows verification, dependency audit, and protected GitHub integration.

Hard constraints and non-goals are no M2 collector, repository inspection, local canonical-profile persistence, owner CLI, correction workflow, source or sharing grant, second consumer, public package/release, schema revision, production dependency, network service, private-source access, Cloud behavior, or portability claim. The audit may add synthetic tests or narrow verification tooling only when existing evidence is insufficient; it may update audit/status/navigation documentation and add the ordered M2 queue only after all M1 gates pass. No public contract or stored data migration is expected.

Required checks are a lockfile-enforced clean install; formatting, lint, strict type checking, unit, schema, real MCP/Codex subprocess integration, all named M1 behavioral evaluations, canary/path/raw-source negative scans, dependency-direction and network/listener inspection, local Markdown target validation, dependency audit, complete diff review, protected pull-request CI, and post-merge `main` CI. Allowed side effects are local temporary fixtures/caches, this short-lived branch, an authorized pull request, authorized squash integration, and branch deletion. Stop on contradictory normative requirements, missing executable coverage for an M1 gate, unsafe output, an unexpected dependency/network path, ownership conflict, unresolved high-severity finding, or protected CI failure.

## Deliverable and evaluation evidence

| M1 deliverable | Result | Evidence |
|---|---|---|
| Versioned fixture Developer Profiles | Pass | Three synthetic Portable Profile Export `0.1.0` carriers cover demonstrated, adjacent, and insufficient-evidence states. Protocol validation and Core loading reject malformed/cross-boundary inputs, enforce references and ordering, and return detached immutable values. |
| Pure Claim precedence and Response Policy | Pass | `packages/core/src/claim-response-policy.ts` uses only typed Claim state, provenance, structured adjacency, and validated preferences. Unit tests prove conservative precedence, deterministic ordering, immutable output, and inert free text. |
| Demand input and bounded DCP compiler | Pass | Protocol validates Demand Profile and DCP `0.1.0`; pure Core intersection and compilation enforce exact relevance, authorization, redaction, progressive disclosure, injected time/identifiers, UTF-8 byte bounds, and conservative token accounting. |
| Local Provider and MCP `stdio` | Pass | The fixture Community Provider and real MCP subprocess expose only `get_task_context` and `get_profile_metadata`, validate both sides of the boundary, bound framing and output, keep `stdout` protocol-only, and recover after invalid input. |
| One reference adapter exercising task/session delivery | Pass | The Codex adapter handles task delivery plus startup, resume, clear, and post-compaction lifecycle events through fixed allowlisted output. The checked-in default is unavailable, so trusting the project alone cannot attribute synthetic expertise. |
| Three-state behavioral evaluations | Pass | The evaluation suite exercises demonstrated, adjacent, and insufficient-evidence policy. The M1-S07 addition sends the identical synthetic React task through all three profiles and asserts distinct required and prohibited fixed-renderer behavior. |
| Supported compaction/restoration behavior | Pass | A real subprocess test persists only the structured allowlist under a hashed bounded session ID, restores it after resume/compaction while unexpired, and rejects malformed, oversized, symlinked, cleared, or expired state. |
| Typed degradation states | Pass | Provider/unit/conformance coverage verifies content-free unavailable, invalid, incompatible, and budget-limited results. Consumer validation, Provider, input, cache, and internal failures all preserve successful host continuation. |
| Canary redaction and repository-instruction isolation | Pass | Compiler, MCP, and Codex tests inject synthetic secrets, absolute paths, malicious task text, malformed requests, and unsafe cache fields; protected output and fixed diagnostics omit them and free text cannot select policy. |

| Required evaluation | Result | Executable proof |
|---|---|---|
| `FMU-E-001` | Pass | Demonstrated Java selects concise peer-level intent. |
| `FMU-E-002` | Pass | Insufficient CI evidence requires purpose, result, risk, and rollback guidance. |
| `FMU-E-003` | Pass | Angular evidence permits a bounded React analogy while forbidding a React proficiency claim. |
| `FMU-E-004` | Pass | Missing technology evidence remains insufficient evidence, never asserted ignorance. |
| `FMU-E-006` | Pass | Java demand omits unrelated Angular/React expertise and evidence. |
| `FMU-E-012` | Pass | Instruction-like repository/task text cannot change policy or disclose a canary. |
| `FMU-E-013` | Pass | Strict-budget output remains valid, relevant, deterministic, and within both limits. |
| `FMU-E-014` | Pass | Unavailable Provider and adapter state return `continue: true` without context or weaker security. |

These evaluations target structured client-neutral behavior and the reference consumer's fixed renderer, consistent with `PROJECT_SPEC.md` Section 16 and `ENGINEERING.md` Section 7. They do not claim that arbitrary model-authored wording was evaluated; model prose and equivalent behavior in a materially different second consumer remain later gates.

## Exit-gate evidence

| M1 exit criterion | Result | Evidence |
|---|---|---|
| The same task produces observably appropriate behavior for all three evidence states. | Pass | `evaluations/codex-adapter.test.mjs` uses the exact prompt `Implement a synthetic React component` for demonstrated, adjacent, and insufficient-evidence profiles. Demonstrated output is concise, adjacent output names the bounded Angular analogy and its limits, and insufficient output requires guided explanation without claiming ignorance. |
| Core compiles without client-specific types or lifecycle assumptions. | Pass | Both package-local compile checks pass. `tests/unit/m1-exit-boundaries.test.mjs` recursively checks every Protocol/Core TypeScript source rather than only an entry point and rejects Codex/client lifecycle or network dependencies. |
| No network is needed and offline mode opens no listener. | Pass | Clean installation and all checks succeeded from local repository/package data. The recursive runtime-source boundary test plus MCP/Codex subprocess tests reject network modules, dynamic network imports, `fetch`, and listener creation. |
| DCP output is schema-valid, deterministic under injected time/IDs, and within budget. | Pass | Compiler unit tests, `FMU-E-013`, Provider conformance, schema corpora, and integration tests exercise exact validation, deterministic injection/order, full compact UTF-8 size, conservative token accounting, reduction, and content-free minimum-budget failure. |
| No canary, absolute path, or raw source reaches protected outputs. | Pass | Compiler, MCP, and adapter tests cover packet, hook context, protocol errors, fixed diagnostics, cache validation, and unavailable states. Only the deliberate path-canary unit test contains a personal absolute-path expression in the tracked tree. M1 exposes no export or owner diagnostics. |
| Reference-adapter failure does not block ordinary client work. | Pass | Unit, subprocess, and `FMU-E-014` evaluation coverage verify Provider, validation, input, cache-read/clear, and internal failures return a valid non-blocking Codex hook result with no protected context. |

## Cross-milestone quality gates

| Gate | Result | Evidence |
|---|---|---|
| Public contracts have schemas and compatibility tests. | Pass | All seven public draft `0.1.0` contract families retain positive/negative synthetic fixtures, exact runtime validation where used, and Provider conformance coverage. No public contract changes in this slice. |
| Security claims have executable negative tests. | Pass | Redaction, malicious text, path/canary input, malformed/oversized frames, symlinked cache, authorization denial, consumer validation, offline/no-listener, and failure-continuation claims have direct tests. |
| Fixtures contain no real personal/private repository data. | Pass | All profile, schema, transport, and cache inputs are synthetic. Inventory and sensitive-content review found no unexpected personal path or credential. |
| High-confidence Claims require attribution or declaration. | Pass | M1 consumes validated fixture Claims rather than deriving them. Evidence/Claim schemas require state-matched provenance; demonstrated fixtures cite attributable synthetic Evidence. Real derivation remains M2 and is not claimed. |
| Optional failure does not weaken security. | Pass | Every Provider/adapter failure mode omits protected context and continues the host; no fallback changes authorization, validation, or redaction. |
| Clean local setup is reproducible. | Pass | A fresh local clone of candidate revision `458b1a5` on Windows used Node.js `24.20.0`, npm `11.19.0`, `npm ci --ignore-scripts`, and `npm run check`; all checks passed. |
| The branch is one bounded change. | Pass | The executable change is one same-task behavioral evaluation plus two recursive source-boundary tests. Remaining changes are the audit, status/navigation updates, and ordered M2 queue. |
| Documentation agrees with executable behavior. | Pass | Targeted review covered the six normative documents, README, changelog, relevant ADRs 0012 through 0017, schemas, workspaces, tests, and current claims. Limitations remain explicit. |
| No unresolved critical/high finding exists. | Pass | `npm audit --audit-level=high` reports zero vulnerabilities; manual source, dependency, credential, and remote-control review found no unresolved high-severity issue. |
| Compatibility is not overstated. | Pass | Claims remain limited to Provider/DCP `0.1.0`, MCP revision `2025-11-25`, current Codex hook lifecycle, Node.js `24.20.0`, Windows verification, and the synthetic taxonomy. |

## Reproducibility, inventory, and repository controls

- The clean candidate clone installed 100 packages and passed formatting, lint, strict type checking, 109 unit tests, every schema corpus, 12 real subprocess integration tests, and ten behavioral evaluations. The source branch passed the same aggregate before the clean clone; Protocol and Core also passed their package-local TypeScript compile checks.
- `npm ls --depth=0 --omit=optional` contains only five internal workspaces and the exact reviewed development packages: `@eslint/js` `10.0.1`, `@types/node` `24.13.3`, Ajv `8.20.0`, ESLint `10.9.1`, Prettier `3.9.6`, TypeScript ESLint `8.69.0`, and TypeScript `6.0.3`. M1-S07 changes no manifest or lockfile.
- The candidate inventory contains 213 tracked files, including 100 JSON files, 84 fixture files, and 45 Markdown files, with no tracked symbolic link. The largest source-controlled file is this roadmap; no unexpected generated or binary artifact was found.
- High-confidence credential patterns produced no match in the tracked tree or 23 reachable commits. The only tracked absolute personal-path expression is the deliberate synthetic rejection case in `tests/unit/dcp-compiler.test.mjs`.
- A local Markdown audit resolved all checked local files and heading fragments. Final documentation is checked again after this report is complete.
- Authenticated GitHub readback found public visibility, default branch `main`, automatic head-branch deletion, squash as the only merge method, no open pull request, private vulnerability reporting enabled, and one active no-bypass ruleset (`22336912`) targeting exactly `refs/heads/main`. It requires an up-to-date pull request and the strict GitHub Actions `Windows baseline`; current-main run `33980734189` passed.

## Identified gap and resolution

The existing adapter evaluation proved all three evidence states but paired them with different tasks. That was insufficient for the literal M1 exit wording because task variation could explain the output variation. Candidate commit `458b1a5` adds the controlled same-task evaluation and strengthens static boundary coverage from selected entry points to every relevant source file. Both additions failed closed and introduced no product behavior, schema, dependency, network capability, or M2 feature.

## Limitations and conclusion

M1 remains a fixture-backed technical proof. It does not collect repositories, derive evidence or Claims from real source, persist a canonical profile, expose owner workflows, support a second consumer, validate model-authored prose, publish a package/schema/release, or claim macOS/Linux portability. The Codex hook is project-local, explicitly trust-gated, and unavailable by default. MCP is local `stdio`, not a network service.

No M1 exit blocker remains. M1 may become `Complete`, M2 may become `Ready`, and M2-S01 may become the earliest eligible slice only when this audit revision passes required pull-request CI and integrates into protected `main`.
