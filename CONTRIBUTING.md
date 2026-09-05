# Contributing to Fork Me Up

Fork Me Up is in M0 private preparation. External contributions are not accepted during the private, single-owner bootstrap. The [roadmap](docs/ROADMAP.md) governs the public cutover, protection of `main`, and required CI checks. This guide prepares that workflow; it does not authorize publication or open contributions early.

## Before starting

Read the [project specification](docs/PROJECT_SPEC.md), [protocol](docs/PROTOCOL.md), [architecture](docs/ARCHITECTURE.md), [security and privacy invariants](docs/SECURITY_PRIVACY.md), [engineering process](docs/ENGINEERING.md), [roadmap](docs/ROADMAP.md), and relevant accepted [ADRs](docs/adr/README.md). [AGENTS.md](AGENTS.md) defines authority, task contracts, and ownership rules for coding agents. English is the canonical documentation language.

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

The aggregate command executes these checks in order and stops at the first failure:

| Command | Current coverage |
|---|---|
| `npm run format:check` | Prettier checks configuration and source formats; Markdown is excluded. |
| `npm run lint` | ESLint with zero warnings allowed. |
| `npm run typecheck` | Strict TypeScript and JavaScript tooling checks, without emission. |
| `npm test` | Non-empty Node.js unit suite. |
| `npm run schema:check` | Exact DCP, Evidence, Claim, internal Store, public Export, and Demand draft schemas and positive/negative synthetic fixtures, with bounded reads and contract-specific semantic checks. |
| `npm run test:integration` | Integration suite, currently an explicit `bootstrap-not-applicable` exception. |
| `npm run eval` | Behavioral suite, currently an explicit `bootstrap-not-applicable` exception. |

Integration and evaluation exceptions end when their named boundaries exist; adding a matching test makes the corresponding exception fail until removed. See the [committed suite exceptions](config/test-suite-exceptions.json) for the exact ending conditions and [ADR-0006](docs/adr/0006-baseline-checks-and-ci.md) for the policy. Do not report these exceptions as product tests passing.

The [CI workflow](.github/workflows/ci.yml) runs the same clean install and aggregate command in the `Windows baseline` job for pull requests and pushes to `main`. This is the current verification path, not the complete release gate. DCP, Evidence, Claim, internal Store, public Portable Profile Export, and Demand Profile validation is included; provider/conformance contracts follow in M0-S12. Automated documentation links, secret scanning, dependency review, vulnerability analysis, license checks, and the broader platform matrix remain later gates. Review Markdown, links, and disclosure manually for documentation changes; record additional checks actually run. There are no product build, package, or install/uninstall commands yet.

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

Use pull requests to integrate into `main`; direct pushes, force pushes, and shared-history rewrites are prohibited under the private bootstrap policy. After public cutover, normal work uses the server-side protections required by the roadmap. During private preparation these controls are procedural, not server-enforced. The roadmap records the temporary limitation and the M0-S02/M0-S06 closeout sequence, including the post-cutover merge restriction. Agents must stop before push, external pull-request creation, merge, publication, release, deployment, or remote configuration unless the current task explicitly authorizes that effect.

## Licensing and attribution

Contributions follow the existing [Apache-2.0 license](LICENSE), [NOTICE](NOTICE), and [ADR-0004](docs/adr/0004-apache-license-and-trademark-policy.md). Contribute only material you have authority to submit and retain required third-party notices. Copyright remains with the applicable holder; no copyright assignment is required by default. ADR-0004 records the treatment of Contributions, submissions conspicuously marked `Not a Contribution`, and separate agreements. Project marks remain governed by [TRADEMARKS.md](TRADEMARKS.md).
