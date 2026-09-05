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

The first reference adapter may target Codex because it provides skills, MCP, and lifecycle hooks. The core protocol and evidence model must not depend on Codex, a particular LLM, or any integration partner.

## Current status

M0 is complete, and M1 is in progress. The repository is public, and `main` requires pull requests and the GitHub Actions `Windows baseline` check while blocking deletion and non-fast-forward updates. Minimal private Protocol and Core workspaces now validate and immutably load versioned synthetic fixture profiles for demonstrated, adjacent, and insufficient-evidence states. There is still no runnable application, response policy, DCP compiler, provider, transport, adapter, release, or compatibility claim. The draft schemas and explicitly internal Community Profile Store remain available as described by the [M0 exit audit](docs/audits/M0_EXIT_AUDIT.md).

## Development foundation

The first declared and locally verified platform is Windows. Release support for Windows, macOS, and Linux remains a later gate.

Prerequisites:

- Node.js `24.20.0` (also recorded in `.nvmrc`);
- npm `11.19.0`, bundled with that Node.js release.

Install exactly the committed dependency graph without running dependency lifecycle scripts:

```text
npm ci --ignore-scripts
```

The root manifest declares native npm workspaces under `packages/*`, `apps/*`, and `adapters/*`. M1-S01 introduces private unreleased `@fork-me-up/protocol` and `@fork-me-up/core` packages. Protocol validates the canonical profile-export contract, while Core depends only on Protocol and exposes the immutable fixture-profile loading boundary. The permitted dependency direction is applications and reference adapters → Community provider → Core → Protocol. Public packages must never import proprietary Cloud/Pro modules.

Run the complete deterministic baseline:

```text
npm run check
```

The aggregate command fails fast across formatting, lint, strict type checking, unit tests, all draft schema and provider/conformance fixtures, integration tests, and behavioral evaluations. The unit suite must never be empty. Integration and evaluation suites report a committed `bootstrap-not-applicable` exception only while their corresponding product boundary or behavior does not exist; each exception becomes an error as soon as matching tests are added.

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
