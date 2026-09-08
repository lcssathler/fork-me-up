# Fork Me Up

> Portable, evidence-bounded developer context for AI tools.

Fork Me Up reduces repeated explanations of your technical background. It builds an inspectable private profile from explicitly selected local repository evidence and your corrections, then compiles a small task-relevant Developer Context Packet (DCP) for compatible consumers.

Evidence remains bounded: demonstrated observations, adjacent experience, declarations, disputes and insufficient evidence stay distinct. A DCP is advisory and grants no permissions. The project produces no seniority, hiring or employability score.

## Product and limits

The public Community runtime works locally without an account, dedicated model API or proprietary service. Protocol and Core are client-neutral; Codex is a reference adapter. Owner operations collect, inspect, correct, diagnose, export, import and delete managed local data. A separate Store-backed MCP process serves minimized read-only context.

The current development setup is verified on Windows with local MCP `stdio` revision `2025-11-25`. Packages remain private and unreleased; `npm run package:dry-run` inspects three client-neutral candidates, `npm run package:protocol` creates the Protocol SDK/schema/fixture/conformance candidate, and `npm run compatibility:check` installs exact Protocol/Core/Community Provider tarballs into an isolated lockfile-derived offline consumer to verify import/export, version, migration and recovery boundaries. Codex and the stateless [generic conformance consumer](consumers/generic/README.md) preserve the same structured DCP Claim/Response Policy meaning in synthetic tests. Other platforms, clients and release capabilities are claimed only after their roadmap gates pass.

See the [roadmap and current queue](docs/ROADMAP.md#15-current-m3-execution-queue) for authoritative status, the [evidence method](docs/EVIDENCE_METHOD.md) for interpretation limits and the [M2 exit audit](docs/audits/M2_EXIT_AUDIT.md) for the local workflow evidence.

## Start locally

Use Node.js **24.20.0**, its bundled npm **11.19.0**, and Git. A full-history checkout is required by the frozen M2 measurement.

```text
npm ci --ignore-scripts
npm run check
```

Follow the [local Community guide](docs/LOCAL_COMMUNITY.md) to configure selected repositories and run the owner and Store-backed MCP modes. The [owner guide](docs/OWNER_WORKFLOW.md) covers correction, portability, diagnostics and deletion.

For a development-only synthetic MCP process:

```text
npm run mcp
```

Fixture selections are `demonstrated`, `adjacent`, `insufficient-evidence` and `unavailable`. They exercise transport behavior. The [Codex adapter](adapters/codex/README.md) documents its separate lifecycle hooks and explicit trust requirements; checked-in hooks default to unavailable.

## Develop

Use the [documentation map](docs/README.md) and [AGENTS.md](AGENTS.md) to select the relevant reading. The [contribution guide](CONTRIBUTING.md) documents setup, verification and review.

`npm run check` runs the full deterministic baseline, including document checks, schemas, unit/integration tests, behavioral evaluations and the frozen M2 integration. For prose-only edits, the [verification matrix](docs/ENGINEERING.md#24-verification) selects the smaller local check; required PR CI still runs the full baseline.

The [quality results](docs/evaluations/M2_QUALITY_RESULTS.md) explain standalone reproduction and its synthetic limits. Detailed implementation descriptions from M2 are preserved in the [historical development baseline](docs/history/README_M2_BASELINE.md).

## License and governance

Public repository content is [Apache-2.0](LICENSE), with [NOTICE](NOTICE) and a separate [trademark policy](TRADEMARKS.md). Profiles and other user-owned data are not relicensed by using the software. The optional Cloud/Pro implementation may remain proprietary and is not included here.

See [security reporting](SECURITY.md), [versioning](VERSIONING.md), [changelog](CHANGELOG.md) and the [decision index](docs/adr/README.md).
