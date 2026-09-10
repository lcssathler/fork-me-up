# Fork Me Up — Risk-Driven Roadmap

> Status: active development; unreleased
> Version: 0.1  
> Last updated: September 10, 2026

This roadmap orders work by uncertainty and risk, not by feature count or calendar promises. A milestone begins only when its entry conditions are satisfied and ends only when its exit gate has executable evidence.

## 1. Strategy

The next objective is a usable local MVP: a developer configures sources, reviews a profile and receives better task explanations in a real client. Codex is the first live target; open contracts remain client-neutral and compatibility is limited to tested surfaces.

Prove that value before resuming release preparation. Selected public/private GitHub sources, bounded reuse, agent-assisted interpretation and cross-project transfer belong in this MVP. Remote deployment and additional integrations remain deferred. [ADR-0041](adr/0041-guided-evidence-backed-local-mvp.md) records this revision; product and security requirements remain in their responsible documents.

Navigation: [current queue](#15-current-m3-execution-queue) · [state rules](#queue-states) · [documentation map](README.md). Historical execution narratives are available on demand; milestone definitions and gates remain below.

## 2. Milestone summary

| Milestone | Outcome | Status |
|---|---|---|
| M0 | Normative and reproducible foundation | Complete |
| M1 | Client-neutral behavioral vertical slice | Complete |
| M2 | Trustworthy local evidence and profile | Complete |
| M3 | Usable Community MVP and verified public distribution | In progress |
| M4 | Remote deployment safeguards | Deferred |
| M5 | External-consumer validation | Deferred |
| M6 | Demand-led ecosystem and enterprise expansion | Deferred |

<a id="15-current-m3-execution-queue"></a>

## Current M3 execution queue

This is the routing source for active M3 work. The linked slice contracts retain the exact outcome, prerequisites and traceability. Completed implementation narratives are in [M3 history](history/M3_EXECUTION.md). Select work using the [state rules](#queue-states) and [AGENTS ownership rules](../AGENTS.md#milestone-request-routing). A milestone-only request authorizes at most one eligible slice.

No queue state authorizes publication, private-data access, model disclosure or another external effect. The documentation revision inserts new slices without renumbering completed work or the existing release slices. Proposed states become authoritative only after review and integration into main.

| Order | Slice and contract | State | Result |
|---:|---|---|---|
| 1 | [`M3-S01` — Community packaging and release boundary](history/M3_EXECUTION.md#delivered-slices) | `Complete` | Inspect private package candidates |
| 2 | [`M3-S02` — Public Protocol SDK and conformance distribution](history/M3_EXECUTION.md#delivered-slices) | `Complete` | Install the Protocol SDK and conformance artifact |
| 3 | [`M3-S03` — Independent generic conformance consumer](history/M3_EXECUTION.md#delivered-slices) | `Complete` | Compare two independent consumers |
| 4 | [`M3-S04` — Import/export and compatibility matrix](history/M3_EXECUTION.md#delivered-slices) | `Complete` | Verify artifact portability and recovery |
| 5 | [`M3-S05` — Cross-platform install, update, and uninstall](history/M3_EXECUTION.md#delivered-slices) | `Complete` | Verify installation, update and removal on three platforms |
| 6 | [`M3-S06` — Optional public-history decision and boundary](history/M3_EXECUTION.md#delivered-slices) | `Complete` | Enrich selected public history within local-first bounds |
| 7 | [`M3-S07` — Public Community benchmark](history/M3_EXECUTION.md#delivered-slices) | `Complete` | Reproduce bounded evidence, disclosure and two-consumer calibration |
| 8 | [`M3-S12` — Guided local Codex pilot](#m3-s12) | `Ready` | Configure and exercise real Store-backed context |
| 9 | [`M3-S13` — Selected GitHub source access](#m3-s13) | `Blocked by M3-S12` | Read authorized public/private sources locally |
| 10 | [`M3-S14` — Persistent catalog and selective reuse](#m3-s14) | `Blocked by M3-S13` | Find useful evidence within a visible work budget |
| 11 | [`M3-S15` — Agent interpretation and project transfer](#m3-s15) | `Blocked by M3-S14` | Ground explanations in reviewed prior experience |
| 12 | [`M3-S16` — Owner calibration and usable-MVP gate](#m3-s16) | `Blocked by M3-S15` | Validate actual explanations and total context cost |
| 13 | [`M3-S08` — Release documentation and compatibility table](#m3-s08) | `Blocked by M3-S16` | Provide tested installation and usage guidance |
| 14 | [`M3-S09` — Reproducible release-candidate supply chain](#m3-s09) | `Blocked by M3-S08` | Build and verify a protected release candidate |
| 15 | [`M3-S10` — Public Community release](#m3-s10) | `Blocked by M3-S09` | Publish the authorized Community release |
| 16 | [`M3-S11` — M3 exit audit](#m3-s11) | `Blocked by M3-S10` | Audit every M3 exit requirement |

<a id="12-m0-execution-record"></a>

## Queue states

States have precise meanings:

- `Complete`: the result and its verification evidence are integrated into `main`.
- `Ready`: prerequisites are integrated, ownership is clear, and one task may take the slice.
- `Owner decision required`: the project owner must make a material choice; the slice becomes eligible only when the current task contains that exact decision.
- `External authorization required`: prerequisites are integrated, but the action changes remote or external state; the slice becomes eligible only when the current task contains explicit authorization for that effect.
- `Blocked by ...`: named prerequisites are not yet integrated; later slices cannot start.

A slice branch may propose its completion and the accurate next state after required checks pass. The transition becomes authoritative only after lead review and integration into `main`. Branches and worktrees do not establish completion. Apply the eligibility, prerequisite, ownership, assignment and transition rules in [AGENTS.md](../AGENTS.md#milestone-request-routing) before acting.

## 3. M0 — Normative and reproducible foundation

### Objective

Remove ambiguity before implementation and create the smallest safe repository foundation.

### Deliverables

- Adopt the Fork Me Up name throughout normative documentation.
- Maintain one canonical product specification and one root `AGENTS.md`.
- Accept the public runtime, protocol and adapter boundary; preserve the original M0 decision record.
- Accept the client-neutral Core decision.
- Draft DCP, Evidence, Claim, Portable Profile Export, Demand Profile, and Provider contracts while keeping every Developer Profile Store schema implementation-internal rather than an interchange contract.
- Define protocol compatibility and initial conformance fixtures.
- Define the threat model, data classes, trust boundaries, and security invariants.
- Decide and record the public license and trademark policy before the first public code or package release.
- Initialize Git before implementation. For the owner-selected GitHub Free path, keep the remote private during private-safe M0 preparation, then protect `main` immediately after the separately authorized public cutover and before M0 exits.
- Pin the exact Node.js version used by development/CI, declare the supported runtime range, pin the exact package-manager/Corepack version, commit the lockfile, and define the clean-install command.
- Define workspace/package boundaries and dependency direction.
- Establish formatter, lint, strict type checking, test runner, schema validation, and CI skeleton.
- Define synthetic fixtures; no real developer data enters the repository.
- Add contribution, vulnerability-reporting, changelog, and versioning policies before accepting external contributions.

### Explicit non-goals

- No repository inference engine.
- No private repository access.
- No OAuth, Cloud, billing, UI, embeddings, or external-data connector.
- No claim of client compatibility.

### Exit gate

- Normative documents do not contradict one another.
- Public contracts have draft schemas plus valid and invalid fixtures.
- Threats have named controls and planned negative tests.
- Toolchain installs and baseline checks run from a clean checkout on the first declared platform.
- License and ownership implications are explicitly accepted by the project owner.
- Under the GitHub Free path, the repository passes its pre-publication audit before visibility changes, then `main` protection and the established required CI checks are read back as active before M0 exits. Between the public cutover and required-check enforcement, only the already full-diff-reviewed M0-S02 state-transition pull request may merge, and its checks must pass even though they are not yet server-required.
- The first M1 branch can be scoped to one observable outcome without an unresolved architecture decision.

## 4. M1 — Client-neutral behavioral vertical slice

### Objective

Prove that a small DCP changes the consuming agent's communication appropriately without putting client semantics in Core.

### Deliverables

- Versioned fixture Developer Profiles.
- Pure claim precedence and response-policy logic.
- Demand Profile input and bounded DCP compiler.
- `get_task_context` and `get_profile_metadata` over local MCP `stdio`.
- One reference adapter exercising session/task delivery.
- Behavioral evaluations for demonstrated, adjacent, and insufficient evidence.
- Compaction/restoration behavior only if the reference client supports it.
- Typed unavailable, invalid, incompatible, and budget-limited states.
- Canary redaction and repository-instruction isolation tests.

### Required evaluations

- `FMU-E-001` through `FMU-E-004`.
- `FMU-E-006`, `FMU-E-012`, `FMU-E-013`, and `FMU-E-014`.

### Exit gate

- The same task produces observably appropriate behavior for the three evidence states.
- Core compiles without client-specific types or lifecycle assumptions.
- No network is needed and offline mode opens no listener.
- DCP output is schema-valid, deterministic under injected time/IDs, and within budget.
- No canary, absolute path, or raw source appears in packet, log, or error output, or in diagnostics if they already exist.
- Reference-adapter failure does not block ordinary client work.

## 5. M2 — Trustworthy local evidence and profile

### Objective

Replace fixtures with bounded evidence from developer-selected local repositories while preserving humility and control.

### Deliverables

- Authorized-root and selected-repository configuration.
- Deterministic document, manifest, source-structure, and Git metadata collectors.
- Versioned local profile store with atomic writes and migrations.
- Developer identity configuration and attribution states.
- Fork, template, generated, vendor, tutorial, bot, coauthor, squash, and unknown-authorship handling.
- Multi-repository local support within explicit budgets.
- Evidence provenance, fingerprint, freshness, and invalidation.
- Developer inspection, correction, rejection, import, export, and deletion.
- Bounded `get_capability_evidence` for the owner.
- Secret-safe `doctor` command.
- Incremental cache with stale and partial states.

### Required evaluations

- `FMU-E-005`, `FMU-E-007` through `FMU-E-011`, and `FMU-E-015`.
- Path traversal, symlink/junction, command-injection, size/depth, binary, malicious-text, canary, and interrupted-write security cases.

### Exit gate

- No repository code or script is executed during collection.
- Only canonical authorized roots are read.
- Unknown authorship cannot produce high-confidence demonstrated depth on its own.
- Correction precedence, persistence, recovery, export, and deletion are verified.
- Unchanged inputs avoid a full rescan.
- Before measurement begins, an experiment brief freezes the sample, acceptable false-`demonstrated` and correction thresholds, and decision owner; results satisfy that brief for the limited taxonomy.
- The local workflow is useful without an account, dedicated LLM API, or proprietary service.

## 6. M3 — Usable Community MVP and public distribution

### Objective

Prove the local value loop with the owner in a real client, then publish a reproducible implementation with honest compatibility limits.

### Deliverables

- A second materially different consumer or generic conformance client.
- Public SDK, protocol packages, fixtures, and provider/consumer conformance suite.
- Tested import/export and compatibility policy.
- Guided setup, profile review and correction in the first live client.
- Selected public/private GitHub access with explicit authorization and no hosted dependency.
- Persistent bounded catalog/reuse and evidence-backed agent interpretation across projects.
- Reproducible installation and uninstall on the declared platform matrix.
- README quickstart, contributing guide, security policy, changelog, semantic versioning, and migration guidance.
- Protected CI, package dry-run, SBOM, license report, checksums, and provenance/signing where supported.
- Published compatibility table stating tested transports, auth, lifecycle, and limitations.
- Public benchmark for repeated calibration, token cost, false claims, and behavior-policy adherence.

### Required evaluations

- `FMU-E-016`, `FMU-E-019` through `FMU-E-024`, plus all Community-relevant prior evaluations.
- Clean-checkout, install, update, export, delete, uninstall, artifact-content, and platform tests.

### Exit gate

- Two consumers preserve the same claim meaning and required behavior without a Core fork.
- Community users can complete the local value loop from public documentation.
- The public runtime remains useful without a hosted service.
- The owner-reviewed live experiment passes its frozen usefulness, progressive-guidance and total-cost criteria; synthetic conformance is not a substitute.
- Guided setup, selected private-source denial cases, persistent-cache deletion and cross-project correction/transfer have executable evidence.
- Security disclosure, upgrade, migration, and data-removal paths are documented and tested.
- The release is built from a protected, clean revision and artifacts match documented checks.

### Remaining M3 slice contracts

These contracts define the remaining work; the current queue above is the only state list.

<a id="m3-s07"></a>

M3-S07's completed benchmark contract and bounded result remain in [M3 history](history/M3_EXECUTION.md). It is not a live usefulness study.

<a id="m3-s12"></a>

### M3-S12 — Guided local Codex pilot

**Outcome:** A discoverable local skill guides identity/source selection, owner refresh, profile review and explicit declarations/corrections, then a configured Codex client calls the real Store-backed MCP. Verify restart and correction reuse without fixture substitution. Keep the existing deterministic profile and local source limits visible; this first pilot does not claim general interpretation.

**Boundary:** Accept the focused owner-orchestration/disclosure contract before enabling writes or interpretation views. Keep read-only consumer MCP separate from owner operations. Use no new model API. An owner-run live smoke requires explicit source/client scope; without it, implementation may be prepared with synthetic tests but the slice stays incomplete.

**Prerequisites and checks:** Integrated M3-S07 and this planning revision; ADR-0041 and affected adapter/owner ADRs; FMU-FR-031/036, UC-17, FMU-E-019 plus correction, redaction and ordinary-work-continuation regressions. The outcome is the earliest guided product test.

<a id="m3-s13"></a>

### M3-S13 — Selected GitHub source access

**Outcome:** Owner-authorized metadata discovery and bounded content/history reads for selected public/private repositories, with explicit identity, local processing and optional authentication. Keep the existing offline path usable.

**Boundary:** Accept a source-specific ADR, authentication/credential ownership, exact selection and security review before implementation. Apply Security's private-source gate before live private data. GitHub account permissions do not supply collection or model-disclosure consent. The current public-history connector is not widened implicitly.

**Prerequisites and checks:** M3-S12; FMU-FR-032, FMU-E-020; T-01/T-03/T-04/T-08. Synthetic tests cover excluded/private repositories, expired or revoked authority, malicious source data, fixed request budgets, missing authentication and content-free failures. Live data access remains separately authorized.

<a id="m3-s14"></a>

### M3-S14 — Persistent catalog and selective reuse

**Outcome:** Consult the profile first, use a private metadata catalog to choose relevant and adjacent candidates, and reuse verified results across sessions. Expose counts, cost and incomplete coverage. An account with more repositories than a collection batch remains bounded; do not increase collector ceilings merely to scan everything.

**Boundary:** Define cache schema, inventory, expiry, invalidation, canonical storage, atomic recovery, revocation, export and deletion before persistent writes. Bind hits to current authority, identity, source state and algorithm version. Recheck local uncommitted changes; never renew observation age from a cache hit or discard risk evidence to inflate support. Concept-aware refinement may follow in M3-S15.

**Prerequisites and checks:** M3-S13; FMU-FR-033, FMU-E-021; focused persistence ADR refining ADR-0026/0028; restart, changed-source, revoked-grant, poisoned-cache, interrupted-write and deletion regressions. Three to five deep candidates is an experiment hypothesis, not a required fixed limit.

<a id="m3-s15"></a>

### M3-S15 — Agent interpretation and project transfer

**Outcome:** The existing agent interprets bounded authorized evidence into provisional assessments, task needs and cross-project analogies. Present an initial overview for owner review; persist explicit declarations and corrections through the owner flow. Guide unfamiliar concepts briefly without blocking useful technologies or inferring ignorance from a question.

**Boundary:** Accept typed owner-only interpretation-view/proposal and transfer contracts, including bounded redacted excerpts when needed, with deterministic admission, provenance, disclosure and versioning rules before code changes. Preserve original project scope and conservative evidence ceilings. No exhaustive technology catalog, raw-source DCP, separate model API or arbitrary provider write tool. Update every affected schema, producer, consumer, migration and conformance fixture if wire behavior changes.

**Prerequisites and checks:** M3-S14; FMU-FR-034/035/036, UC-16/17, FMU-E-022 and synthetic FMU-E-023 coverage; ADR-0041 plus explicit refinements to affected derivation/intersection/owner ADRs. Reject invented evidence, policy-bearing prose, unsupported global promotion and correction loss; verify novel identifiers and relations without treating model text as authority.

<a id="m3-s16"></a>

### M3-S16 — Owner calibration and usable-MVP gate

**Outcome:** Run the [live calibration contract](evaluations/MVP_CALIBRATION.md) with the owner: unfamiliar-project explanation, cross-project analogy and progressive concept introduction. Compare no profile, a manual summary and Fork Me Up while counting setup and interpretation overhead. Keep failed attempts and version prompt changes.

**Prerequisites and checks:** M3-S15; FMU-FR-037, H-01/H-05/H-10, FMU-E-019 through FMU-E-024. After M3-S15, transition to `Owner decision required` until the brief's cases, thresholds, retention and exact source/client disclosure scope are accepted. Owner feedback refines prompts; it does not replace synthetic negative tests or establish population accuracy. A failed criterion blocks release preparation and routes a bounded fix to the responsible slice.

<a id="m3-s08"></a>

### M3-S08 — Release documentation and compatibility table

**Required outcome:** Public quickstart, contribution/security/versioning/changelog/migration/removal guidance and one tested compatibility table let a new user complete the local loop while stating exact transport, auth, lifecycle, platform and consumer limits.

**Prerequisites and traceability:** M3-S16; `FMU-FR-013` through `FMU-FR-016`, `FMU-FR-022` through `FMU-FR-025`; `FMU-NFR-009`, `FMU-NFR-010`, `FMU-NFR-016`, `FMU-NFR-020`; M3 documentation and local-utility exit gates.

<a id="m3-s09"></a>

### M3-S09 — Reproducible release-candidate supply chain

**Required outcome:** Protected CI builds a clean local release candidate, reruns every Community-relevant check, installs/uninstalls exact artifacts, rejects unexpected contents, and produces reviewed license/SBOM reports, checksums and provenance/signing evidence where supported plus rollback/withdrawal instructions.

**Prerequisites and traceability:** M3-S08; `FMU-NFR-017`, `FMU-NFR-018`; T-11; Engineering release gate; M3 protected-CI and artifact deliverables.

<a id="m3-s10"></a>

### M3-S10 — Public Community release

**Required outcome:** With explicit owner authorization, the exact protected release candidate is published through the selected channels and its immutable source, artifacts, checksums, SBOM, provenance, documentation and compatibility record are read back and matched.

**Prerequisites and traceability:** M3-S09; M3 objective and release-built-from-protected-revision gate; Section 11 publication decision. Transition to `External authorization required` after M3-S09.

<a id="m3-s11"></a>

### M3-S11 — M3 exit audit

**Required outcome:** An integrated audit verifies every M3 deliverable, required evaluation, platform/install/update/export/delete/uninstall test, artifact/release record and cross-milestone gate, then either closes M3 or names a blocker.

**Prerequisites and traceability:** M3-S01 through M3-S10 and M3-S12 through M3-S16; full M3 exit gate, `FMU-E-016`, all Community-relevant prior evaluations, and cross-milestone quality gates.

## 7. M4 — Deferred remote deployment safeguards

No current queue. Remote operation requires a separate product need, accepted architecture/data inventory, least-privilege source credentials, tenant isolation, retention/deletion/recovery and the complete [private-source security gate](SECURITY_PRIVACY.md#before-any-private-repository-reaches-cloud). Local GitHub access is part of M3 and does not depend on this milestone.

## 8. M5 — Deferred external-consumer validation

No current queue. A future remote consumer requires a demonstrated workflow, independent Source/Sharing Grants, authenticated minimized MCP delivery, observable revocation, abuse limits, FMU-E-017/018 and the complete [remote-access gate](SECURITY_PRIVACY.md#before-remote-consumer-access). No partner-specific integration or availability promise is made.

## 9. M6 — Demand-led expansion

Additional clients, providers, personal-data sources and deployment modes require validated demand, an accepted ADR and relevant security/compatibility evidence. Broad document or conversation ingestion remains outside the local MVP. No current queue.

## 10. Cross-milestone quality gates

No milestone may advance while any of the following is true:

- a public contract has no schema and compatibility test;
- a security claim has no executable negative test;
- real personal or private repository data appears in fixtures;
- a high-confidence claim can be created without attributable evidence or explicit declaration;
- optional failure weakens authorization, isolation, validation, or redaction;
- local setup cannot be reproduced from a clean checkout;
- the change requires a broad branch mixing unrelated behavior;
- documentation and executable behavior disagree;
- a confirmed critical or high-severity finding remains unresolved and unmitigated;
- compatibility is claimed for an untested client, transport, auth flow, or platform.

## 11. Decision checkpoints

The project owner explicitly decides before:

- selecting and publishing a license;
- changing repository visibility or exposing previously private Git history;
- accessing any private repository;
- running a public hosted beta;
- charging users;
- onboarding an external consumer with personal data;
- adding any new personal-data source;
- publishing packages, releases, deployments, or marketplace entries.

## Execution evidence

Completed milestone records preserve their original outcomes and evidence. They do not route new work or grant new authority.

- [M0 execution](history/M0_EXECUTION.md) and [exit audit](audits/M0_EXIT_AUDIT.md).

<a id="13-m1-execution-record"></a>

- [M1 execution](history/M1_EXECUTION.md) and [exit audit](audits/M1_EXIT_AUDIT.md).

<a id="14-m2-execution-record"></a>

- [M2 execution](history/M2_EXECUTION.md) and [exit audit](audits/M2_EXIT_AUDIT.md).
- [M3 delivered slices](history/M3_EXECUTION.md); M3 closure still requires its complete exit gate.
