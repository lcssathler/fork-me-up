# Detailed agent workflow policy

> Current mandatory policy moved from AGENTS.md without weakening its rules. Read the sections relevant to the task; the [entry instructions](../AGENTS.md) select scope. Delivery-process authority remains [ENGINEERING.md](ENGINEERING.md).

## Working method

- Implement one small vertical slice and one observable outcome at a time.
- Map every change to applicable requirement and evaluation IDs. When no behavioral evaluation applies, record that fact with a reason and cite the milestone slice, gate, or ADR instead; never invent an ID.
- Prefer the smallest implementation that satisfies the acceptance criteria.
- Keep public contracts stable and client-neutral from the first slice.
- Extract abstractions from repeated working code, not hypothetical future needs.
- Prefer deterministic evidence extraction in the Community reference implementation.
- Do not add a dedicated LLM dependency, hosted service, database, embeddings, or remote connector before its roadmap gate and ADR.
- Preserve progressive disclosure: metadata first, task context second, evidence details only when authorized and useful.
- Finish each task in a runnable, verifiable state.
- Batch independent read-only discovery with bounded output. Once a check passes, reuse it for unchanged inputs and environment; repeat only for an affected edit, failure, new evidence, or an explicit gate. Apply the verification matrix in `docs/ENGINEERING.md` Section 2.4.
- Record the task contract and verification evidence once in the task or PR; other documents link to the durable decision/result. Keep historical execution narratives out of the active queue.

## Before implementation

For every task, record:

1. The applicable requirement, use case, evaluation, milestone slice, gate, or ADR being served. When no behavioral evaluation applies, record that fact and its reason instead of inventing an ID.
2. The expected observable result.
3. Files, packages, data classes, and external systems in scope.
4. Hard constraints and explicit non-goals.
5. Tests, evaluations, and security checks required.
6. Compatibility and migration impact.
7. Allowed side effects and stopping conditions.

Ask for user direction when a choice materially changes scope, risk, accessed data, public contracts, licensing, or external effects. Otherwise choose the smallest safe option and document the assumption.

## Git and change isolation

- Inspect the branch, base revision, and working-tree status before editing when Git is initialized.
- Preserve pre-existing user changes and never mix them into the task.
- Use one short-lived branch per observable outcome after Git is initialized.
- Keep branches small and cohesive; split work when a diff represents more than one decision.
- Do not mix feature work, broad refactoring, dependency upgrades, generated churn, and unrelated formatting.
- Keep commits atomic, buildable, and attributable to one requirement, defect, or bootstrap roadmap slice.
- Review the complete diff before reporting completion.
- Never force-push, rewrite shared history, push, merge, publish, deploy, tag, or release unless explicitly authorized.
- The default branch should remain protected and receive changes through reviewable pull requests with required checks once public visibility or external collaboration begins.
- The owner-selected GitHub Free M0 bootstrap may temporarily leave a private, single-owner remote without server-side enforcement only when `docs/ROADMAP.md` records the limitation and its closeout path. This is not equivalent protection: use short-lived branches, review complete diffs, run all available checks, do not push directly to `main`, accept no external contributions, and end the exception through verified public cutover and protection before M0 exits.
- Until Git, CI, or a documented command exists, dependent controls are `bootstrap-not-applicable`. The task creating each control runs the closest local equivalent, reports the gap, and ends the exception as soon as the control exists.

Recommended branch patterns:

```text
feat/m1-bootstrap-context
fix/profile-atomic-write
security/mcp-output-redaction
docs/client-neutral-boundary
```

## Multi-agent orchestration

- One lead agent owns scope, shared contracts, integration, and final verification.
- Delegate bounded tasks with explicit inputs, outputs, owned files, constraints, checks, and stopping conditions.
- Assign exclusive ownership of shared files wherever possible. Do not let multiple agents concurrently edit the same contract.
- Stabilize schemas and interfaces before parallelizing their producers and consumers.
- Parallelize independent analysis, implementation, and verification; serialize shared-contract changes.
- Subagents report changed files, checks run, assumptions, findings, and residual risks. They do not merge, publish, or expand scope.
- The lead agent inspects every resulting diff and reruns integrated checks. A subagent success report is not verification.
- If a shared contract changes, stop dependent parallel work and re-coordinate before continuing.

## Reproducibility

- Pin the supported Node.js policy and package-manager version before implementation begins.
- Commit the lockfile and use lockfile-enforced clean installs in CI.
- Keep tests independent of the developer's repositories, credentials, locale, timezone, wall clock, network, and global tools.
- Use synthetic fixtures and temporary repositories.
- Inject clocks, randomness, filesystem roots, identifiers, and network clients when determinism requires it.
- Normalize platform-specific paths and test the declared operating-system matrix.
- A clean checkout must be able to install, build, test, evaluate, and package through documented commands.

Project commands should converge on:

```text
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run eval
npm run check
```

Until these commands exist, use the closest available checks and report the gap.

## Tests and evaluations

- Bug fixes include automated regression coverage when practical.
- Contract changes require schema, compatibility, and MCP integration tests.
- Evidence changes require positive and adversarial attribution fixtures.
- Security-sensitive parsers and path handling require malformed, traversal, symlink, size-limit, and injection tests.
- Skills, tool descriptions, adapters, and response policies require behavioral evaluations.
- Test valid, missing, invalid, stale, partially available, unauthorized, and degraded states.
- Use canary secrets to prove that logs, diagnostics, exports, errors, and context packets redact sensitive data.
- Avoid exact prose matching in behavioral evaluations; assert required and forbidden behaviors.
- Do not report completion without listing the checks that actually ran.

## Dependencies and supply chain

- Add a production dependency only after reviewing its necessity, maintenance, license, install scripts, transitive risk, and alternatives.
- Keep dependencies minimal and lockfile changes reviewable.
- Pin CI actions by immutable commit SHA and grant workflows minimum permissions.
- CI should include secret scanning, dependency review, vulnerability analysis, and license checks.
- Releases must originate from a clean protected revision and include artifact inspection, checksums, an SBOM, and provenance or signing when supported.

## Documentation

- Material architectural decisions require an ADR before or with implementation.
- Public contract changes update schemas, fixtures, examples, compatibility notes, and changelog together.
- Product behavior changes update `docs/PROJECT_SPEC.md` and affected evaluation IDs.
- Security-boundary changes update `docs/SECURITY_PRIVACY.md` and its negative tests.
- Milestone scope or gates change only in `docs/ROADMAP.md`, with links from dependent documents.
- Do not create translated normative copies. Future translations must link to and identify the English source as canonical.

## Definition of Done

A change is complete only when:

- observable behavior and acceptance criteria trace to applicable requirement or evaluation IDs, or to a bootstrap gate/ADR when no behavioral ID applies;
- the diff contains no unrelated edits or accidental generated files;
- applicable unit, contract, integration, behavioral, security, and migration tests pass;
- negative and degraded states are covered proportionally to risk;
- logs, exports, diagnostics, errors, and MCP responses pass redaction checks;
- schemas, examples, migrations, documentation, and changelog remain synchronized;
- clean-checkout setup and project checks are reproducible;
- the complete diff has been reviewed and required CI is green when CI exists; bootstrap gaps are explicit;
- no confirmed, unresolved, unmitigated critical or high-severity security finding remains;
- executed checks, limitations, and residual risks are reported.

## External and destructive actions

The agent may read local files, edit in-scope files, run non-destructive checks, and fix failures caused by its changes without new confirmation.

Stop before deleting material data, accessing unauthorized private repositories, publishing, deploying, releasing, writing to external services, adding an unplanned production dependency, changing license terms, or materially expanding scope.
