# Fork Me Up — Risk-Driven Roadmap

> Status: active development; unreleased
> Version: 0.1  
> Last updated: September 9, 2026

This roadmap orders work by uncertainty and risk, not by feature count or calendar promises. A milestone begins only when its entry conditions are satisfied and ends only when its exit gate has executable evidence.

## 1. Strategy

Fork Me Up proves three products in sequence:

1. **Technical MVP:** task-scoped context changes AI behavior correctly.
2. **Community MVP:** a useful local, portable, open implementation works without proprietary infrastructure.
3. **Commercial MLP:** managed repository analysis and authenticated remote delivery solve enough recurring pain that users pay for them.

Cloud work must not outrun protocol, evidence quality, local trust, or willingness-to-pay validation. A named external product is never a roadmap dependency; integrations are validated through generic contracts and tested client capabilities.

Navigation: [current queue](#15-current-m3-execution-queue) · [state rules](#queue-states) · [documentation map](README.md). Historical execution narratives are available on demand; milestone definitions and gates remain below.

## 2. Milestone summary

| Milestone | Outcome | Status |
|---|---|---|
| M0 | Normative and reproducible foundation | Complete |
| M1 | Client-neutral behavioral vertical slice | Complete |
| M2 | Trustworthy local evidence and profile | Complete |
| M3 | Portable Community release | Ready |
| M4 | Pro alpha with managed selected repositories | Not started |
| M5 | Commercial MLP with governed remote MCP | Not started |
| M6 | Demand-led ecosystem and enterprise expansion | Deferred |

<a id="15-current-m3-execution-queue"></a>

## Current M3 execution queue

This is the routing source for active M3 work. The linked slice contracts retain the exact outcome, prerequisites and traceability. Completed implementation narratives are in [M3 history](history/M3_EXECUTION.md). Select work using the [state rules](#queue-states) and [AGENTS ownership rules](../AGENTS.md#milestone-request-routing). A milestone-only request authorizes at most one eligible slice.

No queue state authorizes publication, network sources, private-data access or another external effect. M3 begins with local unpublished artifacts.

| Order | Slice and contract | State | Result |
|---:|---|---|---|
| 1 | [`M3-S01` — Community packaging and release boundary](history/M3_EXECUTION.md#delivered-slices) | `Complete` | Inspect private package candidates |
| 2 | [`M3-S02` — Public Protocol SDK and conformance distribution](history/M3_EXECUTION.md#delivered-slices) | `Complete` | Install the Protocol SDK and conformance artifact |
| 3 | [`M3-S03` — Independent generic conformance consumer](history/M3_EXECUTION.md#delivered-slices) | `Complete` | Compare two independent consumers |
| 4 | [`M3-S04` — Import/export and compatibility matrix](history/M3_EXECUTION.md#delivered-slices) | `Complete` | Verify artifact portability and recovery |
| 5 | [`M3-S05` — Cross-platform install, update, and uninstall](history/M3_EXECUTION.md#delivered-slices) | `Complete` | Verify installation, update and removal on three platforms |
| 6 | [`M3-S06` — Optional public-history decision and boundary](history/M3_EXECUTION.md#delivered-slices) | `Complete` | Enrich selected public history within local-first bounds |
| 7 | [`M3-S07` — Public Community benchmark](history/M3_EXECUTION.md#delivered-slices) | `Complete` | Reproduce bounded evidence, disclosure and two-consumer calibration |
| 8 | [`M3-S08` — Release documentation and compatibility table](#m3-s08) | `Ready` | Provide release usage and compatibility guidance |
| 9 | [`M3-S09` — Reproducible release-candidate supply chain](#m3-s09) | `Blocked by M3-S08` | Build and verify a protected release candidate |
| 10 | [`M3-S10` — Public Community release](#m3-s10) | `Blocked by M3-S09` | Publish the authorized Community release |
| 11 | [`M3-S11` — M3 exit audit](#m3-s11) | `Blocked by M3-S10` | Audit every M3 exit requirement |

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
- Accept the Community/Cloud/Connect boundary.
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

## 6. M3 — Portable Community release

### Objective

Prove interoperability and publish a trustworthy open implementation.

### Deliverables

- A second materially different consumer or generic conformance client.
- Public SDK, protocol packages, fixtures, and provider/consumer conformance suite.
- Tested import/export and compatibility policy.
- Bounded optional access to selected public repository history where useful.
- Reproducible installation and uninstall on the declared platform matrix.
- README quickstart, contributing guide, security policy, changelog, semantic versioning, and migration guidance.
- Protected CI, package dry-run, SBOM, license report, checksums, and provenance/signing where supported.
- Published compatibility table stating tested transports, auth, lifecycle, and limitations.
- Public benchmark for repeated calibration, token cost, false claims, and behavior-policy adherence.

### Required evaluations

- `FMU-E-016` plus all Community-relevant prior evaluations.
- Clean-checkout, install, update, export, delete, uninstall, artifact-content, and platform tests.

### Exit gate

- Two consumers preserve the same claim meaning and required behavior without a Core fork.
- Community users can complete the local value loop from public documentation.
- The public runtime remains useful without Cloud.
- Security disclosure, upgrade, migration, and data-removal paths are documented and tested.
- The release is built from a protected, clean revision and artifacts match documented checks.

### Remaining M3 slice contracts

These contracts define the remaining work; the current queue above is the only state list.

<a id="m3-s07"></a>

### M3-S07 — Public Community benchmark

**Required outcome:** A reproducible public benchmark reports repeated calibration, token/disclosure cost, false-Claim outcomes, attribution limits and behavior-policy adherence across both consumers without turning synthetic conformance into human-accuracy or ranking claims.

**Prerequisites and traceability:** Resolved M3-S06 decision; hypotheses H-02 through H-04 and H-06; `FMU-E-001` through `FMU-E-016` where Community-relevant; M3 benchmark deliverable.

<a id="m3-s08"></a>

### M3-S08 — Release documentation and compatibility table

**Required outcome:** Public quickstart, contribution/security/versioning/changelog/migration/removal guidance and one tested compatibility table let a new user complete the local loop while stating exact transport, auth, lifecycle, platform and consumer limits.

**Prerequisites and traceability:** M3-S07; `FMU-FR-013` through `FMU-FR-016`, `FMU-FR-022` through `FMU-FR-025`; `FMU-NFR-009`, `FMU-NFR-010`, `FMU-NFR-016`, `FMU-NFR-020`; M3 documentation and local-utility exit gates.

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

**Prerequisites and traceability:** M3-S01 through M3-S10; full M3 exit gate, `FMU-E-016`, all Community-relevant prior evaluations, and cross-milestone quality gates.

## 7. M4 — Pro alpha: managed profile compilation

### Entry conditions

- Community evidence quality is measured.
- Interviews, prototypes, or commitments show willingness to pay for managed depth and freshness.
- A Cloud data inventory, architecture ADR, and updated threat model are accepted.
- Legal/privacy terms for private repository processing are reviewed.
- Before any real private data, an independent or documented second-responsible security review covers the GitHub App, webhooks, token/key management, tenant isolation, negative authorization, backup deletion, recovery, and incident response.
- An experiment brief freezes what counts as material improvement and sufficient user trust before alpha measurement begins.

### Objective

Validate the paid profile compiler without building a broad partner platform.

### Deliverables

- Account and owner authentication.
- GitHub App with selected-repository, read-only, least-privilege access.
- Secure credential and key-management design.
- Isolated bounded ingestion workers.
- Tenant-bound evidence, claims, and profile versions.
- Improved attribution and cross-repository evidence fusion.
- Incremental refresh and freshness reporting.
- Minimal owner review/correction experience.
- Export, source disconnect, profile deletion, retention, and backup behavior.
- Content-free audit and operational observability.
- Cost, quota, and abuse limits.

### Explicit non-goals

- No Google Workspace or broad personal-data connector.
- No remote third-party consumer access yet unless required for a closed alpha and separately gated.
- No employer dashboard, team ranking, enterprise SSO, marketplace, or white labeling.

### Exit gate

- Repository selection and least privilege are enforced end to end.
- Tenant isolation, authorization-negative, token, retention, deletion, and recovery tests pass.
- Private source content and tokens are absent from logs and ordinary profile output.
- Managed analysis meets the predeclared material-improvement threshold for freshness, false-claim rate, attribution, or convenience over Community.
- Alpha users understand, review, and trust the claims enough to continue.
- The private-data review has no confirmed, unresolved, unmitigated critical or high-severity finding.

## 8. M5 — Commercial MLP: governed remote delivery

### Entry conditions

- Pro compilation has validated value.
- At least one real consumer workflow needs remote context.
- Remote MCP authorization and consent designs pass security review.
- Before measurement begins, an experiment brief freezes the minimum paid-user sample, retention window, acceptable unit-cost boundary, and decision owner.

### Objective

Let a paying developer securely reuse a managed profile from compatible tools.

### Deliverables

- Stable HTTPS MCP Streamable HTTP endpoint.
- OAuth 2.1-compatible flow with PKCE, protected-resource discovery, audience/resource binding, token validation, and revocation.
- Registered consumers or a standards-compliant discovery path.
- Independent Source and Sharing Grants.
- Default `context:task:read` scope and step-up scope handling.
- Purpose-, audience-, expiry-, and budget-bound DCP compilation.
- No raw-evidence remote scope.
- Developer grant, audit, and revocation views.
- Rate limits, quotas, billing, support, and incident response.
- Generic integration examples and a local bridge only where client capability requires it.

### Required evaluations

- `FMU-E-017` and `FMU-E-018` plus full Cloud authorization and isolation tests.
- Invalid token, wrong audience, insufficient scope, revoked/expired grant, enumeration, replay, and confused-deputy cases.

### Exit gate

- A real external workflow consumes a minimized DCP without receiving upstream tokens, raw repositories, or broader profile data.
- Revocation takes effect observably within the documented boundary.
- The same remote contract works without a partner-specific Core fork.
- The paid-user sample meets the predeclared value-loop, retention, and unit-cost thresholds.
- A security review appropriate to public exposure has no confirmed, unresolved, unmitigated critical or high-severity findings.

## 9. M6 — Demand-led expansion

Only validated demand may promote these items:

- additional Git providers;
- partner sandbox, SDK support, webhooks, and service levels;
- enterprise SSO, audit, data residency, VPC, or self-hosting;
- more capability taxonomies and community rules;
- source-available or commercial self-hosted inference engine;
- additional personal-data sources.

Google Workspace, email, calendar, and broad personal-document connectors remain explicitly deferred. Each new source requires a separate hypothesis, ADR, consent model, retention policy, provider compliance review, adversarial fixtures, and security gate.

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
- running a public Cloud beta;
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
