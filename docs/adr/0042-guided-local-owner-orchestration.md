# ADR-0042: Guided local owner orchestration

- Status: Accepted
- Date: 2026-09-21

## Context

M3-S12 implements FMU-FR-031/036, UC-17 and FMU-E-019 under ADR-0041. Existing owner commands already collect, inspect and persist corrections; the Store-backed MCP already serves read-only context. The missing boundary is a discoverable guided workflow and honest live-client verification.

## Decision

Use a repository-local Codex skill to orchestrate the trusted first-party owner CLI under explicit conversation scope. Record selected sources, exact identity, private storage, allowed writes and client/model disclosure before collection. Reuse that scope across the pilot; ask again only when it changes. Scope is a human authorization contract, not a new persisted grant or same-user security boundary.

Keep owner mutations in the existing CLI with generation checks and verified acknowledgment. Only explicit owner statements may become declarations or corrections. Inspect on conflict or uncertain writes; never automatically retry. No owner tool, interpretation view, source excerpt or free-text admission API is added to MCP. The skill may inspect only the owner metadata approved for model disclosure; otherwise inspection remains local and the client receives only minimized task context.

Configure the optional MCP in the owner's project-local Codex configuration, keeping machine paths and profile configuration outside version control. Preserve unrelated client configuration and fixture hooks. Only `get_task_context` and `get_profile_metadata` are exposed. A missing optional server must not block ordinary work. Revoke future delivery by disabling/removing the server; this does not retract already delivered context or delete the profile.

Verify the existing boundaries through synthetic process restarts, explicit corrections/declarations, redaction, consumer write rejection and unavailable-state tests. Separately require a real configured Codex tool call and owner review for the live pilot. A protocol harness does not establish live Codex use. Do not claim completion if client reload or owner feedback is pending.

## Compatibility and limits

The MCP transport accepts optional object-valued `_meta` on `tools/list`, as it already does on `tools/call`. Codex supplies a progress token during discovery. Metadata is bounded by the existing frame limit, ignored, never forwarded to the Provider or echoed, and grants no authority. Malformed metadata and unknown parameter fields remain rejected. This compatible transport correction changes no Provider/DCP schema or stored data.

This refines owner orchestration in ADR-0027/0030 and client delivery in ADR-0017; the fixture hook remains unchanged. No public schema, Store format, dependency, source connector or Core behavior changes. Same-OS-user limitations and existing collection/persistence budgets remain. General agent interpretation, persistent source caching and cross-project transfer stay outside M3-S12. Skill availability is repository-scoped; package/plugin distribution remains later work.

User configuration and live trial records stay outside Git. The existing Store inventory and deletion contract still apply; separate configuration and owner-retained trial records require explicit owner management. Only minimized, owner-approved results may be published.
