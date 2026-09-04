# Fork Me Up — Risk-Driven Roadmap

> Status: pre-implementation  
> Version: 0.1  
> Last updated: September 4, 2026

This roadmap orders work by uncertainty and risk, not by feature count or calendar promises. A milestone begins only when its entry conditions are satisfied and ends only when its exit gate has executable evidence.

## 1. Strategy

Fork Me Up proves three products in sequence:

1. **Technical MVP:** task-scoped context changes AI behavior correctly.
2. **Community MVP:** a useful local, portable, open implementation works without proprietary infrastructure.
3. **Commercial MLP:** managed repository analysis and authenticated remote delivery solve enough recurring pain that users pay for them.

Cloud work must not outrun protocol, evidence quality, local trust, or willingness-to-pay validation. A named external product is never a roadmap dependency; integrations are validated through generic contracts and tested client capabilities.

## 2. Milestone summary

| Milestone | Outcome | Status |
|---|---|---|
| M0 | Normative and reproducible foundation | In progress |
| M1 | Client-neutral behavioral vertical slice | Not started |
| M2 | Trustworthy local evidence and profile | Not started |
| M3 | Portable Community release | Not started |
| M4 | Pro alpha with managed selected repositories | Not started |
| M5 | Commercial MLP with governed remote MCP | Not started |
| M6 | Demand-led ecosystem and enterprise expansion | Deferred |

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
- Initialize Git before implementation and protect `main` when a remote exists.
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
- accessing any private repository;
- running a public Cloud beta;
- charging users;
- onboarding an external consumer with personal data;
- adding any new personal-data source;
- publishing packages, releases, deployments, or marketplace entries.

## 12. Current M0 execution queue

This ordered queue is the routing source for a request such as "complete M0". It sequences delivery but does not redefine product behavior. An unassigned task takes only the earliest incomplete slice that is eligible under the state rules below; it does not execute the entire milestone or skip an earlier decision or blocker.

States have precise meanings:

- `Complete`: the result and its verification evidence are integrated into `main`.
- `Ready`: prerequisites are integrated, ownership is clear, and one task may take the slice.
- `Owner decision required`: the project owner must make a material choice; the slice becomes eligible only when the current task contains that exact decision.
- `External authorization required`: prerequisites are integrated, but the action changes remote or external state; the slice becomes eligible only when the current task contains explicit authorization for that effect.
- `Blocked by ...`: named prerequisites are not yet integrated; later slices cannot start.

A slice branch may propose `Complete` for itself and update the next dependent slice to its accurate state in the same diff after its required checks pass. The transitions become authoritative only after lead review and integration into `main`; an isolated worktree or branch is not completion evidence. A single unassigned task records the selected earliest eligible slice in its task contract and establishes its claim with a slice-specific branch after verifying that no active claim exists. Parallel ownership requires an explicit lead assignment plus the assigned branch, worktree, or pull request. Only active, unintegrated claims block another task. Never run multiple unassigned milestone-only requests concurrently.

| Order | Slice | State | Observable outcome | Prerequisites and traceability |
|---:|---|---|---|---|
| 1 | `M0-S01` — Documentation and Git baseline | `Complete` | The initial documentation set, accepted ADR baseline, root agent guidance, Git repository, and baseline commit exist on `main`. | M0 documentation/Git deliverables; ADR-0001 through ADR-0003. |
| 2 | `M0-S02` — Basic remote branch protection | `External authorization required` | With explicit external authorization, remote settings are verified and `main` requires reviewed pull requests and prevents force pushes or deletion. A platform limitation is recorded; without a formally accepted equivalent control, the slice remains incomplete and later work stays blocked. | M0 Git deliverable; external-effect rules in `AGENTS.md` and `ENGINEERING.md`. |
| 3 | `M0-S03` — License and trademark decision | `Blocked by M0-S02` | The owner completes the required legal/trademark review, explicitly accepts the public-code license and trademark policy and their Community/Cloud implications, and adds the corresponding license and policy files before any public code or package release. | M0 license deliverable and exit gate; Section 11; ADR-0001 or an accepted successor. A pending review cannot complete this slice. After M0-S02 integrates, change state to `Owner decision required`. |
| 4 | `M0-S04` — Toolchain/workspace decision and package foundation | `Blocked by M0-S03` | An accepted M0 tooling/workspace ADR pins Node.js and package-manager/Corepack versions, declares the supported runtime range and dependency direction, and establishes a minimal workspace, committed lockfile, and documented clean-install path. | `FMU-NFR-017`; M0 toolchain/workspace deliverables; `ARCHITECTURE.md` Section 10. |
| 5 | `M0-S05` — Baseline checks and CI skeleton | `Blocked by M0-S04` | Formatter, lint, strict type checking, test, and aggregate check commands run deterministically through a least-privilege CI skeleton from a clean checkout on the first declared platform. | `FMU-NFR-011`, `FMU-NFR-017`; M0 checks and clean-checkout gate. |
| 6 | `M0-S06` — Required CI checks on `main` | `Blocked by M0-S05` | With explicit external authorization, the established CI checks are required for reviewed changes to `main`, and the remote configuration is verified. | M0 Git/checks deliverables; external-effect rules in `AGENTS.md` and `ENGINEERING.md`. After M0-S05 integrates, change state to `External authorization required`. |
| 7 | `M0-S07` — Repository governance policies | `Blocked by M0-S06` | Contribution, vulnerability-reporting, changelog, and versioning policies reference the actual verification path and are in place before external contributions are accepted. | M0 governance deliverable and gate; no behavioral evaluation applies. |
| 8 | `M0-S08` — First DCP schema slice | `Blocked by M0-S07` | One versioned draft DCP schema, valid and invalid synthetic fixtures, and its executable schema-validation command run locally and in CI, without M1 behavior. | `FMU-FR-009`, `FMU-NFR-009`, `FMU-NFR-011`; protocol compatibility rules. |
| 9 | `M0-S09` — Evidence and Claim contracts | `Blocked by M0-S08` | Versioned Evidence and Claim schemas preserve provenance and distinguish observation, inference, declaration, dispute, and insufficient evidence, with valid and invalid synthetic fixtures. | `FMU-FR-004` through `FMU-FR-006`, `FMU-FR-009`, `FMU-NFR-006`, `FMU-NFR-009`, `FMU-NFR-011`. |
| 10 | `M0-S10` — Profile-store and export boundary | `Blocked by M0-S09` | The reference provider's implementation-internal Developer Profile Store schema and the public Portable Profile Export contract are explicitly distinct from each other and from every DCP, with boundary-appropriate valid and invalid synthetic fixtures. | `FMU-FR-004`, `FMU-FR-008`, `FMU-FR-009`, `FMU-NFR-009`, `FMU-NFR-011`; contract preparation for `FMU-FR-015`. |
| 11 | `M0-S11` — Demand Profile contract | `Blocked by M0-S10` | A versioned Demand Profile schema represents project/task demand and has valid and invalid synthetic fixtures. | `FMU-FR-003`, `FMU-FR-009`, `FMU-NFR-009`, `FMU-NFR-011`. |
| 12 | `M0-S12` — Provider and conformance contracts | `Blocked by M0-S11` | Client-neutral Provider contracts, compatibility rules, and public provider/consumer conformance fixtures and tests are draft-complete. | `FMU-FR-010`, `FMU-FR-023`, `FMU-NFR-001`, `FMU-NFR-009`, `FMU-NFR-011`. |
| 13 | `M0-S13` — M0 exit audit | `Blocked by M0-S02 through M0-S12` | An integrated audit demonstrates every M0 exit criterion or names a remaining blocker; only then may an ordered M1 queue be added and become routable. | Full M0 exit gate and applicable requirements, evaluations, ADRs, and security checks. |

The immediate next action is `M0-S02`, which requires explicit authorization to inspect and configure the remote protection for `main`. No implementation slice is currently `Ready`. The license/trademark decision remains the next owner checkpoint before any public code or package release. Any behavioral spike before the M0 exit gate is disposable and cannot enter product code.


