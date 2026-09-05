# Fork Me Up — Risk-Driven Roadmap

> Status: pre-implementation  
> Version: 0.1  
> Last updated: September 5, 2026

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
| 2 | `M0-S03` — License and trademark decision | `Complete` | The owner completes the required legal/trademark review, explicitly accepts the public-code license and trademark policy and their Community/Cloud implications, and adds the corresponding license and policy files before any public code or package release. | M0 license deliverable and exit gate; Section 11; ADR-0001 and ADR-0004. The GitHub Free/private-preparation decision removes the former M0-S02 dependency. |
| 3 | `M0-S04` — Toolchain/workspace decision and package foundation | `Complete` | An accepted M0 tooling/workspace ADR pins Node.js and package-manager/Corepack versions, declares the supported runtime range and dependency direction, and establishes a minimal workspace, committed lockfile, and documented clean-install path. | `FMU-NFR-017`; M0 toolchain/workspace deliverables; `ARCHITECTURE.md` Section 10. |
| 4 | `M0-S05` — Baseline checks and CI skeleton | `Complete` | Formatter, lint, strict type checking, test, and aggregate check commands run deterministically through a least-privilege CI skeleton from a clean checkout on the first declared platform. | `FMU-NFR-011`, `FMU-NFR-017`; M0 checks and clean-checkout gate; ADR-0006. |
| 5 | `M0-S07` — Repository governance policies | `Complete` | Contribution, vulnerability-reporting, changelog, and versioning policies reference the actual verification path and are in place before external contributions are accepted. | M0 governance deliverable and gate; no behavioral evaluation applies. |
| 6 | `M0-S08` — First DCP schema slice | `Complete` | One versioned draft DCP schema, valid and invalid synthetic fixtures, and its executable schema-validation command run locally and in CI, without M1 behavior. | `FMU-FR-009`, `FMU-NFR-009`, `FMU-NFR-011`; protocol compatibility rules. |
| 7 | `M0-S09` — Evidence and Claim contracts | `Complete` | Versioned Evidence and Claim schemas preserve provenance and distinguish observation, inference, declaration, dispute, and insufficient evidence, with valid and invalid synthetic fixtures. | `FMU-FR-004` through `FMU-FR-006`, `FMU-FR-009`, `FMU-NFR-006`, `FMU-NFR-009`, `FMU-NFR-011`. |
| 8 | `M0-S10` — Profile-store and export boundary | `Complete` | The reference provider's implementation-internal Developer Profile Store schema and the public Portable Profile Export contract are explicitly distinct from each other and from every DCP, with boundary-appropriate valid and invalid synthetic fixtures. | `FMU-FR-004`, `FMU-FR-008`, `FMU-FR-009`, `FMU-NFR-009`, `FMU-NFR-011`; contract preparation for `FMU-FR-015`. |
| 9 | `M0-S11` — Demand Profile contract | `Complete` | A versioned Demand Profile schema represents project/task demand and has valid and invalid synthetic fixtures. | `FMU-FR-003`, `FMU-FR-009`, `FMU-NFR-009`, `FMU-NFR-011`. |
| 10 | `M0-S12` — Provider and conformance contracts | `Complete` | Client-neutral Provider contracts, compatibility rules, and public provider/consumer conformance fixtures and tests are draft-complete. | `FMU-FR-010`, `FMU-FR-023`, `FMU-NFR-001`, `FMU-NFR-009`, `FMU-NFR-011`. |
| 11 | `M0-S02` — GitHub Free public cutover and basic branch protection | `Complete` | After the pre-publication gate and explicit authorization, the repository becomes public and an active branch ruleset targets exactly `refs/heads/main`, has no bypass actors, requires a pull request before merge, restricts deletion, and blocks non-fast-forward updates. Visibility, target, bypass list, and every required rule are read back before work continues. | M0 Git deliverable; Section 11; external-effect rules in `AGENTS.md` and `ENGINEERING.md`. The remote controls and reviewed state transition are integrated at `de79bac`. |
| 12 | `M0-S06` — Required CI checks on `main` | `Complete` | With explicit external authorization, the real CI checks established by M0-S05 and extended by later contract slices are required for changes to `main`, and the remote configuration is read back. Other than the already full-diff-reviewed M0-S02 state-transition pull request, whose real checks must pass voluntarily, no change merges after the public cutover before M0-S06. | M0 Git/checks deliverables; `FMU-NFR-011`, `FMU-NFR-017`; ADR-0006; external-effect rules in `AGENTS.md` and `ENGINEERING.md`. The remote control is active; this state becomes authoritative after the reviewed state-transition change integrates. |
| 13 | `M0-S13` — M0 exit audit | `Ready` | An integrated audit demonstrates every M0 exit criterion or names a remaining blocker; only then may M0 become complete and an ordered M1 queue be added and become routable. | Full M0 exit gate and applicable requirements, evaluations, ADRs, and security checks. This state becomes authoritative only after M0-S06 integrates. |

### M0-S03 license and trademark decision

On September 4, 2026, the owner explicitly selected the unmodified Apache License 2.0 for public repository content, confirmed authority to license the current work, and accepted its commercial reuse, modification, redistribution, patent, notice, attribution, and Community/Cloud implications. The root `LICENSE` and `NOTICE`, [trademark policy](../TRADEMARKS.md), and [ADR-0004](adr/0004-apache-license-and-trademark-policy.md) record that decision. Apache-2.0 Section 5 separately governs how later Contributions are licensed; the project requires no copyright assignment by default.

The owner also accepted the separate trademark policy and authorized continued use of the Fork Me Up name with the residual risk identified by a preliminary review. That review found no exact name result in the consulted USPTO index or exact package identifiers in the consulted npm and PyPI registries, but did not verify INPI or WIPO and is not a representation of availability, registration, or freedom from third-party rights. The policy preserves truthful, non-confusing references and Apache-2.0 rights while requiring separate branding for modified distributions and permission for uses that imply an official relationship.

No `FMU-E-*` evaluation applies because this slice establishes licensing and governance rather than product behavior. Verification consists of exact license-text comparison, documentation consistency and link checks, absence of stale candidate or unlicensed language, and complete-diff review. This decision does not authorize repository publication, package publication, release, or any Cloud/Pro implementation.

### M0-S02 GitHub Free decision and platform verification

Authorized read-only verification on September 4, 2026 established the following:

- `lcssathler/fork-me-up` is a private repository, its default branch is `main`, and the authenticated repository permission is `ADMIN`;
- the GitHub branch API reports `main` as `protected: false`;
- classic branch-protection, repository-ruleset, and effective-branch-rule endpoints each return HTTP `403`, requiring GitHub Pro or public repository visibility;
- the available merge-hygiene settings already allow only squash merges and automatically delete merged head branches, but they do not protect `main` from direct, forced, or deletion operations;
- the owner selected GitHub Free, rejected a paid GitHub plan, and chose to keep the repository private during private-safe M0 preparation;
- no remote mutation was attempted after the platform limitation was detected; rollback is not applicable;
- no local hook, workflow, bot, or procedural convention is treated as equivalent server-side protection, and no such substitute will be pursued.

The former queue created a deadlock by making the license/trademark decision depend on protection that GitHub Free exposes only after public visibility, while public visibility itself requires the license/trademark decision. The ordered queue now completes all private-safe prerequisites first, then uses M0-S02 for the separately authorized public cutover and immediate basic protection. The owner's plan decision does not authorize that future visibility change. Making the repository public in M0-S02 is a visibility transition, not a GitHub Release or the M3 Community release.

After every prerequisite named in the queue is integrated, M0-S02 changes to `External authorization required`. Within an explicitly authorized M0-S02, the following gate must pass before any visibility change; failure keeps the repository private and stops the cutover:

- M0-S03 through M0-S05 and M0-S07 through M0-S12 are `Complete` on `main`;
- the license and trademark policy are integrated;
- clean installation, project checks, and CI pass at the expected revision;
- tracked files and full Git history pass secret, private-data, fixture, license, dependency, and public/private-boundary review;
- GitHub Actions runs, logs, and artifacts plus repository-hosted metadata and content that would become public—including pull requests, reviews, comments, issues, releases, packages, wiki pages, and discussions when present—are reviewed; secrets, credentials, protected personal or profile data, and private source content are removed or redacted and affected credentials are revoked or rotated before cutover; any external or destructive cleanup is separately authorized; only deliberate publication of non-sensitive material may be explicitly accepted by the owner;
- workflows use least privilege, immutable action revisions, and no unsafe privileged trigger for untrusted pull-request code;
- contribution, vulnerability-reporting, changelog, and versioning policies are present; and
- no confirmed, unresolved, unmitigated critical or high-severity finding remains.

The cutover authorization must name the visibility change, the exact `main` protections, verification, failure containment, and approval policy. Zero required approvals may be selected only if the owner explicitly accepts that GitHub will not independently enforce review while there is only one eligible maintainer; otherwise at least one approval from an eligible independent reviewer is required. Pull requests remain reviewable and full-diff review is mandatory in either case. After public visibility, only the already full-diff-reviewed M0-S02 state-transition pull request may merge before M0-S06 requires the real CI checks; every other merge remains blocked. M0-S02 and M0-S06 become `Complete` only after their remote controls are configured and read back and their verification evidence and state transitions are reviewed and integrated into `main`.

On September 5, 2026, after M0-S12 integrated at `0a34daf`, the owner explicitly authorized the public visibility transition, the exact protections, readback, rollback containment, and zero required approvals while accepting the lack of independently enforced review for the single-maintainer repository. The pre-publication gate passed: the pinned clean install and all 63 unit tests/checks passed; the latest pull-request and `main` CI runs succeeded; `npm audit` reported zero vulnerabilities; all tracked Markdown links resolved locally; reachable history, tracked files, 10 pull-request diffs, 14 retained Actions logs, and hosted metadata passed credential/private-data review with only inspected synthetic canaries and the deliberately published trademark contact; and no artifacts, releases, packages, deployments, Pages, wiki, discussions, standalone issues, comments, forks, configured Actions/Dependabot secrets, or additional collaborators existed. The remaining remote M0-S04 branch points to an ancestor already contained in `main` and exposes no additional tree content.

The first cutover attempt changed visibility but the immediate ruleset creation request failed; the authorized containment restored and verified private visibility. The successful retry waited until GitHub exposed the ruleset endpoint after the visibility transition. Readback then verified public visibility, default branch `main`, and active repository ruleset `22336912` targeting only `refs/heads/main`, with no bypass actors, pull requests required, zero approvals, squash as the only merge method, deletion restricted, non-fast-forward updates blocked, and the branch reported protected. A legacy ruleset created on September 4 but hidden by the private-plan API limitation reappeared after public visibility; it was inspected, identified as redundant, removed by exact ID, and the remaining declared/effective rule set was read back again. No GitHub Release, package publication, product release, deployment, required status check, or M1 behavior was introduced. No `FMU-E-*` evaluation applies because this slice changes repository governance rather than product behavior.

M0-S02 `Complete` became authoritative when its reviewed state-transition pull request passed CI and integrated at `de79bac`. Its temporary post-cutover merge restriction remained in force until M0-S06 configured and verified the real required check.

### M0-S05 baseline checks and CI

ADR-0006 records the formatter, lint, strict TypeScript, built-in test runner, aggregate-check, and least-privilege CI choices. Unit tests are non-empty; integration and evaluation commands use explicit `bootstrap-not-applicable` entries only until their named product boundaries exist. The M0-S05 aggregate established deterministic baseline checks. M0-S08 adds DCP schema validation; live audit, documentation links, secret scanning, dependency review, and other later gates remain outside that aggregate.

No `FMU-E-*` evaluation applies because M0-S05 establishes development and CI controls rather than product behavior. After M0-S05 integrated into `main`, M0-S07 became the next eligible slice. Any behavioral spike before the M0 exit gate is disposable and cannot enter product code.

### M0-S06 required CI checks on `main`

On September 5, 2026, after M0-S02 integrated at `de79bac`, the owner explicitly authorized the required-check configuration. Recent successful check runs on both the M0-S02 pull-request head and integrated `main` identified the real job context as `Windows baseline`, emitted by the GitHub Actions App with integration ID `15368`. No other pull request was open when the slice was claimed.

Repository ruleset `22336912` retains active enforcement for exactly `refs/heads/main`, zero bypass actors, pull requests with squash-only merge, zero required approvals under the accepted single-maintainer policy, deletion protection, and non-fast-forward protection. M0-S06 adds one `required_status_checks` rule: `Windows baseline` must originate from integration `15368`, and strict enforcement requires the pull-request branch to be tested with the latest `main`. Authenticated ruleset and effective-rule readback verified the exact context, source, strict policy, target, bypass list, and complete rule set. The state-transition pull request must itself demonstrate that the rule blocks merge while the check is pending and permits merge only after success.

This is a repository-governance control and changes no workflow, dependency, product behavior, schema, release, package, deployment, or data boundary. No `FMU-E-*` evaluation applies. The proposed M0-S06 `Complete` and M0-S13 `Ready` transitions become authoritative only after the reviewed state-transition revision passes the now-required check and integrates into `main`.

### M0-S07 repository governance policies

The [contributing guide](../CONTRIBUTING.md), [vulnerability-reporting policy](../SECURITY.md), [changelog](../CHANGELOG.md), and [versioning policy](../VERSIONING.md) establish the M0 governance deliverable. They reference the existing clean-install and verification path, distinguish unreleased drafts from released contracts, preserve the accepted license and protocol compatibility rules, and keep external contributions closed during private preparation. Private vulnerability reporting is conditional on an available channel; otherwise only a content-free request for private contact is allowed before details are exchanged.

This slice starts from integrated M0-S05 at `ceb9a81` and changes only governance documentation, README navigation, and this queue. It introduces no runtime behavior, data access, package or schema version change, dependency, or remote configuration. Existing ADRs govern these policies; no new architecture decision or behavioral `FMU-E-*` evaluation applies. Public cutover, branch protection, required-check configuration, and releases retain their separate gates and authorization requirements.

Local verification on Windows used Node.js `24.20.0`, npm `11.19.0`, `npm ci --ignore-scripts`, and `npm run check`: formatting, lint, strict type checking, and all 9 unit tests passed. Integration and evaluation commands reported their committed `bootstrap-not-applicable` exceptions. Governance verification additionally checks relative documentation links and heading targets and reviews the complete diff for normative consistency and sensitive content; these documentation checks are not part of the current CI aggregate. Required CI must pass for the reviewed revision before integration.

S07 integrated into `main` at `f98a049` with successful pull-request and post-merge CI, making S08 eligible. The current queue above governs subsequent routing; M0-S02 and M0-S06 retain their recorded blockers.

### M0-S08 first DCP schema slice

[ADR-0007](adr/0007-dcp-draft-schema-validation.md) records the first [DCP 0.1.0 authoring schema](../schemas/dcp/0.1.0.schema.json), [synthetic corpus](../fixtures/dcp/0.1.0/README.md), development-only validator, and compatibility limitations. The slice starts from integrated S07 at `f98a049`; S07's pull-request and post-merge CI passed before work began. The protocol example and limits, versioning notes, governance instructions, and changelog are synchronized. There is no new runtime package, source ingestion, MCP surface, production dependency, public release, or remote configuration.

`npm run schema:check` checks three positive and five negative fixtures locally and through the existing `npm run check` Windows CI path. Local verification with Node.js `24.20.0` and npm `11.19.0` passed formatting, lint, strict type checking, 26 unit tests, and the fixture command. Coverage includes claim-state structure, byte and calendar boundaries, unsupported authoring versions, unknown fields, non-mutation, malformed files, junctions/symlinks, and fixed CLI diagnostics. Integration and behavioral evaluations remain explicit `bootstrap-not-applicable` exceptions because no product boundary or behavior was introduced. A point-in-time audit of the updated development dependency graph reported zero vulnerabilities; it is separate from the deterministic aggregate.

Traceability is `FMU-FR-009`, `FMU-NFR-009`, `FMU-NFR-011`, the M0 contract gate, and ADR-0007. No behavioral `FMU-E-*` evaluation is claimed. Authoring validation does not prove runtime redaction, authorization, relevance, attribution, correction precedence, or consumer conformance. Full Evidence/Claim contracts remain M0-S09 and full Provider/consumer conformance remains M0-S12.

The proposed S08 `Complete` and S09 `Ready` transitions become authoritative only after complete-diff review, successful CI for the reviewed revision, and integration into `main`. M0-S02 and M0-S06 remain blocked by their existing prerequisites and external-authorization gates.

### M0-S09 Evidence and Claim contracts

[ADR-0008](adr/0008-evidence-claim-draft-contracts.md) records the independent [Evidence](../schemas/evidence/0.1.0.schema.json) and [Claim](../schemas/claim/0.1.0.schema.json) `0.1.0` authoring schemas, synthetic corpora, and the state-matched provenance decision. Evidence remains an immutable observation with source, visibility, authorship assessment, timestamps, strength, limitations, extractor, and invalidation metadata. Claim remains a separate assessment whose `basis.kind` distinguishes evidence-backed demonstration, adjacency inference, developer declaration, insufficient evidence, and dispute. A DCP continues to contain only a minimized claim summary.

`npm run schema:check` now checks the three DCP positive/five negative, three Evidence positive/six negative, and five Claim positive/nine negative fixtures through one bounded offline path. Unit coverage verifies closed authoring shapes, exact versions, local schema references, non-mutation, observation/claim separation, safe source-relative syntax, author uncertainty, calendar and ordering constraints, every Claim state, state/basis mismatches, automated/declaration/dispute provenance, project scope, raw/policy-field rejection, resource limits, symlink/junction rejection, and fixed canary-safe diagnostics. Local verification on Windows with the pinned Node.js `24.20.0` and npm `11.19.0` passed the full aggregate and all 37 unit tests; integration and behavioral evaluation suites retained their valid `bootstrap-not-applicable` exceptions because no runtime or evaluated behavior was introduced. The existing Ajv development dependency is reused exactly; the manifest dependency set and lockfile do not change.

Traceability is `FMU-FR-004` through `FMU-FR-006`, `FMU-FR-009`, `FMU-NFR-006`, `FMU-NFR-009`, `FMU-NFR-011`, the M0 public-contract gate, and ADR-0008. No behavioral `FMU-E-*` evaluation applies because this slice validates unreleased records rather than deriving claims, applying correction precedence, reading repositories, compiling DCPs, or changing a consumer's behavior. It adds no Profile Store/export shape, Demand Profile, Provider contract, product runtime, source access, persistence, MCP surface, production dependency, compatibility claim, publication, or remote effect.

The proposed S09 `Complete` and S10 `Ready` transitions become authoritative only after complete-diff review, successful CI for the reviewed revision, and integration into `main`. M0-S02 and M0-S06 remain blocked by their existing prerequisites and external-authorization gates.

### M0-S10 Profile-store and export boundary

[ADR-0009](adr/0009-profile-store-export-boundary.md) records the reference Community provider's [implementation-internal Store schema](../schemas/internal/community-profile-store/0.1.0.schema.json) and the public [Portable Profile Export contract](../schemas/portable-profile-export/0.1.0.schema.json). Both are unreleased `0.1.0` authoring drafts, but use different version fields, kinds, identifiers, and envelopes. The Store adds provider bookkeeping around the exportable profile payload; the Export requires explicit exclusions and contains no Store state. Store, Export, and DCP authoring boundaries reject one another.

`npm run schema:check` adds two valid/five invalid Store fixtures and two valid/five invalid Export fixtures to the existing bounded offline checker. Fixed local schema dependencies reuse the Evidence and Claim drafts without network loading. Supplementary validation covers unique and resolved evidence, declaration, correction, project, and correction-target references; capability agreement; nested Evidence time semantics; Store timestamp ordering; sensitive-field rejection; and non-mutation. Local Windows verification with Node.js `24.20.0` and npm `11.19.0` passed the full aggregate and all 46 unit tests. Integration and behavioral evaluation suites retain their valid `bootstrap-not-applicable` exceptions because the slice introduces no persistence, export command, runtime, or evaluated behavior. No dependency or lockfile changes are introduced.

Traceability is `FMU-FR-004`, `FMU-FR-008`, `FMU-FR-009`, contract preparation for `FMU-FR-015`, `FMU-NFR-009`, `FMU-NFR-011`, the M0 contract boundary gate, and ADR-0009. No behavioral `FMU-E-*` evaluation applies. The schemas do not prove owner intent, redaction, atomic writes, migrations, recovery, export, deletion, correction precedence, or consumer conformance, and add no source access, Demand Profile, Provider API, MCP surface, production dependency, release, publication, or remote effect.

The proposed S10 `Complete` and S11 `Ready` transitions become authoritative only after complete-diff review, successful CI for the reviewed revision, and integration into `main`. M0-S02 and M0-S06 remain blocked by their existing prerequisites and external-authorization gates.

### M0-S11 Demand Profile contract

[ADR-0010](adr/0010-demand-profile-draft-contract.md) records the public [Demand Profile `0.1.0` authoring schema](../schemas/demand-profile/0.1.0.schema.json) and its separation from developer assessment and DCP delivery. The envelope binds opaque demand/project/revision references, bounded task context, project-metadata availability, and unique required/supporting capabilities whose typed basis distinguishes task input, authorized project metadata, or both. Empty capability demand is valid rather than invented. Closed objects exclude profile, Claim, Evidence, policy, authority, credentials, paths, and raw project/source content.

`npm run schema:check` adds three valid/nine invalid Demand Profile fixtures to the existing bounded offline checker. Supplementary validation enforces unique capability identifiers and prohibits a project-derived basis when project metadata is unavailable; unit coverage verifies valid uncertainty and combined demand, metadata status/revision rules, task bounds and inert instruction-like text, prohibited fields, self-contained local references, non-mutation, and rejection among Demand, DCP, Export, and Store envelopes. Local Windows verification with Node.js `24.20.0` and npm `11.19.0` passed the full aggregate and all 54 unit tests. Integration and behavioral evaluation suites retain their valid `bootstrap-not-applicable` exceptions because the slice introduces no project reader, demand producer, profile intersection, DCP compiler, runtime, or evaluated behavior. No dependency or lockfile changes are introduced.

Traceability is `FMU-FR-003`, `FMU-FR-009`, `FMU-NFR-009`, `FMU-NFR-011`, the M0 public-contract gate, and ADR-0010. No behavioral `FMU-E-*` evaluation applies. Authoring validation does not prove source authorization, project/task relevance, demand derivation, safe redaction, profile intersection, DCP compilation, or consumer conformance, and adds no source access, Provider API, MCP surface, production dependency, release, publication, or remote effect.

The proposed S11 `Complete` and S12 `Ready` transitions become authoritative only after complete-diff review, successful CI for the reviewed revision, and integration into `main`. M0-S02 and M0-S06 remain blocked by their existing prerequisites and external-authorization gates.

### M0-S12 Provider and conformance contracts

[ADR-0011](adr/0011-provider-conformance-draft-contracts.md) records the public [Profile Provider `0.1.0` contract](../schemas/profile-provider/0.1.0.schema.json), public [conformance transcript schema](../schemas/conformance/profile-provider/0.1.0.schema.json), and [synthetic provider/consumer corpus](../fixtures/conformance/profile-provider/0.1.0/README.md). The capability descriptor and reusable request/response fragments are client-, model-, provider-, and transport-neutral; expose explicit protocol, operation, source, disclosure, deployment, freshness, and budget capabilities; keep Evidence Collectors/Source Adapters separate; and provide content-free typed errors. Bounded namespaced extension maps are the only draft unknown-field path.

`npm run schema:check` adds two valid/six invalid Provider capability fixtures and two valid/five invalid conformance transcripts. Structural and supplementary checks cover all four read operations, honest subsets, request/response correlation, success/error discrimination, advertised versions and operations, task/token/output limits, exact DCP semantics, capability discovery consistency, safe extensions, non-mutation, and rejection of credentials, arbitrary developers, collector inputs, raw data, policy, prose errors, and client-specific fields. Local Windows verification with Node.js `24.20.0` and npm `11.19.0` passed the full aggregate and all 63 unit tests. Integration and behavioral evaluation suites retain their valid `bootstrap-not-applicable` exceptions because no provider runtime, transport, authorization, adapter, or evaluated behavior exists. No dependency or lockfile changes are introduced.

Traceability is `FMU-FR-010`, `FMU-FR-023`, `FMU-NFR-001`, `FMU-NFR-009`, `FMU-NFR-011`, the M0 public-contract/conformance gate, and ADR-0011. No behavioral `FMU-E-*` evaluation applies. These development fixtures do not prove runtime provider/consumer, MCP, transport, authorization, redaction, cross-client equivalence, or released compatibility and add no source access, persistence, production dependency, release, publication, or remote effect.

S12 `Complete` became authoritative when the reviewed revision integrated at `0a34daf`, making M0-S02 eligible only with explicit external authorization. The resulting cutover evidence and proposed next transition are recorded in the M0-S02 section above. M0-S13 remains blocked until the remaining M0 slices complete.
