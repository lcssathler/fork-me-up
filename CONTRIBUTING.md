# Contributing to Fork Me Up

See the [roadmap](docs/ROADMAP.md) for milestone status and eligible work. The repository is visible, `main` is protected, and the real Windows baseline check is mandatory. Contributions may be proposed through pull requests under that queue, security policy, and review requirements below. Public visibility and milestone completion are not product releases or permission to bypass the current queue.

## Before starting

Start with the [documentation map](docs/README.md) and follow the subject-specific reading routes in [AGENTS.md](AGENTS.md). Read affected normative sections and accepted decisions before changing them; full milestone/security/release audits still require their complete gate coverage. English is the canonical documentation language.

For an ordinary bug report, provide the affected revision, expected and actual behavior, and a minimal synthetic reproduction. Request scope alignment before substantial changes. Use [SECURITY.md](SECURITY.md) for suspected vulnerabilities; do not disclose them in an ordinary issue or pull request.

For roadmap work, verify the current queue, integrated prerequisites, branch/base, working tree, worktrees, and active assignments or pull requests. Claim only an eligible, unowned slice on a short-lived branch. Historical or integrated branches are not active claims. Record the task contract before editing: traceability, observable result, scope, constraints, checks, compatibility impact, allowed effects, and stopping conditions. A slice ID does not bypass a gate.

## Local setup and verification

Use Node.js `24.20.0` and its bundled npm `11.19.0`, as pinned in [.nvmrc](.nvmrc), [package.json](package.json), and [ADR-0005](docs/adr/0005-node-npm-workspace-toolchain.md). Corepack is not required. Windows is the first verified platform; Linux and macOS remain release targets without a current support claim.

From a clean checkout of the agreed revision, run:

```text
node --version
npm --version
npm ci --ignore-scripts
npm run check
```

Stop and correct the environment if versions differ. Keep the committed lockfile and dependency lifecycle scripts disabled. Do not bypass engine checks or change dependencies just to make setup pass.

That is the reproducible full baseline. For subsequent changes, select local checks using the [verification matrix](docs/ENGINEERING.md#24-verification). Prose-only edits use `npm run docs:check` and `git diff --check`; required PR CI still runs the full aggregate. Reuse successful checks on unchanged inputs instead of repeating the aggregate after each prose edit.

The aggregate command executes these checks in order and stops at the first failure:

| Command | Current coverage |
|---|---|
| `npm run format:check` | Prettier checks configuration and source formats; Markdown is excluded. |
| `npm run docs:check` | Offline local Markdown target/heading validation and entry-document size budgets. |
| `npm run lint` | ESLint with zero warnings allowed. |
| `npm run typecheck` | Strict TypeScript and JavaScript tooling checks, without emission. |
| `npm run package:dry-run` | Builds private Protocol, Core and Community Provider candidates, then checks exact package-relative contents without creating or publishing tarballs. |
| `npm run package:protocol` | Builds the private local Protocol tarball, checks exact SDK/schema/fixture/conformance exports and records package-relative inspection metadata without publishing. |
| `npm test` | Non-empty Node.js unit suite covering Protocol/Core behavior and the bounded Community source, Store, owner, Provider, and adapter boundaries. |
| `npm run schema:check` | Exact domain, internal Store, Profile Provider, and provider/consumer conformance draft schemas and positive/negative synthetic fixtures, with bounded reads and contract-specific semantic checks. |
| `npm run test:integration` | Non-empty real-process/filesystem suite for local source collection, persistence/recovery, owner operations, Provider/MCP/Codex delivery, isolated Protocol-artifact consumer installation, security boundaries, and the frozen M2 measurement. |
| `npm run eval` | Community-relevant FMU-E-001 through FMU-E-016 where applicable, including same-fixture Claim/Response Policy equivalence across Codex and the generic consumer. |

Unit, integration, and evaluation suites are non-empty and have no bootstrap exception. The fail-closed suite policy remains in [ADR-0006](docs/adr/0006-baseline-checks-and-ci.md); an empty suite is an error unless a future bootstrap boundary has a complete, current, explicitly scoped exception.

The [CI workflow](.github/workflows/ci.yml) runs the same clean install and aggregate command in the `Windows baseline` job for pull requests and pushes to `main`. This is the current verification path, not the complete release gate. It includes the full current unit/schema/integration/evaluation baseline, the frozen M2 controls and private package dry-run inspection. GitGuardian runs on pull requests; dependency/vulnerability and license review plus local Markdown validation are still recorded explicitly when applicable. Automated cross-platform install/uninstall, released-artifact inspection, SBOM, license report, checksums, and provenance/signing remain later M3 release gates. There is no product release artifact yet.

## Preparing a change

- Keep one observable outcome per branch and atomic commit. Preserve pre-existing user changes; avoid unrelated formatting, generated files, upgrades, or refactoring.
- Cite applicable requirement, use case, evaluation, slice, gate, and ADR IDs. If no behavioral evaluation applies, explain why and cite the applicable slice or gate instead of inventing an ID.
- Use synthetic fixtures and temporary repositories. Never attach real credentials, personal profiles, private repository content, conversations, or personal paths to tests, logs, issues, or pull requests.
- Add proportionate regression and negative coverage. Public contract changes synchronize schemas, generated types, fixtures, examples, compatibility notes, migrations, and the [changelog](CHANGELOG.md). Follow [versioning policy](VERSIONING.md).
- Update affected normative documents in the same change. Material architecture decisions require an ADR; scope, licensing, private-data access, new source/consumer integrations, and external effects retain their owner-decision and security gates.
- Review dependencies under [ENGINEERING.md Section 9](docs/ENGINEERING.md#9-dependency-and-supply-chain-policy). Keep Protocol and Core client-neutral and public packages independent of proprietary Cloud/Pro code.
- Review every AI-assisted change and every resulting diff. Generated code has the same evidence, security, attribution, and verification requirements as any other contribution.

## Review and integration

A pull request should explain the problem and resulting behavior, traceability, scope and non-goals, data/security/privacy impact, compatibility and migration impact, checks and evaluations actually executed, rollback or recovery, and remaining limitations. Do not include sensitive reproduction details; coordinate them through the security-reporting process.

Run the documented checks on the revision submitted for review and inspect the complete diff. Relevant CI must pass before merge. The [engineering process](docs/ENGINEERING.md#34-pull-request-evidence) requires focused human review for authentication, persistence, redaction, filesystem boundaries, public schemas, lifecycle hooks, release automation, and private-source access.

Use pull requests to integrate into `main`; its active ruleset requires the GitHub Actions `Windows baseline` check from the expected integration and blocks deletion and non-fast-forward updates without bypass actors. Pull-request branches must be tested with the latest `main`. Direct pushes, force pushes, deletion, and shared-history rewrites remain prohibited. Agents must stop before push, external pull-request creation, merge, publication, release, deployment, or remote configuration unless the current task explicitly authorizes that effect.

## Licensing and attribution

Contributions follow the existing [Apache-2.0 license](LICENSE), [NOTICE](NOTICE), and [ADR-0004](docs/adr/0004-apache-license-and-trademark-policy.md). Contribute only material you have authority to submit and retain required third-party notices. Copyright remains with the applicable holder; no copyright assignment is required by default. ADR-0004 records the treatment of Contributions, submissions conspicuously marked `Not a Contribution`, and separate agreements. Project marks remain governed by [TRADEMARKS.md](TRADEMARKS.md).
