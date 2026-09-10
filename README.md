# Fork Me Up

Fork Me Up helps AI agents adapt their explanations to your technical background, so you spend less time repeating what you know and where you want guidance.

It builds a private profile from repositories you explicitly select and conclusions you can inspect and correct. For each task, a compatible agent receives only the relevant context in a small **Developer Context Packet (DCP)**.

## How it works

1. **Select evidence.** Choose the local repositories the system may read. Collection never runs their code or scripts.
2. **Review your profile.** Inspect the evidence behind a conclusion and correct or reject it.
3. **Use task context.** A compatible consumer receives a limited packet for a specific task, purpose and audience.

Missing evidence means uncertainty, not lack of knowledge. Your corrections take priority over automated conclusions, with their history preserved. A packet grants no permissions. Fork Me Up does not score seniority, employability or candidates.

The next product target is a guided workflow: confirm your identity, select a small relevant set of repositories, review the resulting overview and receive brief explanations connected to your experience. The [roadmap](docs/ROADMAP.md#15-current-m3-execution-queue) places a real owner trial before public release preparation.

See the [product rules](docs/PROJECT_SPEC.md) for how evidence, corrections and sharing work.

<a id="product-and-limits"></a>

## What is available

The Community development workflow runs locally without an account, a dedicated model API or a paid service. You can collect evidence, inspect and correct your profile, obtain task context, diagnose the installation, export data and delete managed local data. Optional owner-only public-history enrichment prefers local Git and can use an already authenticated `gh` installation for explicitly selected public repositories; it is read-only, temporary, disabled by default and never required for local use.

Packages are **private and unreleased**. Windows is the verified development platform. Codex is a reference adapter, and a separate generic consumer tests the same structured packet meaning. This does not establish compatibility with every agent or equivalent model-written answers. A guided skill, selected private GitHub reads and agent-assisted interpretation are planned; they are not available in this workflow yet.

The [roadmap](docs/ROADMAP.md#15-current-m3-execution-queue) is the source for completed work, the next eligible step and pending decisions. See [versioning and compatibility](VERSIONING.md) for technical limits.

## Start locally

Use Node.js **24.20.0**, its bundled npm **11.19.0**, Git and a full-history checkout. The history is required by the reproducible quality check.

```text
npm ci --ignore-scripts
npm run check
```

Then follow the [local Community guide](docs/LOCAL_COMMUNITY.md) to configure your repositories and run the workflow. The [owner guide](docs/OWNER_WORKFLOW.md) explains inspection, correction, diagnostics, export, import and deletion.

<a id="develop"></a>

## Develop with agents

Fork Me Up is developed by agents and provides context for agents. Product rules and user guides are written for people to understand and review. The core is independent of any client or model provider.

Agents start with [AGENTS.md](AGENTS.md). The [contribution guide](CONTRIBUTING.md) covers development setup and checks; the [documentation map](docs/README.md) locates the remaining references.

<a id="license-and-governance"></a>

## License and security

Repository content uses [Apache-2.0](LICENSE), with [NOTICE](NOTICE) and a separate [trademark policy](TRADEMARKS.md). Your profile data is not relicensed by using the software.

See [security reporting](SECURITY.md) and the [changelog](CHANGELOG.md).
