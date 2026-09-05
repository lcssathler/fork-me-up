# Codex reference adapter

This private M1 workspace is the first client adapter for Fork Me Up. It consumes the client-neutral Provider `0.1.0` contract and emits Codex lifecycle-hook output; Protocol, Core, and the Provider do not depend on it.

## Compatibility profile

| Concern | Supported behavior |
|---|---|
| Client | Codex project hooks documented on September 5, 2026 |
| Delivery | Repository-local command hook; no network request or listener |
| Lifecycle | Task delivery on `UserPromptSubmit`; restoration on `SessionStart` with `resume` or `compact`; removal on `startup` or `clear` |
| Contracts | Profile Provider and DCP `0.1.0` |
| Runtime | Node.js `24.20.0` and npm `11.19.0` |
| Authentication | Local operating-system user plus Codex project/hook trust; no token |
| Input/output | 65,536-byte hook input, 1,024-byte Provider task, 8,192-byte rendered context |
| Demand inference | Fixed synthetic M1 vocabulary only: Java, React, Angular, and GitHub Actions/CI |

The checked-in [hook configuration](../../.codex/hooks.json) selects `--fixture=unavailable`, so trusting it cannot attribute a synthetic capability to the current developer. Automated tests explicitly select each synthetic fixture to exercise delivery. A deliberate local demonstration may change both hook commands to one of `demonstrated`, `adjacent`, or `insufficient-evidence`, then review and trust the changed definition through `/hooks`; synthetic fixtures must not be treated as a real developer profile. Do not use a hook-trust bypass flag for normal operation. See the official [Codex hooks documentation](https://learn.chatgpt.com/docs/hooks).

The adapter is intentionally a fixture reference, not a production profile integration or a portability proof. The local MCP server remains a separate consumer-neutral delivery surface; this hook calls the same Community Provider boundary in-process so it can validate and minimize data before anything becomes model-visible.

## Data boundary

Only these validated fields can affect emitted context:

- Claim `capability`, `state`, and `observedDepth` identifiers/enums.
- Response Policy `mode`, `explainPurposeBeforeCommands`, `includeExpectedResult`, `includeRiskAndRollback`, `analogyCapabilities`, and `questionBudget`.

The renderer owns every sentence. It never includes task summaries, limitations, rationale, correction text, extensions, Provider errors, paths, or profile/evidence records. The session cache stores only the same structured allowlist and the DCP expiry under a hash of the bounded session identifier in the operating-system temporary directory. Cache files are bounded, atomically replaced, rejected when symlinked or malformed, and mode-restricted where the operating system supports POSIX modes.

## Degraded operation

Malformed or oversized hook input, an unknown task, an unavailable or incompatible Provider, an invalid/expired packet, and cache read/clear failure all produce the same successful non-blocking result with no additional context. A cache write failure still permits the current validated task projection but disables later restoration. No optional failure blocks the prompt, changes permissions, or exposes an error payload.

The behavior and trade-offs are recorded in [ADR-0017](../../docs/adr/0017-codex-lifecycle-hook-adapter.md).
