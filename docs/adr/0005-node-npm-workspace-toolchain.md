# ADR-0005: Node.js and npm workspace toolchain

- Status: Accepted
- Date: 2026-09-04

## Context

M0 requires a reproducible package foundation before protocol schemas or product behavior are implemented. The repository needs exact development versions, a separately declared public runtime range, minimal workspace boundaries, a committed lockfile, and one clean-install path. The decision must preserve the client-neutral Protocol/Core boundary and the separation between public Community code and proprietary Cloud/Pro code without scaffolding later slices prematurely.

The first declared platform is Windows because it is the environment available for the initial clean-checkout verification. Windows, macOS, and Linux remain release targets; support for the broader matrix is not claimed until those checks exist.

## Decision

- Development and CI use Node.js `24.20.0` and npm `11.19.0`. The official Node.js `24.20.0` distribution bundles npm `11.19.0`.
- Public packages initially support Node.js `>=24.20.0 <25`. The exact development version remains pinned separately in `.nvmrc` and `devEngines`.
- npm is the selected package manager and is pinned through `packageManager`, `devEngines`, the npm engine, and the committed lockfile. Corepack is not part of the selected toolchain because the pinned Node.js distribution already includes the selected npm version; therefore no separate Corepack version or shim is required.
- The repository uses native npm workspaces rooted at `packages/*`, `apps/*`, and `adapters/*`. Empty product packages are not created by this decision.
- Dependency direction is applications and reference adapters → `community-provider` → `core` → `protocol`, where each arrow points to a permitted dependency. Protocol imports no product package; Core imports only Protocol; client- and transport-specific types stay outside Protocol and Core. Automated enforcement starts when the first workspace package exists.
- The root package uses native ECMAScript modules and remains `private` to prevent accidental publication. `private` is a package-publication safeguard, not a license restriction: public repository content remains licensed under Apache-2.0 according to ADR-0004.
- Cloud/Pro implementation code remains outside these public workspaces in a separately controlled repository or workspace. Public packages must not import proprietary modules.
- Dependency lifecycle scripts are disabled by default. A clean checkout installs the committed dependency graph with `npm ci --ignore-scripts`; intentional dependency changes use exact versions and require focused manifest and lockfile review.

Formatter, lint, strict type-checking, test-runner, aggregate-check, and CI configuration belong to M0-S05 and are deliberately excluded from this decision's implementation diff. A JSON Schema validator remains deferred to the schema slice that first needs it.

## Traceability

- Milestone slice: `M0-S04` — Toolchain/workspace decision and package foundation.
- Requirement: `FMU-NFR-017`.
- Architecture: `ARCHITECTURE.md` Section 10 and ADR-0002.
- Community/Cloud and licensing boundaries: ADR-0001 and ADR-0004.
- Security and delivery: `SECURITY_PRIVACY.md` T-11 and `ENGINEERING.md` Sections 4 and 9.
- Behavioral evaluations: no `FMU-E-*` applies because this slice creates only repository and toolchain foundations, not product behavior.

## Consequences

### Positive

- A clean checkout has one documented, lockfile-enforced setup path.
- Exact development pins are distinct from the supported public runtime range.
- Native npm workspaces define package boundaries without adding a monorepo orchestrator or empty product architecture.
- The public package foundation carries the adopted Apache-2.0 license while preventing accidental root-package publication.

### Negative

- Only Windows is verified in this slice; release-platform coverage remains incomplete.
- Exact development pins require intentional maintenance updates even within Node.js 24.
- npm workspaces do not enforce dependency direction until packages and the corresponding M0-S05 checks exist.
- The package foundation has no formatter, linter, type checker, test runner, or CI gate until M0-S05 is integrated.

## Rejected alternatives

- **Reuse ADR-0004:** rejected because ADR-0004 already records the accepted Apache-2.0 and trademark decision.
- **Include M0-S05 checks and CI:** rejected because M0-S05 is blocked until this slice is integrated and must remain a separate observable outcome.
- **Add Nx, Turborepo, pnpm, Yarn, or Corepack shims:** deferred because native npm workspaces and the npm bundled with the pinned Node.js release satisfy the current foundation with less tooling.
- **Create empty workspace packages:** rejected because package structure should follow working vertical slices rather than speculative scaffolding.

## Validation

This decision is validated when the manifest, lockfile, `.nvmrc`, and `.npmrc` agree on the selected toolchain and policy; a clean Windows checkout at the target revision succeeds with Node.js `24.20.0`, npm `11.19.0`, and `npm ci --ignore-scripts`; the resulting dependency tree is empty; the documented workspace and dependency boundaries agree with the architecture; and the complete diff contains no M0-S05 tooling or Cloud/Pro implementation.
