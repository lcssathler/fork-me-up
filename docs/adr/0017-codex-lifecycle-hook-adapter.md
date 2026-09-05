# ADR-0017: Codex lifecycle-hook reference adapter

- Status: Accepted
- Date: 2026-09-05

## Context and task contract

M1-S05 is integrated on protected remote `main` at `e5f7eb1` through pull request #18, its topic branch is deleted, and M1-S06 is the earliest eligible unclaimed slice. This task is claimed by `feat/m1-s06-codex-adapter` after authenticated readback found no open pull request or competing remote branch.

Traceability: `M1-S06`, `FMU-FR-012`, `FMU-FR-025`, `FMU-NFR-001`, `FMU-NFR-008`, `FMU-E-014`, PROJECT_SPEC Sections 5.1, 13, and 15, PROTOCOL Sections 5.6, 7, 9, 11, and 13, ARCHITECTURE Sections 3.3, 7, 10, and 11, SECURITY_PRIVACY T-10 and T-12, and ADR-0002/0011/0015/0016.

The observable result is a real Codex reference adapter whose repository-local lifecycle configuration delivers minimized task guidance on `UserPromptSubmit`, restores the last still-valid minimized guidance on `SessionStart` after resume or compaction, and emits no context while returning successful continuation when the optional Provider, cache, input, or adapter is unavailable. Automated tests exercise the command boundary with only synthetic fixtures.

In scope are a private unreleased Codex adapter workspace, project-local hook configuration, deterministic capability matching for the four M1 fixture capabilities, a bounded ephemeral session cache, task/session/compaction integration coverage, `FMU-E-014`, compatibility documentation, and synchronized architecture/engineering/roadmap status. Hard constraints are no Codex type or lifecycle dependency in Protocol/Core/Provider, no network request/listener, no source inspection, no arbitrary profile or state path, no raw task/profile/free-text promotion, no new external dependency, no authorization interpretation, no client-wide compatibility claim, no release, and no publication. Local files, a short-lived branch, tests, an authorized pull request, and authorized squash integration are allowed. Stop on a public-contract change, unsafe context or cache content, network requirement, ownership conflict, unresolved high-severity finding, or failure of protected CI.

## Decision

- Use Codex as the first reference client outside Protocol and Core. The adapter depends on the client-neutral Community Provider and Protocol packages; no lower layer imports the adapter.
- Integrate through checked-in Codex command hooks. `UserPromptSubmit` requests task context. `SessionStart` handles startup, resume, clear, and the documented post-compaction `compact` source. Hooks require the client's normal project trust and explicit hook review; the adapter does not bypass either control.
- Infer only the M1 fixture taxonomy through fixed case-insensitive matchers and pass the original bounded prompt to the Provider only as unprivileged task data. Unknown or oversized prompts produce no context. This is a fixture reference path, not general demand inference.
- Select the explicit unavailable fixture in the discovered hook configuration. Tests and deliberate demonstrations may choose a synthetic fixture by exact command-line allowlist, but simply trusting the project must not attribute fixture capabilities to a real developer.
- Validate every Provider response again at the consumer boundary and require matching operation and correlation. Map only Claim capability/state/observed-depth identifiers and the six closed Response Policy fields: mode, three command-guidance booleans, analogy capability identifiers, and question budget. Never promote task summaries, limitations, rationales, correction text, extensions, paths, errors, or other free text into developer context.
- Render context from fixed adapter-owned templates, sort identifier-bearing values, bound the rendered UTF-8 size, and add a fixed reminder that context is advisory and grants no permission. No Provider or repository string selects template text.
- Cache only the already minimized rendered context plus its DCP expiry, keyed by a one-way hash of the bounded Codex session identifier. Use the operating-system temporary directory, restrictive POSIX modes where supported, regular-file and symlink checks, atomic replacement, and strict byte/schema bounds. Clear previous state before every task request and on a clear session. The cache contains no prompt, full DCP, profile, Evidence, path, or credential.
- Treat malformed input, cache read/clear failure, Provider failure, incompatible response, budget failure, unavailable profile, unrecognized task, and internal adapter failure identically at the host boundary: emit a valid non-blocking hook result with `continue: true`, suppress incidental output, add no context, and exit successfully. A cache write failure may still deliver the current validated projection after prior state was cleared, but no later restoration is claimed. Graceful degradation never converts a failed security decision into disclosure.
- Use the Codex-documented `SessionStart` compact source rather than `PostCompact`, because `SessionStart` can add context to the immediate continuation after automatic or manual compaction while `PostCompact` stdout cannot add context. Restore only unexpired cached context.

## Consequences and alternatives

M1 gains a concrete client lifecycle integration without making Codex the product boundary. Known synthetic tasks receive task-scoped behavioral guidance, resumed or compacted sessions can recover the last valid minimized projection, and every optional failure leaves normal Codex work available. The command hook remains offline and opens no listener.

Compatibility is intentionally narrow: Codex project hooks with `SessionStart` and `UserPromptSubmit`, Provider/DCP `0.1.0`, Node.js 24.20.0, and the four M1 fixture capabilities. Project hooks are inactive until the user trusts the exact checked-in definition. Startup can occur before other MCP servers are ready, but this adapter invokes the in-process local Provider and does not depend on MCP readiness. The ephemeral cache is a delivery convenience, not a canonical profile store, and can disappear at any time.

Putting lifecycle types in Core, reading an unstable transcript to recover task text, injecting the complete DCP, copying free-form fields into instructions, silently retaining expired context, blocking a user prompt on optional failure, opening a local service, and adding an external Codex SDK are rejected. An MCP tool hook is also deferred: a command hook can validate and transform the Provider result before model visibility while preserving a directly testable fail-open host contract.

## Validation

Run the pinned Windows Node.js/npm path and `npm run check`. Unit coverage validates exact event inputs, capability matching, consumer-side response validation, the field allowlist, fixed rendering, byte limits, cache expiry/clear behavior, and all degraded states. Integration coverage launches the real command for task delivery, cross-process compaction restoration, clear-session removal, unavailable Provider behavior, bounded input, canary/path exclusion, and checked-in hook configuration. Behavioral evaluation proves all three Response Policy modes retain their required intent and `FMU-E-014` proves Provider/adapter unavailability does not block ordinary host work or disclose stale context. Review workspace dependencies, cache contents, hook trust requirements, absence of network code, full diff, and a zero-vulnerability audit. Protected pull-request CI must pass before integration; proposed queue transitions become authoritative only after merge to `main`.

Official capability references used for this decision: [Codex hooks](https://learn.chatgpt.com/docs/hooks), [Codex skills](https://learn.chatgpt.com/docs/build-skills), and [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
