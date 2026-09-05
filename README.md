# Fork Me Up

> Portable, evidence-bounded developer context for AI tools.

Fork Me Up exists because developers repeatedly spend time and tokens explaining the same things to every AI tool: what they already know, where they want more guidance, which analogies are useful, and how much operational detail they need.

The project builds an inspectable developer profile from developer-approved repository evidence and explicit corrections. It then compiles only the task-relevant portion into a versioned Developer Context Packet (DCP) that compatible agents and harnesses can consume.

Fork Me Up does **not** claim to know everything a developer knows. It distinguishes demonstrated evidence, adjacent experience, self-declared information, corrections, and insufficient evidence. It does not produce a universal seniority or employability score.

## Product shape

Fork Me Up is designed as:

- an open protocol for portable developer context;
- a useful local Community runtime that does not require a hosted service;
- client-neutral integrations through MCP, files, and SDKs;
- an optional paid service for deeper multi-repository compilation, continuous refresh, private-repository connectivity, and controlled remote delivery.

The first reference adapter targets Codex because it provides MCP and lifecycle hooks. The core protocol and evidence model do not depend on Codex, a particular LLM, or any integration partner.

## Current status

M0 and M1 are complete, and M2 is in progress. The repository is public, and `main` requires pull requests and the GitHub Actions `Windows baseline` check while blocking deletion and non-fast-forward updates. Minimal private Protocol, Core, Community Provider, MCP, and Codex adapter workspaces validate synthetic fixture profiles, compile schema-valid redacted DCPs, and deliver allowlisted task guidance through non-blocking Codex lifecycle hooks. The [M1 exit audit](docs/audits/M1_EXIT_AUDIT.md) verifies the fixture-backed technical MVP and records its limits. M2 now has private bounded configuration and filesystem-metadata boundaries for canonical owner-selected local repositories. There is still no Git collector, source-backed Demand Profile producer, canonical profile persistence, owner CLI, release, second consumer, or general client-compatibility claim.

## Development foundation

The first declared and locally verified platform is Windows. Release support for Windows, macOS, and Linux remains a later gate.

Prerequisites:

- Node.js `24.20.0` (also recorded in `.nvmrc`);
- npm `11.19.0`, bundled with that Node.js release.

Install exactly the committed dependency graph without running dependency lifecycle scripts:

```text
npm ci --ignore-scripts
```

The root manifest declares native npm workspaces under `packages/*`, `apps/*`, and `adapters/*`. The private unreleased `@fork-me-up/protocol`, `@fork-me-up/core`, `@fork-me-up/community-provider`, `@fork-me-up/mcp-local`, and `@fork-me-up/codex-adapter` workspaces implement the current fixture-backed vertical slice. Protocol validates canonical exchange contracts, Core owns pure domain behavior, the Community Provider maps typed requests into bounded compilation, the MCP application maps two read-only tools onto `stdio`, and the Codex adapter maps only allowlisted fields into client-owned hook output. The permitted dependency direction is applications and reference adapters → Community provider → Core → Protocol. Public packages must never import proprietary Cloud/Pro modules.

The Community Provider also owns the M2 implementation-internal local source boundaries. Closed configuration resolves explicitly selected directories, rejects physical escape or duplicate aliases, and retains absolute paths only in the private owner-side authority. A sequential filesystem collector then recanonicalizes every path, ignores version-control/dependency state and nested repositories, reads only fixed bounded UTF-8 formats, and emits relative paths, hashes, sanitized manifest names, and structural counts without raw text. A separate Git collector manually resolves bounded local control files and runs only allowlisted plumbing against the authorized object database from a fresh trusted bare quarantine; repository configuration, attributes, hooks, filters, pagers, replace refs, lazy fetch, remotes, shell evaluation, and source writes are excluded. Its private immutable output contains bounded object relationships, UTC timestamps, identity digests, and safe changed paths, never raw identities or commit messages. Private developer identity configuration is immediately normalized to the same digests; a pure assessor distinguishes attributed, shared, coauthored, bot, pair-work, unknown, merge, and explicit squash conditions. A second pure boundary correlates those authentic results with filesystem/Git snapshots, exposes explicit and fixed-indicator fork/template/generated/vendor/tutorial/duplicate/uncertain risks, and down-ranks every flagged record without ever claiming that an unflagged source is original. Every isolated record remains unable to establish demonstrated depth. M2-S07 turns only normalized source-language records from that authentic chain into exact project-scoped Evidence and conservative Claims, with stable IDs, semantic fingerprints, injected freshness, and explicit invalidation; it does not interpret prose, dependencies, or arbitrary taxonomy input and never emits high confidence or demonstrated depth. A separate private Store boundary validates the existing internal `0.1.0` envelope and persists immutable generations through synced exclusive staging, atomic activation, readback, optimistic concurrency, rollback retention, deterministic recovery, and explicit synthetic migration. Any invalid configuration/snapshot/Store, authorization change, unsupported layout, exhaustion, conflict, or I/O failure aborts without partial source data and with a content-free error. None of these internal objects is a Profile Provider or Protocol payload.

Run the local synthetic MCP server with the default demonstrated fixture:

```text
npm run mcp
```

Development-only fixture selections are `demonstrated`, `adjacent`, `insufficient-evidence`, and `unavailable`; for example, `npm run mcp -- --fixture=adjacent`. The process speaks newline-delimited JSON-RPC on `stdin`/`stdout`, advertises only `get_task_context` and `get_profile_metadata`, and intentionally supports MCP revision `2025-11-25` only. It opens no listener and makes no network request. These fixtures prove the transport boundary, not production profile persistence or compatibility with every MCP client.

The checked-in Codex project hook exercises the real task/session lifecycle but selects the unavailable fixture by default, so merely trusting the repository cannot attribute synthetic expertise to a developer. Tests explicitly select synthetic Java, React/Angular, and GitHub Actions/CI profiles to prove delivery and unexpired restoration after resume or compaction. Codex will not run the non-managed hook until the project and exact hook definition are reviewed and trusted through `/hooks`. See the [adapter compatibility and security profile](adapters/codex/README.md); this reference does not prove portability to a second client.

Run the complete deterministic baseline:

```text
npm run check
```

The aggregate command fails fast across formatting, lint, strict type checking, unit tests, all draft schema and provider/conformance fixtures, MCP and Codex-hook subprocess integration tests, and behavioral evaluations. The unit and integration suites must never be empty. The evaluation suite executes FMU-E-001 through FMU-E-004, FMU-E-006, and FMU-E-012 through FMU-E-014, plus the M1-S06 three-mode adapter evaluation. The former integration `bootstrap-not-applicable` exception ended when the MCP process boundary was introduced.

The same aggregate command runs in a least-privilege Windows CI job for pull requests and pushes to `main`. The workflow uses immutable action revisions, read-only repository contents, disabled checkout credential persistence, the pinned Node.js version, and `npm ci --ignore-scripts`.

This baseline does not yet claim the complete pull-request fast gate. Draft contract validation runs through `npm run schema:check`; documentation links, secret scanning, dependency review, and broader platform coverage remain later gates. See the [draft contract and limits](docs/PROTOCOL.md#41-exact-draft-authoring-rules) and [object boundaries](docs/PROTOCOL.md#2-objects-and-boundaries). The root package stays private to prevent accidental publication, while all repository content remains licensed under Apache-2.0.

## Documentation

- [Product specification](docs/PROJECT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Developer Context Protocol](docs/PROTOCOL.md)
- [Security and privacy](docs/SECURITY_PRIVACY.md)
- [Engineering process](docs/ENGINEERING.md)
- [Roadmap](docs/ROADMAP.md)
- [M0 exit audit](docs/audits/M0_EXIT_AUDIT.md)
- [M1 exit audit](docs/audits/M1_EXIT_AUDIT.md)
- [Competitive landscape](docs/COMPETITIVE_ANALYSIS.md)
- [Decision records](docs/adr/)
- [Contributing guide](CONTRIBUTING.md)
- [Vulnerability reporting](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Versioning policy](VERSIONING.md)
- [Apache License 2.0](LICENSE)
- [Trademark policy](TRADEMARKS.md)

Repository instructions for coding agents are in [AGENTS.md](AGENTS.md).

## License and trademarks

Content in this repository is licensed under the [Apache License 2.0](LICENSE) unless a file states otherwise. See [NOTICE](NOTICE) for attribution. The license covers the public protocol, schemas, SDKs, Community runtime, adapters, examples, tests, and project documentation. Developer profiles and other user-owned data processed by Fork Me Up are not relicensed by using the software.

The separately operated Fork Me Up Cloud/Pro implementation may remain proprietary and is not included in this repository. The Fork Me Up name and visual identity are governed separately by the [trademark policy](TRADEMARKS.md).
