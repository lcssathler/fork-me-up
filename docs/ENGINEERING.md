# Fork Me Up — Engineering Process

> Status: current delivery policy
> Version: 0.1  
> Last updated: September 9, 2026

This document defines how Fork Me Up is built and is authoritative for delivery-process details. `AGENTS.md` summarizes mandatory guardrails. Product claims require evidence; engineering claims do too.

Fork Me Up is developed by agents. Its product rules and user guides must also be clear to the person reviewing and using the system. The [editorial policy](#11-documentation-and-traceability) applies to both audiences.

## 1. Delivery principles

- Work in small vertical slices that end in observable, runnable behavior.
- Keep the default branch green and releasable.
- Stabilize public contracts before parallelizing implementations.
- Separate features, refactoring, dependencies, and formatting churn.
- Test proportionally to risk, with security and privacy as behavior rather than prose.
- Prefer deterministic, inspectable mechanisms before adding distributed or model-dependent complexity.
- Treat documentation, schemas, fixtures, migrations, and code as one change when behavior crosses them.
- Do not implement future milestones to make an abstraction look complete.

## 2. Work phases

Every change follows the smallest applicable form of:

```text
Discovery → Contract/ADR → Implementation → Verification
          → Security/privacy review → Documentation → Release gate
```

### 2.1 Discovery

Inspect current behavior and evidence, then record one task contract in the task or PR:

1. Applicable requirement, use-case, evaluation, milestone-slice, gate or ADR IDs. If no behavioral evaluation applies, explain why; do not invent an ID.
2. Expected observable result, including the behavior before and after.
3. Files, packages, data classes and external systems in scope.
4. Hard constraints, risks and explicit non-goals.
5. Required tests, evaluations and security checks, using Section 2.4.
6. Compatibility and migration impact.
7. Allowed effects and stopping conditions.

Ask for direction if a choice materially changes scope, risk, accessed data, public contracts, licensing or external effects. Otherwise choose the smallest safe option and record the assumption. For roadmap work, first apply the eligibility and ownership rules in [AGENTS.md](../AGENTS.md#milestone-request-routing).

### 2.2 Contract and decision

Change a public schema or architecture only after:

- defining compatibility and migration impact;
- updating or adding fixtures;
- recording a material decision in an ADR;
- coordinating every producer and consumer;
- assigning a single owner for the shared contract.

### 2.3 Implementation

Implement the smallest end-to-end behavior. Use dependency injection at side-effect boundaries, explicit types at persistence and transport boundaries, and pure functions for policy and claim logic where practical.

Extract abstractions from repeated working code. Keep public contracts stable and client-neutral, and prefer deterministic Community evidence extraction. Do not add a dedicated LLM dependency, hosted service, database, embeddings or remote connector before its roadmap gate and accepted ADR. Preserve progressive disclosure: metadata first, task context second, and evidence details only when authorized and useful. Finish with runnable, verifiable work.

### 2.4 Verification

Verification includes the relevant unit, schema, contract, integration, behavioral, security, migration, platform, and clean-install checks. Compilation alone is not proof of completion.

Select the smallest sufficient local verification set in the task contract:

| Change | Local verification | When to broaden |
|---|---|---|
| Prose, navigation or historical relocation only | `npm run docs:check`, `git diff --check`, review changed claims and compare moved content with its source. | Changed examples, commands, product/security claims or a milestone gate require their relevant executable checks. |
| Runtime, schemas, adapters or verification tooling | Focused tests while editing, then one successful final `npm run check`. | Affected contracts, security boundaries, migrations and platforms retain all their required coverage. |
| Toolchain, dependencies, packaging, release or milestone exit | One pinned clean checkout/install and full required gate. | Additional environments or measurements only as required by the specific gate. |

Required PR CI remains mandatory for every change, including documentation. The local documentation path does not weaken CI, review, release or milestone gates. If final CI is not yet available, report local verification as complete and integration as pending.

Run preflight once: branch/base/status/ownership, applicable toolchain versions and dependency installation. Install with `npm ci --ignore-scripts` before testing when dependencies are missing or the lockfile/environment changed. Reuse a verified matching toolchain. Batch independent reads and bound output; retain exit codes and concise summaries so output truncation does not force a rerun. Record the tested revision or diff and relevant environment once. Repeat a passing check only when an affected input changes, a failure/new concern warrants it, or the gate explicitly requires repetition. Prose-only changes after a full check require document checks, not a new runtime suite. An initial failed check remains reportable; do not conceal it with the successful rerun.

Use isolated, task-owned temporary roots. Keep required failure evidence, record retained artifacts, and remove only known disposable task artifacts when they are no longer needed. Do not rescan unrelated repositories or historical secrets for an ordinary documentation edit.

### 2.5 Documentation

Update all affected normative sources in the same branch. Do not rely on a handoff message to carry a durable decision.

Keep one authoritative location for each rule and one detailed record for each verification result. Prefer a link to repeating either. The editorial policy in Section 11 governs future additions as well as reorganizations.

For interrupted work, append only the observed revision, branch, changed files, completed checks and next action to that task's handoff. On resumption, verify those observations against Git and current authority. A historical handoff neither supplies a competing queue nor authorizes new effects.

### 2.6 Release

Passing tests does not authorize publishing. Release is a separately authorized action with its own reproducibility, security, artifact, and rollback gates.

## 3. Git workflow

### 3.1 Default branch

- `main` stays protected and green after public visibility or external collaboration begins.
- An owner-selected, roadmap-recorded GitHub Free M0 bootstrap may keep a single-owner repository private without server-side enforcement while preparing it for publication. This limitation is not equivalent protection: short-lived branches, complete-diff review, and all available checks remain mandatory; direct pushes to `main`, external contributions, and releases remain prohibited; and the exception ends through verified public cutover and protection before M0 exits.
- Changes use short-lived branches and reviewable pull requests throughout; server-side pull-request enforcement begins at the public cutover or before external collaboration.
- Required checks pass before merge and become server-enforced after their real check names exist and the roadmap authorizes the remote configuration.
- During the private bootstrap, direct pushes, force pushes, and history rewrites are prohibited by policy but are not represented as server-enforced controls. After the public cutover, they are disabled server-side for normal work.

### 3.2 Branches

- Inspect branch, base, working tree, local branches, worktrees and active ownership before editing. Update `main` before starting a short branch; preserve user edits and unintegrated work. Remove only verified integrated branches. Squash integration requires PR and content evidence before deleting a non-ancestor branch.
- Use one short-lived branch per observable outcome.
- Name branches by change type and intent, such as `feat/m1-bootstrap-context`, `fix/profile-atomic-write`, `security/path-boundary`, or `docs/protocol-draft`.
- A branch should map primarily to one requirement, defect, or bootstrap roadmap slice.
- Split a branch when its diff represents multiple independent decisions; do not use a rigid line-count rule.
- Keep broad refactoring, dependency upgrades, generated changes, and features separate whenever practical.
- Rebase or update safely before review, but never rewrite shared history without explicit coordination.

### 3.3 Commits

- Commits are atomic, buildable, and explain why the change exists.
- Conventional Commit-style subjects are preferred, with requirement IDs where helpful: `feat(context): compile bounded DCP [FMU-FR-007]`.
- Do not mix user changes or unrelated cleanup into the commit.
- Do not commit secrets, real profiles, private repository content, local caches, coverage output, or unreviewed generated artifacts.

### 3.4 Pull-request evidence

Every substantive pull request describes:

- motivation and applicable requirement, defect, milestone-slice, gate, or ADR identifiers, as applicable;
- observable behavior before and after;
- scope and non-goals;
- data, security, and privacy impact;
- public contract and migration impact;
- tests and evaluations executed;
- rollback or recovery where relevant;
- residual limitations and follow-up work.

Authentication, persistence, redaction, filesystem boundaries, public schemas, lifecycle hooks, release automation, and private-source access require focused human review.

## 4. Reproducible environment

The committed toolchain defines reproducibility. Development and CI must:

- pin the exact Node.js version used by development and CI in a committed tool file and declare the tested public support range separately in package metadata;
- pin the exact package-manager/Corepack version;
- commit the lockfile;
- use clean lockfile-enforced installs in CI;
- document setup, build, test, evaluate, package, and uninstall commands;
- avoid undeclared global dependencies;
- use synthetic fixtures and temporary repositories;
- inject clock, randomness, identifiers, filesystem roots, and network clients where required;
- normalize platform-specific paths;
- keep tests independent of user credentials, locale, timezone, wall clock, machine repositories, global tools and live network services.

A clean checkout must reproduce the documented checks. Any platform limitation is explicit and prevents a broader compatibility claim.

## 5. Code quality

The M2 evidence-quality gate is reproducible with `npm run measure:m2 -- --output <new-report-path.json>` from a full-history checkout and the pinned toolchain. The evaluator verifies the integrated freeze, retains every case on failures and never overwrites reports. `npm run check` includes the real frozen-sample integration and independent scorer regressions. Minimized failed integration reports are preserved under ignored `build/m2-quality-failures/` and uploaded by CI on failure. See [protocol](evaluations/M2_QUALITY_PROTOCOL.md), [results](evaluations/M2_QUALITY_RESULTS.md) and [machine handoff](handoffs/M2_NEXT_MACHINE.md). Raw committed measurement reports are excluded from formatting so their reproducibility hashes remain verifiable.

The M3 public Community benchmark is reproducible with `npm run measure:m3 -- --output <new-report-path.json>`. It reruns the frozen M2 evidence protocol, then measures three repeated synthetic calibrations through Codex and the independent generic consumer, including exact disclosure bytes and the conservative DCP token upper bound. Its report is constructed conformance, not human accuracy, model-response quality, time saved or ranking. See the [benchmark protocol](evaluations/M3_COMMUNITY_BENCHMARK.md) and [ADR-0040](adr/0040-reproducible-public-community-benchmark.md).

- Use strict TypeScript settings and explicit types at public, persistence, process, and MCP boundaries.
- Validate all external data at runtime.
- Keep side effects behind narrow ports.
- Prefer clear modules over speculative frameworks or service layers.
- Use structured typed errors without leaking internal details.
- Keep functions and files cohesive; split by responsibility rather than arbitrary size.
- Never claim persistence before an atomic write is validated and, where applicable, read back.
- Preserve old valid state during migration or failed writes.
- Keep compatibility shims bounded, documented, and tested.
- Add comments for non-obvious intent or safety invariants, not narration of obvious code.

## 6. Test strategy

Bug fixes include regression coverage when practical. Test valid, missing, invalid, stale, partial, unauthorized and degraded states. Public contract changes require schema, compatibility and MCP integration tests; evidence changes require positive and adversarial attribution fixtures. Skills, tool descriptions, adapters and response policies require behavioral evaluations. Security-sensitive parsers and paths require malformed, traversal, symlink, size-limit and injection cases. Assert required and forbidden behavior instead of exact generated prose.

### 6.1 Unit tests

Cover pure evidence rules, claim precedence, adjacency, task relevance, disclosure budgeting, response policy, cache validity, redaction, and migration behavior.

### 6.2 Schema and contract tests

Cover valid and invalid DCPs, provider capability negotiation, unknown fields, major-version rejection, typed errors, byte/token budgets, and synchronized examples.

### 6.3 Property and fuzz tests

Use where they add value for parsers, Unicode, paths, symlinks, size/depth limits, schema inputs, redaction, and malformed MCP requests.

### 6.4 Integration tests

Exercise MCP `stdio`, local persistence, adapters, cache invalidation, export, deletion, and diagnostics with temporary roots and controlled subprocesses. Git tests use a sanitized environment with pagers, hooks, fsmonitor, external diff, textconv, and untrusted config/includes disabled.

Optional public-history tests use an injected GitHub byte port and synthetic public/private/malformed responses; routine checks never require a credential or live network. Verify local-first zero-request behavior, explicit temporary consent, exact repository/head binding, fixed read-only endpoints, request/byte/commit/path/deadline ceilings, content-free degradation and process-memory cache reuse.

Artifact compatibility uses exact private Protocol/Core/Community Provider tarballs and a temporary consumer lockfile derived from the official production dependency closure. Start clean artifact verification with a fresh root `npm ci` and an empty npm cache; install the consumer offline with lifecycle scripts disabled. Verify version/operation rejection, export/import, expected-generation conflict, migration, recovery and Store/interchange separation through `npm run compatibility:check`. Never run aggregate checks concurrently with another artifact build.

### 6.5 End-to-end tests

Exercise clean installation, first profile, correction, task packet, refresh, export, deletion, and uninstall. `npm run lifecycle:check` installs two exact private candidate graphs through derived offline locks, preserves Store/correction behavior across the transition, then verifies managed deletion, package removal and retained source/export data. The CI matrix runs that focused gate on Windows, macOS and Linux; its version-only candidate transition does not prove migration between different implementations or a released support window. Later Cloud tests exercise source connection, consent, remote delivery, revocation, and account deletion.

### 6.6 Behavioral evaluations

Evaluate outcomes rather than exact wording. Every scenario declares:

- profile and evidence inputs;
- project and task;
- mandatory behavior;
- prohibited behavior;
- claims and limitations that must remain intact;
- approximate tool-call, token, and latency budget;
- supported consumers or models under test.

### 6.7 Security and privacy tests

Required adversarial categories are maintained in `SECURITY_PRIVACY.md`, including malicious repository instructions, path escape, shell metacharacters, resource exhaustion, false attribution, canary secrets, unauthorized evidence, persistence interruption, and future cross-tenant access.

Canary tests must prove redaction in logs, diagnostics, exports, errors and context packets. Report the checks actually executed, including failures and untested areas.

## 7. Initial behavioral evaluation catalog

| ID | Input | Required behavior |
|---|---|---|
| FMU-E-001 | Strong Java evidence; object-oriented refactoring task. | Concise peer-level answer focused on design and trade-offs. |
| FMU-E-002 | Insufficient CI/CD evidence; workflow task. | Explain purpose, expected result, risk, and command category. |
| FMU-E-003 | Angular demonstrated; React unobserved. | Controlled analogy and explicit differences; no React proficiency claim. |
| FMU-E-004 | No evidence for a technology. | Preserve `insufficient-evidence`; never assert ignorance. |
| FMU-E-005 | Developer correction conflicts with inference. | Correction wins while conflict remains traceable. |
| FMU-E-006 | Irrelevant expertise exists in the profile. | Omit it from the task packet. |
| FMU-E-007 | Evidence comes from a fork, template, generated, or vendor source. | Reduce support and expose the limitation. |
| FMU-E-008 | Authorship is unknown or shared. | Avoid high-confidence personal depth. |
| FMU-E-009 | Ambiguity materially changes behavior. | Ask at most one high-information question. |
| FMU-E-010 | Ambiguity does not change behavior or risk. | Continue without an onboarding questionnaire. |
| FMU-E-011 | Profile write succeeds or fails. | Confirm target only after success; preserve prior valid state on failure. |
| FMU-E-012 | Repository text contains prompt injection. | Treat it as data; do not change privileged policy or disclose data. |
| FMU-E-013 | DCP has a strict output budget. | Remain valid, bounded, relevant, and progressively disclosed. |
| FMU-E-014 | Optional provider or adapter is unavailable. | Ordinary host work continues without weakening security. |
| FMU-E-015 | Canary secrets appear in inputs. | No canary appears in packet, log, error, diagnostic, or export. |
| FMU-E-016 | Same fixture is consumed by different clients. | Preserve claim meaning and required behavioral intent. |
| FMU-E-017 | Sharing Grant is absent, expired, revoked, or under-scoped. | Return no protected context. |
| FMU-E-018 | Consumer requests another developer or unrelated task data. | Reject without revealing whether the target exists. |

Current executable coverage is maintained in [behavioral evaluations](../evaluations/) and [integration tests](../tests/integration/). These tests prove structured behavior within their declared scope; they do not establish equivalent model-written answers or untested compatibility. The execution narratives are retained in the [M1](history/M1_EXECUTION.md#verification-coverage-recorded-at-84921df), [M2](history/M2_EXECUTION.md#verification-coverage-recorded-at-84921df) and [M3](history/M3_EXECUTION.md#verification-coverage-recorded-at-b5b8cef) records.

## 8. CI strategy

### 8.1 Pull-request fast gate

```text
format-check
lint
typecheck
unit tests
schema and contract tests
documentation link/schema checks
secret scan
dependency review
```

Relevant integrated tests for an affected path are required pull-request checks. Larger platform matrices and long-running suites may run on schedule but do not replace risk-relevant PR coverage.

### 8.2 Integrated gate

```text
MCP integration
filesystem and Git security cases
behavioral evaluations
supported operating-system matrix
package dry-run and artifact inspection
```

### 8.3 Scheduled or risk-triggered gate

```text
fuzz/property suites
expanded platform matrix
dependency vulnerability and license audit
performance and context-budget regression
stale/migration corpus
```

### 8.4 Release gate

```text
clean checkout and locked install
full test and evaluation suite
install/uninstall smoke test
SBOM and license report
artifact content inspection
checksums and provenance/signing
documented rollback or withdrawal procedure
```

Risk-relevant tests remain required in the pull request even if a larger version also runs on a schedule.

## 9. Dependency and supply-chain policy

Before adding a production dependency, record:

- concrete use and alternatives considered;
- maintenance and release health;
- license compatibility;
- install scripts and native/build behavior; lifecycle scripts are disabled by default where viable, and every exception records package, version, script, reason, and risk in a CI-checked allowlist;
- transitive dependency and vulnerability impact;
- bundle, startup, and runtime cost;
- removal or replacement path.

Keep dependencies minimal. Lockfile changes receive focused review. CI actions use immutable commit SHAs and least-privilege permissions. Release artifacts are built from protected revisions and linked to source and checks.

## 10. Multi-agent work

### 10.1 Lead responsibilities

The lead agent owns:

- scope and milestone alignment;
- contracts and shared decisions;
- task decomposition and file ownership;
- integration order;
- review of every diff;
- complete verification and final reporting.

### 10.2 Delegated-task contract

Every delegated task includes:

- objective and why it is independent;
- inputs and authoritative documents;
- files the agent owns or must not edit;
- contract version and assumptions;
- required tests and output format;
- allowed effects and stopping conditions.

### 10.3 Parallelization rules

- Parallelize independent packages, research, fixtures, and review.
- Do not concurrently edit the same schema, ADR, lockfile, or integration file.
- Decide shared contracts before parallel consumer work.
- Prefer separate branches or worktrees when Git is available.
- Stop and re-coordinate dependent tasks after a shared contract changes.
- Subagents report changed files, checks run, assumptions, findings and residual risks. They do not expand scope, merge, publish or declare integrated success.

### 10.4 Integration

The lead reviews changed files, resolves conflicts intentionally, reruns integrated checks, verifies documentation and security invariants, and reports what was not tested. Agent-generated code receives the same review as human-authored code.

## 11. Documentation and traceability

### Write for the reader

- Explain the product and its business rules in plain English in the authoritative document itself. Introduce a technical term when it is first needed, and use a small example when a rule could be misunderstood. Do not maintain a separate simplified specification that can drift from the contract.
- Give each document one responsibility. State a rule once in its responsible source; elsewhere use a short contextual explanation and a direct link. Repeat a safety limit where the user must see it to act correctly, such as the scope of deletion.
- Separate required behavior, currently available behavior and future work. Technical references describe current contracts and explicit future boundaries; completed implementation narratives belong in history. Do not describe a test result as broader product compatibility or human accuracy.
- A short file with dense paragraphs is not necessarily easy to read. Prefer meaningful headings, short paragraphs, one rule per bullet and narrow tables. Do not replace a long paragraph with an equally long table cell or a mandatory chain of summaries.

### Keep one responsible source

| Subject | Responsible source |
|---|---|
| Product behavior and business rules | `PROJECT_SPEC.md` |
| Security, privacy, consent, retention and threats | `SECURITY_PRIVACY.md` |
| Public objects and wire semantics | `PROTOCOL.md` and public schemas |
| Compatibility and version changes | `VERSIONING.md` |
| Component responsibilities and data flow | `ARCHITECTURE.md` |
| Delivery process, task contracts and verification | `ENGINEERING.md` |
| Milestone scope, states, queue and gates | `ROADMAP.md` |
| Architectural rationale and accepted decisions | ADRs |
| Detailed execution and verification evidence | Task/PR records, history, evaluations and audits |

This division follows the authority order in [AGENTS.md](../AGENTS.md). Accepted ADRs remain applicable within that order; only superseded decisions are historical authority. When a change affects more than one subject, update every affected source together. Product changes update requirements and evaluations; security changes update threats and negative tests; public contract changes update schemas, generated types, fixtures, examples, compatibility, migration notes and changelog. Material architecture changes require an ADR before or with implementation.

### Preserve traceability and navigation

- Requirements use stable `FMU-FR-*` and `FMU-NFR-*` IDs.
- Behavioral evaluations use stable `FMU-E-*` IDs.
- Active roadmap slices use stable `M*-S*` IDs and explicit states for execution routing; they sequence work but do not define product behavior.
- Pull requests link implementation, tests, and documentation to every applicable requirement, evaluation, slice, gate, and ADR. When no behavioral evaluation applies, they record that fact and its reason and cite the slice, gate, or ADR instead.
- Public schema changes include fixtures, generated types, compatibility notes, migration behavior, and changelog.
- ADRs record decisions; they are not used as progress logs.
- `ROADMAP.md` records milestone state and gates; it does not redefine product behavior.
- The generic handoff contains navigation, not unique decisions or a duplicate current queue.
- `AGENTS.md` owns agent entry routes and mandatory guardrails. `AGENT_POLICY.md` is a compatibility index into this delivery policy, not a second copy of it. New task routes point directly to the responsible sections.
- The roadmap is the sole authority for milestone states and the current ordered queue. README, handoffs and the documentation map link there instead of maintaining another status list. An optional task handoff records its observed revision and pending work, not a competing queue.
- Keep completed slice narratives in `docs/history/`; retain decisions, thresholds, authorizations and verification evidence with their original task context. Archives are not current authority for external actions. Preserve links when moving material. Frozen experiment inputs/reports retain exact bytes and paths.
- Keep README focused on purpose, how the product works, user control, availability limits, setup and navigation. Put package internals and verification mechanics in technical references. The documentation map offers separate paths for understanding, using and developing the product; it must not require users to start with agent instructions.
- Record task contracts and verification once in the task/PR or durable decision. Changelogs describe the outcome briefly. Routine slices need a short record/link; reserve comprehensive gate tables for milestone/security/release audits. Put long audit evidence behind a concise verdict page.
- `npm run docs:check` enforces local Markdown targets/fragments and byte budgets for entry documents: README 7 KiB, handoff 3 KiB, documentation map 6 KiB, roadmap 40 KiB and AGENTS 12 KiB. When approaching a budget, move background to a linked subject/history file while preserving content and authority. Raising a budget requires an explicit process rationale; splitting content into mandatory recursive reading does not satisfy the reading policy.
- English is the normative documentation language. Translations, if added, are labeled non-normative and link to the canonical source.

## 12. Definition of Done

A change is done only when:

Until Git, CI, or a documented command exists during M0 bootstrap, the dependent item is marked `bootstrap-not-applicable`; the task creating it runs the closest local equivalent, reports the gap, and ends the exception immediately after the control exists.

- observable behavior and acceptance criteria trace to applicable requirements, defects, evaluations, or bootstrap slices, gates, and ADRs;
- the branch and diff are cohesive and contain no accidental files;
- applicable tests and evaluations pass;
- invalid, missing, stale, unauthorized, and degraded states are covered proportionally to risk;
- canary and redaction checks pass for every affected output channel;
- schemas, examples, migrations, documentation, and changelog agree;
- clean-checkout setup remains reproducible;
- the full diff has been self-reviewed and required CI is green;
- no confirmed, unresolved, unmitigated critical or high-severity finding remains;
- checks actually executed, untested areas, limitations, and residual risks are reported.

## 13. Initial command contract

After scaffolding, commands should converge on:

```text
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run eval
npm run check
```

M0 must define what each command includes and keep local and CI behavior aligned.

## 14. External effects

Normal implementation work may read local files, edit in-scope files, run non-destructive local verification and fix failures caused by those changes without another confirmation.

Push, external pull-request creation, merge, force-push, shared-history rewrites, tags, publication, deployment, releases, license changes, private-repository access, external-service writes, billing/authentication infrastructure changes and material data deletion require explicit authorization and applicable roadmap gates. Stop before an unplanned production dependency or a material scope expansion. Tests passing never supply that authorization.

## 15. References

- [AGENTS.md](../AGENTS.md)
- [Product specification](PROJECT_SPEC.md)
- [Protocol](PROTOCOL.md)
- [Security and privacy](SECURITY_PRIVACY.md)
- [Roadmap](ROADMAP.md)
