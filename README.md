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

The project is in pre-implementation design. There is no runnable product yet. The current work defines the product boundary, open protocol, security invariants, engineering process, and risk-driven roadmap before code is written.

## Documentation

- [Product specification](docs/PROJECT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Developer Context Protocol](docs/PROTOCOL.md)
- [Security and privacy](docs/SECURITY_PRIVACY.md)
- [Engineering process](docs/ENGINEERING.md)
- [Roadmap](docs/ROADMAP.md)
- [Competitive landscape](docs/COMPETITIVE_ANALYSIS.md)
- [Decision records](docs/adr/)
- [Apache License 2.0](LICENSE)
- [Trademark policy](TRADEMARKS.md)

Repository instructions for coding agents are in [AGENTS.md](AGENTS.md).

## License and trademarks

Content in this repository is licensed under the [Apache License 2.0](LICENSE) unless a file states otherwise. See [NOTICE](NOTICE) for attribution. The license covers the public protocol, schemas, SDKs, Community runtime, adapters, examples, tests, and project documentation. Developer profiles and other user-owned data processed by Fork Me Up are not relicensed by using the software.

The separately operated Fork Me Up Cloud/Pro implementation may remain proprietary and is not included in this repository. The Fork Me Up name and visual identity are governed separately by the [trademark policy](TRADEMARKS.md).
