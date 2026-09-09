# Contributing to Fork Me Up

See the [roadmap](docs/ROADMAP.md) for milestone status and eligible work. The repository is visible, `main` is protected, and the real Windows baseline check is mandatory. Contributions may be proposed through pull requests under that queue, security policy, and review requirements below. Public visibility and milestone completion are not product releases or permission to bypass the current queue.

## Before starting

Start with the [documentation map](docs/README.md) and follow the subject-specific reading routes in [AGENTS.md](AGENTS.md). Read affected normative sections and accepted decisions before changing them; full milestone/security/release audits still require their complete gate coverage. English is the canonical documentation language.

For an ordinary bug report, provide the affected revision, expected and actual behavior, and a minimal synthetic reproduction. Request scope alignment before substantial changes. Use [SECURITY.md](SECURITY.md) for suspected vulnerabilities; do not disclose them in an ordinary issue or pull request.

For roadmap work, apply the [eligibility and ownership rules](AGENTS.md#milestone-request-routing). Before editing, record the [task contract](docs/ENGINEERING.md#21-discovery) and select the required checks. A slice ID does not bypass a gate.

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
| `npm run test:integration` | Non-empty real-process/filesystem suite for local source collection, persistence/recovery, owner operations, Provider/MCP/Codex delivery, isolated artifact installation and lifecycle, security boundaries, and the frozen M2 measurement. |
| `npm run eval` | Community-relevant FMU-E-001 through FMU-E-016 where applicable, including same-fixture Claim/Response Policy equivalence across Codex and the generic consumer. |

Unit, integration, and evaluation suites are non-empty and have no bootstrap exception. The fail-closed suite policy remains in [ADR-0006](docs/adr/0006-baseline-checks-and-ci.md); an empty suite is an error unless a future bootstrap boundary has a complete, current, explicitly scoped exception.

The [CI workflow](.github/workflows/ci.yml) runs the clean aggregate in `Windows baseline` and a focused artifact lifecycle in separate Windows, macOS and Linux jobs for pull requests and pushes to `main`. The matrix installs two exact private candidate graphs through derived offline locks, exercises the synthetic Community value loop across their transition, deletes managed state, uninstalls the packages and retains minimized reports. This is not the complete release gate: released-artifact inspection, SBOM, license report, checksums and provenance/signing remain later M3 work, and there is no product release artifact yet. GitGuardian runs on pull requests; dependency/vulnerability and license review plus local Markdown validation are still recorded explicitly when applicable.

## Try the synthetic transport

For a development-only synthetic MCP process:

```text
npm run mcp
```

Fixture selections are `demonstrated`, `adjacent`, `insufficient-evidence` and `unavailable`. They exercise transport behavior, not your repository profile. The [Codex adapter](adapters/codex/README.md) documents lifecycle hooks and explicit trust requirements; checked-in hooks default to unavailable. Use the [local Community guide](docs/LOCAL_COMMUNITY.md) for a saved profile and the [generic consumer guide](consumers/generic/README.md) for independent packet conformance.

## Preparing a change

Keep one observable outcome per branch and cohesive commits. Preserve user edits and use synthetic reproductions; never submit credentials, personal profiles, private source or conversations.

Follow [Engineering](docs/ENGINEERING.md) for the complete delivery rules: [Git isolation](docs/ENGINEERING.md#3-git-workflow), [verification](docs/ENGINEERING.md#24-verification), [dependencies](docs/ENGINEERING.md#9-dependency-and-supply-chain-policy), [documentation](docs/ENGINEERING.md#11-documentation-and-traceability) and [Definition of Done](docs/ENGINEERING.md#12-definition-of-done). Public contract changes also follow [versioning](VERSIONING.md). Review agent-generated changes with the same rigor as any contribution.

## Review and integration

A PR explains the problem, result, traceability, scope, data/security impact, compatibility, executed checks and remaining limits. Use the [PR evidence requirements](docs/ENGINEERING.md#34-pull-request-evidence), including focused human review for sensitive boundaries. Coordinate sensitive reproductions through [security reporting](SECURITY.md).

Review the complete diff and test the submitted revision with the latest `main`. Required CI must pass before merge. The current ruleset requires the GitHub Actions `Windows baseline` check from the expected integration and blocks deletion and non-fast-forward updates without bypass actors. Use a PR; direct pushes and shared-history rewrites are prohibited. Agents need explicit authorization for push, external PR creation, merge, publication or other [external effects](docs/ENGINEERING.md#14-external-effects).

## Licensing and attribution

Contributions follow the existing [Apache-2.0 license](LICENSE), [NOTICE](NOTICE), and [ADR-0004](docs/adr/0004-apache-license-and-trademark-policy.md). Contribute only material you have authority to submit and retain required third-party notices. Copyright remains with the applicable holder; no copyright assignment is required by default. ADR-0004 records the treatment of Contributions, submissions conspicuously marked `Not a Contribution`, and separate agreements. Project marks remain governed by [TRADEMARKS.md](TRADEMARKS.md).
