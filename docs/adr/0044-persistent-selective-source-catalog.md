# ADR-0044: Private persistent catalog and selective reuse

- Status: Accepted
- Date: 2026-09-21

## Contract and scope

M3-S14 starts on `codex/m3-s14` from integrated M3-S13 at `521c42a` (PR #50). Traceability: FMU-FR-033, FMU-E-021, Security T-02/T-04/T-05/T-09/T-10 and ADR-0023/0026/0028/0041/0043. The owner authorized a private local pilot with the previously selected local/public/private sources and minimized catalog retention. Actual selections and receipts stay outside Git.

Consult the existing profile before source work, rank explicitly configured candidate sources by bounded language metadata, and collect/reuse only a bounded batch. No account enumeration, Core/public schema change, model processing, automatic Claim update, broader source permission, new dependency or release. Metadata affinity is a candidate-selection hint, never proof of expertise or a cross-project inference. Profile corrections remain authoritative and untouched.

## Inventory and authority

- Closed owner configuration binds the catalog to the exact subject/identity, canonical storage outside source roots and the profile Store, and at most 32 explicit candidates. Each candidate retains separate live local-root or GitHub authority; remote collectors keep their existing ceilings. A run visits at most 8 candidates and performs at most 3 deep collections, 64 remote requests, 8,192 local probe entries and 60 seconds, sequentially, without retries. Limits may only decrease.
- Consult the configured Store first. Report relevant profile coverage and exclude already-covered task languages from selection only when effective, current Claims support them. No missing/unexamined capability means ignorance. An explicit refresh still permits collection when the caller wants source maintenance. Profile unavailability is explicit and does not produce invented Claims.
- Cached records contain only hashed source/authority/identity/state references, source kind, closed language identifiers, file/byte/commit counts, fork/sample limitations, algorithm version and original observation/expiry timestamps. They contain no names, paths, source text, identity prose, credentials, conversations, Claims or serialized authority. No consumer MCP tool exposes or creates this cache.
- Every hit requires current source authority and source state. GitHub revision probes recheck login, numeric repository identity, visibility and current head without fetching blobs/ancestor history. Local probes reuse ADR-0026's canonical metadata fingerprint, including uncommitted files and Git metadata; HEAD alone is insufficient. Full local collection probes before/after. The cache stores normalized observations, not authentic filesystem snapshots or per-source risk-derived Claims. It cannot bypass complete-set risk assessment or promote support by dropping a duplicate peer.
- Reuse lasts at most five minutes from original collection; hits never renew observation age. Inventory validity lasts at most 24 hours, bounded by grant expiry. Expired entries are excluded and removed during the next catalog invocation. No background cleaner runs while the application is closed; expiry prevents use but is not a promise of offline physical erasure. The real pilot deletes its task-created cache after restart/reuse verification.

## Persistence, export and deletion

Use a canonical owner-selected directory, exclusive mutation lock, exact schema validation, bounded regular-file reads, generation-addressed atomic hard-link activation, sync and verified readback. Keep at most two valid generations; orphan staging is never a committed cache. Recovery may use an older valid generation but still rechecks current authorization, state and original age. Unknown files are untouched. Changed identity/policy/algorithm/authority never reuses old records.

The catalog uses its own inventory and deletion barrier, not the profile Store's. Disconnect/removing a source stops new reads and drops its catalog records on the next invocation. Explicit deletion creates a durable barrier before removing recognized generations/staging; stopped or late writers cannot resurrect it. Reinitialization needs a new selected directory. Export is a separately requested minimized inventory, not a portable profile or an importable source grant; exported copies remain owner-managed. No automatic import or backups exist. Failed/uncertain writes are never reported as saved. Locks left by an interrupted process require explicit owner recovery after writers stop.

The same-OS-user compromise and physical-media-erasure limits from the Store still apply. Cache bytes are untrusted: validate shape, counts, enums, timestamps, bindings and integrity before reuse, and independently probe live state. Schema-valid cached metadata cannot become expertise or source authority.

## Verification and stopping conditions

Synthetic tests must cover profile-first selection, more candidates than the deep batch, restart hits, preserved observation age, changed local uncommitted data and GitHub revisions, identity/version/grant changes, expiry/revocation, corrupt/poisoned cache, interrupted activation/recovery, concurrent mutation, canonical/link boundaries, export minimization and deletion preventing reuse. Run focused tests then `npm run check`, document independent security review and bounded live evidence separately. No source/model scope expansion, unsafe persistence, unresolved high finding, unverified write or queue transition before integration is permitted.
