# ADR-0035: Protocol SDK and conformance distribution

- Status: Accepted
- Date: 2026-09-08

## Context and task contract

M3-S01 is integrated and M3-S02 is the earliest eligible unclaimed slice. The package dry-run fixes the Community library boundary but deliberately creates no installable artifact and exports no schemas, fixtures or executable conformance surface. Independent consumers need one exact local Protocol artifact before cross-client behavior can be tested.

Traceability is `M3-S02`, `FMU-FR-009`, `FMU-FR-010`, `FMU-FR-023`, `FMU-NFR-001`, `FMU-NFR-009`, `FMU-NFR-017`, ADR-0005/0011/0012/0034 and the M3 public SDK/protocol/conformance deliverable. No `FMU-E-*` applies because this slice distributes the existing draft contracts and validation behavior; it does not add the materially different consumer required by `FMU-E-016`.

The observable result is a locally installable, still-private `@fork-me-up/protocol` tarball whose explicit package exports expose typed SDK entry points, every public draft schema, every public contract fixture and executable Profile Provider transcript conformance validation. A clean temporary consumer installs the tarball offline after the locked repository install, imports only package subpaths, accepts exact `0.1.0` examples and rejects unsupported versions.

In scope are the Protocol package, generated local artifact, exact public asset allowlist, conformance types/runtime, installation smoke test and synchronized documentation. Public schema meaning, Core or Community Provider artifacts, a second consumer, application installation, cross-platform claims, release versions, migration, registry access, publication, checksums, SBOM and provenance are excluded. Local ignored artifacts and deterministic checks are allowed; stop before push, merge, publication or another external effect.

## Decision

- `npm run package:protocol` reuses the bounded M3-S01 compilation staging, then expands only the Protocol candidate. It creates `build/protocol-package/fork-me-up-protocol-0.0.0.tgz` plus a package-relative inspection report and removes transient staging.
- The manifest remains `0.0.0`, `private: true` and unpublished, with no lifecycle scripts or `publishConfig`. The existing exact Ajv dependency and Node/npm support range are unchanged.
- The root SDK and `./conformance/profile-provider` expose ECMAScript plus declarations through explicit `import` and `types` conditions. Every public schema and every JSON fixture receives an exact export subpath. The dedicated internal Store schema/corpus and development-only Developer Profile fixture carriers are excluded.
- The public conformance function validates the accepted transcript schema and cross-record Provider semantics: correlation, advertised operations, typed errors, capabilities, limits, DCP meaning and evidence subsets. The repository schema checker delegates to that same SDK function so development and distributed validation cannot drift.
- The distributed draft support set is exactly `0.1.0`. Top-level schema versions, Provider envelopes and conformance transcripts fail closed when changed to unsupported values. This is tested draft support, not a released compatibility promise.
- `package:protocol` is part of the aggregate. Integration creates a fresh temporary npm consumer, derives its exact production dependency closure from the repository lockfile, installs the tarball with `npm ci`, lifecycle scripts disabled and offline cache use, imports SDK/schemas/fixtures/conformance only through package exports, and removes the consumer afterward.

## Consequences and validation

An independent consumer can now install and exercise one client-neutral Protocol artifact without repository-relative imports or access to Core, Community Provider, adapters or private Store data. Exact exports make accidental asset growth or internal-boundary exposure visible. The tarball is local build output, so release reproducibility, signing and publication remain later M3 gates.

Validation requires the pinned Node.js `24.20.0` and npm `11.19.0`, focused SDK/allowlist/version/install tests, independent repository-inventory equality, external TypeScript consumer resolution, the final aggregate, one clean lockfile-enforced checkout, artifact inspection and a point-in-time dependency audit. Review the complete diff and generated report for internal paths, lifecycle scripts, private fixture families and accidental contract changes. Required pull-request CI and human review remain pending until the branch is proposed and integrated.
