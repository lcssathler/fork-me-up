# ADR-0037: Community artifact compatibility matrix

- Status: Accepted
- Date: 2026-09-08

## Context and task contract

M3-S03 is integrated on `main` at `8742aad` through PR #40, its local topic branch is deleted after content-equivalence verification, and M3-S04 is the earliest eligible unclaimed slice. This task is claimed by `feat/m3-s04-compatibility-matrix`.

Traceability is `M3-S04`, `FMU-FR-009`, `FMU-FR-015`, `FMU-FR-023`, `FMU-NFR-009`, `FMU-NFR-020`, the M3 tested import/export and compatibility deliverable, ADR-0009/0023/0028/0034 through 0036, and Security T-06/T-10/T-11/T-12. The observable result is an isolated consumer that installs exact local Protocol, Core and Community Provider artifacts and passes a deterministic compatibility matrix for Provider, DCP, Portable Profile Export and private Store behavior.

In scope are private local tarballs for the existing three package candidates, lockfile-derived offline installation, supported and unsupported draft behavior, owner export/import round trip, verified update/conflict, explicit synthetic legacy migration, prior-generation recovery, boundary rejection, tests and synchronized documentation. Public schemas, package versions, runtime semantics and dependencies remain unchanged. Cross-platform application install/update/uninstall, registry publication, release metadata, real profile/source access, network use and owner-data deletion are excluded. Local synthetic artifacts and temporary directories are allowed; stop on Store exposure as interchange, unverified persistence, hidden compatibility failure, private path/content disclosure, dependency or license change, or an external effect.

## Decision

- `npm run package:community` reuses the bounded M3-S01 compilation boundary and emits three private, unpublished, locally installable `0.0.0` tarballs. Protocol alone receives the already accepted public schemas and fixtures; Core and Community Provider expose only their compiled root entry points. Exact file allowlists, no lifecycle/publication scripts, size ceilings and package-relative reports remain enforced.
- `npm run compatibility:check` creates a fresh temporary consumer whose only dependencies are those three exact tarballs. It derives the external production closure from the official root lockfile and runs `npm ci --ignore-scripts --offline`; it does not use an unlocked offline install or resolve an internal package from a registry. Windows file references use `file:C:/...` form.
- The installed artifacts must accept Provider `0.1.0` capabilities and reject unsupported operation/version cases; accept the DCP and Portable Profile Export `0.1.0` fixtures and reject unsupported versions; and load the public Export through Core without repository imports.
- The owner matrix imports into an absent Store, exports through exclusive verified creation, imports that artifact into another absent Store and preserves the typed Claim/correction graph. A repeated import and a stale expected-generation update fail with explicit conflicts, while a correctly versioned update commits.
- Store compatibility remains provider-internal. The matrix requires an explicit `0.0.0` synthetic migration before activation, proves a malformed higher generation recovers the prior valid generation, and rejects Store, Export and DCP envelopes at one another's boundaries. Reports contain only package identifiers and closed case/result labels.
- The evidence is bounded to Node.js/npm and the current local platform. M3-S05 retains clean Windows/macOS/Linux application installation, candidate-to-candidate update, deletion and uninstall. M3-S08 retains the public compatibility table, and M3-S10 retains publication authorization.

## Consequences and alternatives

The package graph is now executable as artifacts rather than only compiled staging, and portability/migration promises are checked against what a consumer installs. The matrix deliberately keeps all three tarballs as root dependencies so npm can satisfy the private `0.0.0` graph from exact local artifacts while external packages come from the official lock closure.

Publishing the Store schema, treating Store files as backup/interchange, using repository source imports, accepting future versions, performing implicit migration, overwriting an occupied Store, using `npm install --offline` without a consumer lock, bundling registry dependencies, or claiming cross-platform/application compatibility is rejected. These choices would weaken an accepted boundary or anticipate later gates.

## Validation

Use the pinned Node.js 24.20.0/npm 11.19.0 environment. First prove the focused integration red before implementation and green afterward. Then reproduce CI from a clean worktree with an empty npm cache: root `npm ci --ignore-scripts`, artifact creation, isolated consumer installation/matrix, and only then one complete `npm run check`. Cover exact tarball contents/manifests, offline lock closure, seven matrix cases, content-free reports, temporary cleanup, formatting, lint, type checking, documentation links, schemas, unit/integration/evaluation suites and dependency audit. Review the complete diff and CI for the reviewed revision before integration; roadmap transitions become authoritative only after lead review and integration into `main`.
