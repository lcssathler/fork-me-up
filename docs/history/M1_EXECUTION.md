# M1 execution history

> Historical record preserved from main cc93ae9 (September 8, 2026). Status statements and authorizations describe their original tasks. Use the [current roadmap](../ROADMAP.md) for new work.

## 13. M1 execution record

This ordered table records how M1 was delivered. It no longer routes new work; Section 15 is the current execution queue. The eligibility, ownership, and transition rules in `AGENTS.md` and the state meanings recorded in Section 12 still apply.

| Order | Slice | State | Observable outcome | Prerequisites and traceability |
|---:|---|---|---|---|
| 1 | `M1-S01` — Fixture profile and package foundation | `Complete` | Minimal Protocol and Core workspace packages load and validate versioned synthetic fixture Developer Profiles through a client-neutral, deterministic boundary while enforcing the accepted dependency direction. No response policy, DCP compiler, transport, or adapter is introduced. | M0 exit; M1 fixture-profile deliverable; `FMU-FR-004`, `FMU-FR-008`, `FMU-FR-009`; `FMU-NFR-001`, `FMU-NFR-009`, `FMU-NFR-011`; ADR-0002, ADR-0005, ADR-0008, ADR-0009, and ADR-0012. |
| 2 | `M1-S02` — Claim precedence and response policy | `Complete` | Pure Core logic preserves claim states and provenance, applies deterministic precedence, and selects the required client-neutral response policy for demonstrated, adjacent, and insufficient-evidence fixtures. | M1 claim-precedence/response-policy deliverables; `FMU-FR-005` through `FMU-FR-007`; `FMU-NFR-006`; `FMU-E-001` through `FMU-E-004`; ADR-0013. |
| 3 | `M1-S03` — Demand/profile intersection | `Complete` | Pure task relevance intersects a validated Demand Profile with fixture profile state and omits irrelevant expertise without compiling or transporting a final packet. | M1 Demand Profile input; `FMU-FR-003`, `FMU-FR-007`, `FMU-FR-008`; `FMU-E-006`; ADR-0010 and ADR-0014. |
| 4 | `M1-S04` — Deterministic bounded DCP compiler | `Complete` | Core emits schema-valid DCPs with injected time/identifiers, deterministic disclosure reduction, strict byte/token budgets, canary redaction, and repository-instruction isolation. | M1 compiler and security deliverables; `FMU-FR-007`, `FMU-FR-009`, `FMU-FR-026`; `FMU-NFR-002`, `FMU-NFR-005`, `FMU-NFR-007`, `FMU-NFR-011`; `FMU-E-012`, `FMU-E-013`; ADR-0007 and ADR-0015. |
| 5 | `M1-S05` — Local Provider and MCP `stdio` | `Complete` | A local fixture-backed Profile Provider exposes `get_task_context` and `get_profile_metadata` through MCP `stdio`, with typed invalid, incompatible, unavailable, and budget-limited states, no network listener, and integration coverage. | M1 provider/MCP deliverables; `FMU-FR-010`, `FMU-FR-011`, `FMU-FR-016`, `FMU-FR-023`; `FMU-NFR-004`, `FMU-NFR-011`; ADR-0011 and ADR-0016. |
| 6 | `M1-S06` — Reference adapter and graceful degradation | `Complete` | One reference adapter maps only allowlisted response-policy fields, exercises task/session delivery, preserves ordinary host work when unavailable, and adds compaction restoration only if the selected client capability supports it. | M1 adapter and degraded-operation deliverables; `FMU-FR-012`, `FMU-FR-025`; `FMU-NFR-001`, `FMU-NFR-008`; `FMU-E-014`; ADR-0002 and ADR-0017. |
| 7 | `M1-S07` — M1 exit audit | `Complete` | An integrated audit runs the required behavioral, integration, schema, offline, redaction, determinism, budget, and adapter-failure evidence and either closes M1 or names a blocker. | Full M1 exit gate and required evaluations; cross-milestone quality gates. The audit is recorded in [`docs/audits/M1_EXIT_AUDIT.md`](../audits/M1_EXIT_AUDIT.md). |

### M1-S01 fixture profile and package foundation

M1-S01 introduces private unreleased `@fork-me-up/protocol` and `@fork-me-up/core` npm workspaces in the accepted dependency direction. Protocol provides exact runtime validation backed by the canonical Portable Profile Export, Evidence, and Claim `0.1.0` schemas. Core accepts only a valid Portable Profile Export carrier and returns a detached, deeply immutable private value containing only `profileVersion` and the profile payload. Existing Store/Export authoring validation reuses the same Protocol reference semantics instead of maintaining a second implementation.

Three versioned synthetic Developer Profile carriers exercise demonstrated, adjacent, and insufficient-evidence states. Unit coverage rejects malformed and cross-boundary envelopes, duplicate or dangling references, invalid evidence ordering, and unknown instruction-like fields; it also verifies deterministic output, deep immutability, exact workspace dependencies, and the absence of client-specific imports. Invalid input returns only the content-free category `invalid-input`.

Pinned local Windows verification passed a clean lockfile installation, the complete aggregate with 68 unit tests and every schema corpus, both package-level type checks, local Markdown target review, dependency-tree review, and a point-in-time audit reporting zero vulnerabilities. The dependency graph adds only the two workspace links; Ajv remains at the previously reviewed exact version `8.20.0` and becomes Protocol runtime reachability.

Traceability is `FMU-FR-004`, `FMU-FR-008`, `FMU-FR-009`, `FMU-NFR-001`, `FMU-NFR-009`, `FMU-NFR-011`, and ADR-0012. No behavioral `FMU-E-*` evaluation applies because the slice only validates and loads fixture inputs; claim precedence and response-policy behavior begin in M1-S02. There is no persistence, export command, Demand Profile intersection, DCP compilation, provider, transport, adapter, network access, publication, release, or compatibility claim.

The M1 `In progress`, M1-S01 `Complete`, and M1-S02 `Ready` transitions become authoritative only after this revision passes the required pull-request CI and integrates into `main`.

### M1-S02 claim precedence and response policy

M1-S02 adds a pure `resolveClaimResponsePolicy` Core boundary for Claims that a caller has already validated and selected as task-relevant. It returns detached deeply immutable Claims ordered by conservative behavior priority — disputed, insufficient-evidence, self-declared, adjacent, then demonstrated — with every original state and provenance field intact. Capability and opaque claim-identifier tie-breakers make the result independent of input order and locale.

The highest-priority state selects the minimum client-neutral guidance: uncertainty, dispute, declaration, or an empty set uses `teach-while-doing`; adjacent uses `analogy`; demonstrated uses `concise`. Guided preferences may add explanation, but no preference suppresses uncertainty safeguards. Analogy capabilities are a sorted unique projection only from structured adjacency; free-form rationale and limitations cannot set policy. This is behavior-safety precedence rather than a truth, confidence, or seniority ranking.

FMU-E-001 through FMU-E-004 now execute against the structured Core output: demonstrated Java selects concise intent; insufficient CI evidence selects purpose, result, risk, and rollback guidance; Angular evidence permits only an explicit bounded React analogy; and absence remains `insufficient-evidence` rather than ignorance. These evaluations prove Core policy intent; M1-S06 separately exercises the fixed Codex adapter renderer, while the integrated milestone audit remains M1-S07.

Pinned local Windows verification passed the complete aggregate with 75 unit tests, every draft schema corpus, and all four named behavioral evaluations, plus both package-level type checks and a point-in-time audit reporting zero vulnerabilities. Integration correctly retains its explicit not-applicable exception. No manifest, dependency, or lockfile changed.

Traceability is `FMU-FR-005` through `FMU-FR-007`, `FMU-NFR-006`, `FMU-E-001` through `FMU-E-004`, and ADR-0013. There is no Demand Profile derivation/intersection, DCP compilation or budget, claim derivation, persisted correction handling, source access, provider, transport, adapter, network access, dependency change, publication, release, or compatibility claim.

The M1-S02 `Complete` and M1-S03 `Ready` transitions become authoritative only after this revision passes the required pull-request CI and integrates into `main`.

### M1-S03 Demand/profile intersection

M1-S03 promotes the existing Demand Profile `0.1.0` contract into Protocol runtime types and validation; the authoring fixture checker now delegates to that single boundary. Pure Core `intersectDemandProfileWithDeveloperProfile` matches only exact capability identifiers, accepts global Claims plus project-scoped Claims for the Demand Profile's current project, and passes the applicable set to the established conservative Response Policy resolver.

The detached deeply immutable intermediate contains bounded demand/task fields, sorted required/supporting capabilities, complete applicable Claims, explicit unmatched capability records, and response-policy intent. It excludes the canonical profile, Evidence records, declarations, corrections, preferences, and export metadata. Unmatched demand is not converted into an invented Claim, and instruction-like task text remains inert. Audience, authorization, expiry, redaction, disclosure reduction, byte/token budgets, and DCP validation remain M1-S04 work.

FMU-E-006 now combines synthetic fixture expertise and proves that Angular/React Claims and Evidence are absent from a Java task projection. Unit coverage additionally verifies Demand validation consolidation, exact relevance, global/current-project scope, explicit unmatched demand, cross-envelope and unknown-field rejection, content-free failures, deterministic output, non-mutation, and deep immutability.

Pinned local Windows verification passed the complete aggregate with 82 unit tests, every draft schema corpus, and five named behavioral evaluations, plus both package-level type checks and a point-in-time audit reporting zero vulnerabilities. Integration correctly retains its explicit not-applicable exception. No manifest, dependency, schema, or lockfile changed.

Traceability is `FMU-FR-003`, `FMU-FR-007`, `FMU-FR-008`, `FMU-E-006`, and ADR-0014. There is no Demand Profile derivation, source/project access, Claim derivation, DCP compilation or budget, redaction, provider, transport, adapter, network access, dependency change, publication, release, or compatibility claim.

The M1-S03 `Complete` and M1-S04 `Ready` transitions become authoritative only after this revision passes the required pull-request CI and integrates into `main`.

### M1-S04 deterministic bounded DCP compiler

M1-S04 promotes the existing DCP `0.1.0` contract into Protocol runtime types and validation; the authoring fixture checker delegates to the same boundary. Pure Core `compileDeveloperContextPacket` converts an immutable M1-S03 intersection into compact Claim summaries and structured uncertainties using injected packet ID, generation time, and expiry. Local task context and external consumer-session shapes are closed and authorization denial returns no protected content.

The compiler applies fixed sensitive-text replacement and final canary/secret/path scanning without allowing task, limitation, adjacency, or correction prose to alter Response Policy. It never includes the canonical profile, Evidence records, raw content, source names, or paths. Exact UTF-8 bytes satisfy both the schema's `maxBytes` and the input-only conservative `maxTokens` accounting limit of one token per byte.

When the full packet exceeds either limit, deterministic progressive disclosure removes Claim limitations, non-demonstrated evidence references, non-material uncertainties, and then lower-retention Claim summaries. Required demand and conservative states receive retention priority; an omitted required capability becomes explicit budget uncertainty when space permits. Provenance covers only emitted Claims. If the smallest schema-valid packet cannot fit, the result is a content-free `budget-exceeded` error.

FMU-E-012 proves instruction-like text cannot change policy or disclose a canary. FMU-E-013 proves a tight budget produces a valid, relevant, reduced packet within both bounds. Unit coverage additionally verifies exact projection, runtime validation, deterministic injection/order, uncertainty/provenance summaries, local/external disclosure, malformed/unauthorized failures, immutable results, and redaction.

Pinned local Windows verification passed the complete aggregate with 90 unit tests, every draft schema corpus, and seven named behavioral evaluations, plus both package-level type checks and a point-in-time audit reporting zero vulnerabilities. Integration correctly retains its explicit not-applicable exception. No manifest, dependency, schema, or lockfile changed.

Traceability is `FMU-FR-007`, `FMU-FR-009`, `FMU-FR-026`, `FMU-NFR-002`, `FMU-NFR-005`, `FMU-NFR-007`, `FMU-NFR-011`, `FMU-E-012`, `FMU-E-013`, and ADR-0015. There is no demand/Claim derivation, source/project access, real grant resolution, persistence, provider, transport, adapter, network access, dependency change, publication, release, or compatibility claim.

The M1-S04 `Complete` and M1-S05 `Ready` transitions become authoritative only after this revision passes the required pull-request CI and integrates into `main`.

### M1-S05 local Provider and MCP stdio

M1-S05 promotes the accepted Profile Provider `0.1.0` request/response fragments into exact Protocol runtime types and validation, then adds private unreleased `@fork-me-up/community-provider` and `@fork-me-up/mcp-local` workspaces in the accepted dependency direction. The provider loads only a validated injected synthetic Portable Profile Export or an explicit unavailable state, exposes mandatory capability discovery internally, and supports profile metadata plus task-context compilation without accepting a developer identifier, source root, credential, arbitrary path, raw evidence request, or administrative operation.

The MCP process maps only `get_task_context` and `get_profile_metadata` onto those transport-neutral operations. It implements MCP `2025-11-25` initialization, ping, deterministic tool listing, and tool calls over newline-delimited `stdio`; later revisions and other features are not claimed. Tool inputs are schema-validated, every line is bounded, `stdout` contains protocol messages only, and the source imports no network client/server module or listener. Fixed fixture selection is a development allowlist. Provider successes return exact structured/serialized envelopes; invalid, incompatible, profile-unavailable, unsupported, redaction, and too-small-budget failures have no data or free-form diagnostic content.

Subprocess integration coverage ends the bootstrap exception and exercises initialization, both tools, exact read-only annotations, adjacent task minimization, aggregate metadata, unavailable and budget-limited states, canary redaction on valid and invalid calls, oversized-frame recovery, output purity, and absence of network code. Unit coverage additionally verifies runtime contract validation, deterministic injected time/IDs, immutability, capability non-disclosure, unadvertised evidence failure, and invalid-fixture rejection.

Pinned local Windows verification passed a lockfile-enforced clean installation, the complete aggregate with 98 unit tests, all draft schema corpora, five MCP subprocess integration tests, and seven behavioral evaluations, plus a point-in-time audit reporting zero vulnerabilities. The dependency graph adds only the two new workspace links; no external package or resolved dependency version changes.

Traceability is `FMU-FR-010`, `FMU-FR-011`, `FMU-FR-016`, `FMU-FR-023`, `FMU-NFR-004`, `FMU-NFR-011`, and ADR-0016. No new `FMU-E-*` applies because this slice transports the already evaluated Core result; M1-S06 retains `FMU-E-014` for consumer graceful degradation. There is no source/project inspection, persistence, arbitrary user profile loading, owner CLI, evidence lookup, remote transport, authentication, client adapter, new external dependency, released schema/package, publication, or migration.

The M1-S05 `Complete` and M1-S06 `Ready` transitions become authoritative only after this revision passes the required pull-request CI and integrates into `main`.

### M1-S06 reference adapter and graceful degradation

M1-S06 adds the private unreleased `@fork-me-up/codex-adapter` workspace in the accepted dependency direction. Codex-specific event and output types remain entirely in the adapter. A checked-in project command hook handles `UserPromptSubmit` for task delivery and `SessionStart` for startup, resume, clear, and post-compaction restoration. The adapter invokes the fixture Community Provider in-process, while M1-S05's MCP `stdio` surface remains a separate client-neutral option.

The consumer validates Provider responses and exact correlation again, recognizes only the four fixed synthetic M1 capabilities, and renders fixed developer-context sentences from Claim capability/state/observed-depth plus the six closed Response Policy fields. It never promotes the task summary, limitations, rationale, corrections, extensions, errors, paths, profile, or Evidence into instructions. The discovered hook configuration selects the unavailable fixture so project trust alone cannot attribute synthetic expertise; tests and deliberate demonstrations choose fixtures through an exact allowlist. The last structured allowlisted projection and DCP expiry are cached under a hashed bounded session identifier in the operating-system temporary directory with byte bounds, atomic replacement, symlink rejection, and restrictive POSIX modes where supported.

Task input, Provider, response-validation, expiry, cache-read/clear, and internal failures all return the same valid Codex hook result: `continue: true`, no blocking decision, and no additional context. A cache-write failure can still deliver the current validated projection but cannot promise later restoration. Startup/clear removes prior state; resume/compact restores only a valid unexpired projection. Project trust and explicit review of the exact non-managed hook remain Codex controls and are not bypassed.

Unit, subprocess integration, and behavioral coverage exercises the three evidence states, fixed field allowlist, malicious task/cache content, consumer-side validation, bounded input/output, real cross-process compaction restoration, clear/expiry, unavailable Provider/state, and `FMU-E-014`. The adapter opens no listener, makes no network request, adds no external dependency, and changes no public schema. Compatibility is limited to the documented current Codex hook lifecycle, Provider/DCP `0.1.0`, Node.js 24.20.0, and the synthetic fixture taxonomy; there is no production profile persistence, general task inference, second consumer, release, or portability claim.

Pinned local Windows verification passed a lockfile-enforced clean installation and the complete aggregate with 107 unit tests, all draft schema corpora, 12 subprocess integration tests, and nine behavioral evaluations. A point-in-time dependency audit reports zero vulnerabilities. The lockfile adds only the adapter workspace and its two existing internal links; no external package or resolved dependency version changes.

Traceability is `FMU-FR-012`, `FMU-FR-025`, `FMU-NFR-001`, `FMU-NFR-008`, `FMU-E-014`, and ADR-0017.

The M1-S06 `Complete` and M1-S07 `Ready` transitions become authoritative only after this revision passes the required pull-request CI and integrates into `main`.

### M1-S07 M1 exit audit

The [M1 exit audit](../audits/M1_EXIT_AUDIT.md) evaluates every M1 deliverable, required behavioral evaluation, exit criterion, and cross-milestone quality gate against integrated `main` revision `f7b9f83`. It found one evidence gap: the adapter suite exercised all three evidence states, but not with an identical task. A narrow evaluation now sends the same synthetic React task through demonstrated, adjacent, and insufficient-evidence profiles and verifies three distinct, policy-appropriate fixed-renderer outcomes. A second narrow test recursively enforces client/lifecycle neutrality across every Protocol and Core source and the absence of network/listener primitives across all M1 runtime sources.

Pinned Windows verification passed a lockfile-enforced clean installation, the complete aggregate with 109 unit tests, all draft schema corpora, 12 real subprocess integration tests, and ten behavioral evaluations. Both package-level compile checks, an offline dependency inventory, a local Markdown-link audit, current-tree and reachable-history credential scans, source-boundary inspection, and a point-in-time dependency audit reporting zero vulnerabilities also passed. Authenticated GitHub readback confirmed the public repository, protected `main`, exact no-bypass squash-only ruleset and required strict `Windows baseline`, successful current-main CI, automatic branch deletion, and private vulnerability reporting.

The behavioral proof is intentionally bounded to the client-neutral structured policy and the reference adapter's fixed allowlisted renderer. It does not claim model-authored prose, a second consumer, production repository inference, a released protocol, or cross-platform compatibility; those remain later gates. No M2 collector, persistence, owner workflow, dependency, public schema revision, package, release, deployment, or private-source access is introduced.

No M1 exit blocker remains. The proposed M1 `Complete`, M1-S07 `Complete`, M2 `Ready`, and M2-S01 `Ready` transitions become authoritative only after this audit revision passes required pull-request CI and integrates into protected `main`.

## Verification coverage recorded at 84921df

The following execution narrative was moved unchanged from Engineering Section 7 on September 9, 2026. It describes its original implementation scope; consult the current engineering policy and tests for new work.

M1-S02 makes FMU-E-001 through FMU-E-004 executable against the structured client-neutral Response Policy and preserved Claim output. M1-S03 makes FMU-E-006 executable against pure Demand/Profile intersection and proves unrelated expertise is absent from its intermediate task projection. M1-S04 makes FMU-E-012 and FMU-E-013 executable against the pure compiler, proving policy isolation/canary redaction and deterministic strict-budget reduction. M1-S06 exercises those three policy modes through the Codex fixed renderer and makes FMU-E-014 executable against unavailable Provider and adapter state, proving the hook neither blocks the host nor exposes context on failure. Model-authored prose and equivalent behavior in a materially different second consumer remain later gates.
