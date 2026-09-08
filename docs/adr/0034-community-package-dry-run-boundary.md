# ADR-0034: Community package dry-run boundary

- Status: Accepted
- Date: 2026-09-08

## Context and task contract

M2 is complete and M3-S01 is the earliest eligible unclaimed slice. It must fix the public package boundary before later work distributes SDKs, conformance assets, applications or a release. The observable result is a deterministic local dry-run that compiles and inspects unpublished candidates without exposing repository layout or silently granting publication authority.

Traceability is `M3-S01`, `FMU-NFR-001`, `FMU-NFR-009`, `FMU-NFR-017`, `FMU-NFR-018`, ADR-0005 and the Engineering package/release gates. No `FMU-E-*` applies because this slice changes packaging and supply-chain verification, not Claim meaning or consumer behavior.

In scope are the existing client-neutral Protocol, Core and Community Provider workspaces, generated build output, exact content allowlists, local npm pack inspection, tests and synchronized documentation. Package publication, release versions, registry access, install/update/uninstall claims, public schema/conformance exports, application packaging, dependency changes and contract semantics are excluded.

## Decision

- The package candidates are exactly `@fork-me-up/protocol`, `@fork-me-up/core` and `@fork-me-up/community-provider`, preserving Community Provider → Core → Protocol dependency direction. The root stays private. `apps/mcp-local` remains repository-only because its current entry point embeds development fixtures; `adapters/codex` remains a client-specific reference adapter. Application distribution belongs to later M3 install/consumer slices.
- `npm run package:dry-run` copies only an explicit source allowlist into a fixed, bounded staging root, compiles ECMAScript plus declarations with the pinned TypeScript toolchain and removes staging inputs/configuration before inspection. Protocol receives only the six schema files required by its current validators, relocated in staging so compiled imports are package-local. Source TypeScript, source maps, tests, fixtures, scripts, adapters, configuration and repository metadata are excluded.
- Generated candidate manifests retain version `0.0.0` and `private: true`, declare the existing Node/npm range, Apache-2.0 license, exact runtime dependencies and only the `dist/index.js`/`dist/index.d.ts` root entry point. They contain no lifecycle or publication script and no `publishConfig`.
- Each candidate runs `npm pack --dry-run --json --ignore-scripts`. Its file set must exactly match the derived path allowlist and stay within entry/byte ceilings. Results contain only package-relative paths, sizes, modes, entry points, dependency versions and npm hashes; the repository path is rejected. Transient compiled trees are removed and deterministic reports remain under ignored `build/package-dry-run/`.
- A dry-run report is inspection evidence, not an installable or published release. M3-S02 owns locally installable Protocol SDK/schema/fixture/conformance distribution, M3-S05 owns application installation and removal, M3-S09 owns release-candidate supply-chain evidence, and M3-S10 retains explicit publication authorization.

## Consequences and validation

The repository gains an executable publication safeguard and catches accidental package-content growth before a registry is involved. Exact source lists add maintenance when a package file is added, intentionally forcing review of its distribution status. Compiling three candidates adds bounded local/CI time. npm-generated hashes are retained as deterministic comparison evidence but are not release checksums or provenance.

Validation requires the pinned Node.js `24.20.0` and npm `11.19.0`, focused allowlist/path/determinism tests, the final aggregate, and one clean lockfile-enforced checkout running the dry-run. Review generated reports for private state, exact package-relative contents, absence of internal files and stable repeated bytes. No registry, network source, tarball, tag, release or external write is authorized.
