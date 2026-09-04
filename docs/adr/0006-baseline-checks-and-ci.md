# ADR-0006: Baseline checks and least-privilege CI

- Status: Accepted
- Date: 2026-09-04

## Context

M0-S04 established the exact Node.js/npm toolchain, workspace roots, lockfile, and clean-install command while deliberately deferring formatter, lint, strict type checking, tests, aggregate verification, and CI. M0-S05 must add only that deterministic baseline. It must not introduce protocol schemas, product behavior, Cloud dependencies, publication, or later repository-governance controls.

The repository has no runtime package yet. Unit-test infrastructure still needs executable coverage, while integration and behavioral-evaluation boundaries do not exist and must be represented honestly rather than by silently passing empty suites.

## Decision

- Prettier `3.9.6` formats and checks JSON, JSONC, YAML, JavaScript, and TypeScript configuration and source files. Normative Markdown remains outside automated formatting to avoid unrelated prose churn.
- ESLint `10.9.1`, `@eslint/js` `10.0.1`, and `typescript-eslint` `8.69.0` provide a zero-warning lint baseline.
- TypeScript `6.0.3` and `@types/node` `24.13.3` check TypeScript plus the repository's JavaScript tooling with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and no skipped library checks. Emission is disabled.
- Tests use the Node.js built-in test runner, avoiding another test-runner dependency. The unit suite is required to contain tests. Empty integration and evaluation suites require bounded, committed `bootstrap-not-applicable` entries with explicit ending conditions; an entry fails once its suite gains a test.
- `npm run check` invokes `format:check`, `lint`, `typecheck`, `test`, `test:integration`, and `eval` in a fixed fail-fast order through the pinned npm executable.
- CI runs the aggregate check on `windows-latest`, the first platform declared by ADR-0005, for pull requests and pushes to `main`. Workflow permissions are limited to `contents: read`; checkout credentials are not persisted; action revisions are immutable commit SHAs; the job has a time limit; installation uses `npm ci --ignore-scripts`.
- The aggregate check is deterministic and does not include a live vulnerability audit. Schema validation, documentation-link checks, secret scanning, dependency review, vulnerability analysis, license checks, and the wider operating-system matrix remain explicit later gates.

## Traceability

- Milestone slice: `M0-S05` — Baseline checks and CI skeleton.
- Requirements: `FMU-NFR-011` and `FMU-NFR-017`.
- M0 gates: deterministic checks and clean installation on the first declared platform.
- Toolchain and workspace boundary: ADR-0005.
- Security and delivery: `SECURITY_PRIVACY.md` T-11 and `ENGINEERING.md` Sections 4, 6, 8, 9, and 13.
- Behavioral evaluations: no `FMU-E-*` applies because this slice establishes only development and CI controls, not product behavior.

## Consequences

### Positive

- Local and CI verification use one aggregate command and the same committed dependency graph.
- Empty product-level suites are visible, bounded bootstrap exceptions instead of implicit successes.
- CI can inspect private-safe M0 changes without write permissions or persisted checkout credentials.
- Exact development dependencies keep the lockfile and future updates reviewable.

### Negative

- Only Windows is exercised by this CI slice.
- The temporary integration and evaluation exceptions require removal as soon as their ending conditions occur.
- The baseline is intentionally incomplete until later M0 slices add schema, documentation, secret, dependency, vulnerability, and license checks.
- Formatting does not enforce Markdown style.

## Rejected alternatives

- **Reuse ADR-0004 or ADR-0005:** rejected because those records already govern licensing and the Node.js/npm workspace foundation respectively.
- **Import the historical toolchain branch wholesale:** rejected because it predates the accepted license decision and contains dependency-policy, audit, and documentation changes outside M0-S05.
- **Add a third-party test runner:** rejected because the built-in Node.js runner satisfies the current empty-product baseline with less supply-chain surface.
- **Let empty suites pass silently:** rejected because it hides missing verification and conflicts with the bootstrap-exception process.
- **Include live audit or later fast-gate controls in `npm run check`:** rejected because they are non-deterministic, require additional decisions, or belong to later slices.

## Validation

This decision is validated when an exact-toolchain clean checkout succeeds with `npm ci --ignore-scripts`; every individual command and `npm run check` pass; unit tests assert the strict compiler options, manifest/lockfile agreement, aggregate order, suite-exception behavior, immutable actions, and least-privilege workflow; and the complete diff contains no license regression, Cloud dependency, schema, or product behavior.
