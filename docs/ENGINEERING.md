# Fork Me Up — Engineering Process

> Status: mandatory pre-implementation process  
> Version: 0.1  
> Last updated: September 4, 2026

This document defines how Fork Me Up is built and is authoritative for delivery-process details. `AGENTS.md` summarizes mandatory guardrails. Product claims require evidence; engineering claims do too.

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

Read-only inspection ends with:

- applicable requirement, use-case, evaluation, milestone-slice, gate, and ADR identifiers, as applicable; when no behavioral evaluation applies, record that fact and its reason instead of inventing an ID;
- current behavior and evidence;
- observable outcome;
- files, packages, data classes, and systems in scope;
- risks and explicit non-goals;
- required tests and stopping conditions.

### 2.2 Contract and decision

Change a public schema or architecture only after:

- defining compatibility and migration impact;
- updating or adding fixtures;
- recording a material decision in an ADR;
- coordinating every producer and consumer;
- assigning a single owner for the shared contract.

### 2.3 Implementation

Implement the smallest end-to-end behavior. Use dependency injection at side-effect boundaries, explicit types at persistence and transport boundaries, and pure functions for policy and claim logic where practical.

### 2.4 Verification

Verification includes the relevant unit, schema, contract, integration, behavioral, security, migration, platform, and clean-install checks. Compilation alone is not proof of completion.

### 2.5 Documentation

Update all affected normative sources in the same branch. Do not rely on a handoff message to carry a durable decision.

### 2.6 Release

Passing tests does not authorize publishing. Release is a separately authorized action with its own reproducibility, security, artifact, and rollback gates.

## 3. Git workflow

### 3.1 Default branch

- `main` stays protected and green.
- Changes arrive through reviewable pull requests after the repository is public or collaboration begins.
- Required checks must pass before merge.
- Direct pushes, force pushes, and history rewrites are disabled for normal work.

### 3.2 Branches

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

M0 selects and records exact tooling. The implementation must then:

- pin the exact Node.js version used by development and CI in a committed tool file and declare the tested public support range separately in package metadata;
- pin the exact package-manager/Corepack version;
- commit the lockfile;
- use clean lockfile-enforced installs in CI;
- document setup, build, test, evaluate, package, and uninstall commands;
- avoid undeclared global dependencies;
- use synthetic fixtures and temporary repositories;
- inject clock, randomness, identifiers, filesystem roots, and network clients where required;
- normalize platform-specific paths;
- keep tests independent of user credentials, locale, timezone, machine repositories, and live network services.

A clean checkout must reproduce the documented checks. Any platform limitation is explicit and prevents a broader compatibility claim.

## 5. Code quality

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

### 6.1 Unit tests

Cover pure evidence rules, claim precedence, adjacency, task relevance, disclosure budgeting, response policy, cache validity, redaction, and migration behavior.

### 6.2 Schema and contract tests

Cover valid and invalid DCPs, provider capability negotiation, unknown fields, major-version rejection, typed errors, byte/token budgets, and synchronized examples.

### 6.3 Property and fuzz tests

Use where they add value for parsers, Unicode, paths, symlinks, size/depth limits, schema inputs, redaction, and malformed MCP requests.

### 6.4 Integration tests

Exercise MCP `stdio`, local persistence, adapters, cache invalidation, export, deletion, and diagnostics with temporary roots and controlled subprocesses. Git tests use a sanitized environment with pagers, hooks, fsmonitor, external diff, textconv, and untrusted config/includes disabled.

### 6.5 End-to-end tests

Exercise clean installation, first profile, correction, task packet, refresh, export, deletion, and uninstall. Later Cloud tests exercise source connection, consent, remote delivery, revocation, and account deletion.

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
- Subagents do not merge, publish, or declare integrated success.

### 10.4 Integration

The lead reviews changed files, resolves conflicts intentionally, reruns integrated checks, verifies documentation and security invariants, and reports what was not tested. Agent-generated code receives the same review as human-authored code.

## 11. Documentation and traceability

- Requirements use stable `FMU-FR-*` and `FMU-NFR-*` IDs.
- Behavioral evaluations use stable `FMU-E-*` IDs.
- Active roadmap slices use stable `M*-S*` IDs and explicit states for execution routing; they sequence work but do not define product behavior.
- Pull requests link implementation, tests, and documentation to every applicable requirement, evaluation, slice, gate, and ADR. When no behavioral evaluation applies, they record that fact and its reason and cite the slice, gate, or ADR instead.
- Public schema changes include fixtures, generated types, compatibility notes, migration behavior, and changelog.
- ADRs record decisions; they are not used as progress logs.
- `ROADMAP.md` records milestone state and gates; it does not redefine product behavior.
- The handoff document contains only navigation and current status, not unique decisions.
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

Normal implementation work may read local files, edit in-scope files, and run non-destructive local verification. Publishing, deploying, creating releases, changing license terms, accessing private repositories, writing to external services, modifying billing or authentication infrastructure, and destructive data operations require explicit authorization and their roadmap gates.

## 15. References

- [AGENTS.md](../AGENTS.md)
- [Product specification](PROJECT_SPEC.md)
- [Protocol](PROTOCOL.md)
- [Security and privacy](SECURITY_PRIVACY.md)
- [Roadmap](ROADMAP.md)

