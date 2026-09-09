# ADR-0038: Cross-platform Community artifact lifecycle

- Status: Accepted
- Date: 2026-09-09

## Context and task contract

M3-S04 is integrated on `main` at `84921df`, the current queue records M3-S05 as `Ready`, `main` is synchronized at `30ab3ac`, and no open pull request, topic branch or active worktree claims the slice. M3-S05 is claimed on `feat/m3-s05-platform-lifecycle`.

Traceability is `M3-S05`, `FMU-FR-015`, `FMU-FR-016`, `FMU-FR-022`, `FMU-NFR-010`, `FMU-NFR-017`, `FMU-NFR-020`, the M3 platform/install/update/delete/uninstall gates, ADR-0028/0030/0034/0037, and Security T-10/T-11. No `FMU-E-*` is added because the slice exercises the already-evaluated Community workflow through installed artifacts without changing Claim or Response Policy meaning.

The observable result is a clean Windows, macOS and Linux CI job that installs exact private Protocol/Core/Community Provider artifacts, completes the synthetic local value loop, replaces one supported candidate set with another, reloads correction-preserving state, deletes managed state, uninstalls the packages and verifies that selected source and owner-retained export data remain. In scope are bounded candidate version generation, a lockfile-derived offline consumer, lifecycle verification, CI and synchronized documentation. Public schemas, source package versions, runtime semantics and dependencies remain unchanged. Application publication, registry access, release versions, real source/profile data, adapter packaging, automatic backup deletion and external effects are excluded.

## Decision

- Keep Protocol, Core and Community Provider as the only package candidates. The lifecycle consumer is test-only application composition copied into a temporary root; it imports only installed package exports and Node.js built-ins.
- Generate two exact private prerelease candidate graphs, `0.0.0-m3s05.0` and `0.0.0-m3s05.1`. Every internal package dependency uses the same candidate version. These labels exist only in ignored build artifacts; checked-in workspace manifests remain private `0.0.0`.
- Both candidates compile from the same reviewed source revision and differ only in package version metadata. Replacing the first lock with the second proves exact npm package transition and persisted Store compatibility; it does not claim migration between different implementations or establish a public support window.
- Derive each temporary consumer lock from the official production dependency closure and exact tarball file references, including integrity values. Run `npm ci --ignore-scripts --offline` for both installs. Registry resolution, lifecycle scripts, unlocked offline installation and repository source imports are rejected.
- Constrain the synthetic state root to a newly created marked task directory beneath the operating-system temporary root and reject a repository root before writing. Exercise first refresh, owner correction, task DCP, verified export, post-update Store diagnosis, correction-preserving refresh, task DCP and explicit managed deletion. The test application owns no adapter cache, so its injected cleanup succeeds only for the empty adapter set; dedicated Codex cache deletion remains covered by ADR-0028 tests.
- Run `npm uninstall --ignore-scripts --offline` for all three packages after managed deletion. Verify package dependencies are absent while the Store deletion barrier, selected source file and one explicit export remain.
- Add a fail-independent GitHub Actions matrix for `windows-latest`, `macos-latest` and `ubuntu-latest` using the pinned Node.js/npm toolchain, a clean root `npm ci --ignore-scripts`, the focused lifecycle gate and a minimized per-platform report. Existing Windows aggregate CI remains required.

## Consequences and validation

The platform gate tests filesystem, Git, tarball paths, npm file references, Store reload/deletion and package removal through each hosted operating system rather than extrapolating from Windows. The consumer and report contain only synthetic data and fixed labels; absolute roots, source content and canaries are rejected from the retained report. Temporary consumer/state roots are removed after each run.

Validation requires the focused lifecycle gate on the current platform, package-boundary unit coverage, formatting, documentation, lint, type checking, schema/unit/integration/evaluation checks, compatibility regression and one clean Windows checkout with an empty npm cache. Required pull-request CI must pass both `Windows baseline` and all three Community lifecycle matrix jobs before integration. Review the exact workflow revision and uploaded minimized reports. Until that evidence is green and the branch is integrated, the roadmap remains at M3-S05 `Ready`; no M3-S06 decision or public compatibility/publication claim is authorized.
