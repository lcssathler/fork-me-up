<a id="local-owner-inspection-corrections-and-portability"></a>

# Inspect, correct, export and delete your local profile

Use this guide to manage a profile you own through the local command line. You can inspect assessments, correct them, diagnose local state, move a redacted profile between Stores and delete managed data. No LLM or network service is required.

For source collection and MCP delivery, start with the [local Community workflow](LOCAL_COMMUNITY.md). Its owner mode accepts the request objects below directly; configure the Store once at launch and omit the standalone CLI's outer `store` wrapper.

Choose an action: [inspect](#inspect-the-profile), [correct](#correct-an-assessment), [declare](#declare-experience), [find evidence](#evidence-lookup-and-doctor), [diagnose](#diagnose-local-state), [export or import](#export-and-import), or [delete](#delete-managed-local-data).

## Run the owner command

Run from the repository using the pinned Node.js version:

```text
node scripts/owner-profile.mjs
```

Send one UTF-8 JSON document on stdin and close stdin. The command reads at most 4 MiB within 30 seconds; inspection/correction requests retain their 32 KiB service limit. It returns one bounded JSON result on stdout and exits with zero on success or one on failure. Supply an existing Store directory explicitly; there is no implicit directory discovery. This private owner interface is separate from Provider/MCP tools. Do not publish inspection output as a diagnostic.

## Inspect the profile

This request lists Claims, the profile's individual capability assessments:

```json
{
  "store": {
    "configVersion": "0.1.0",
    "directoryPath": "C:/OwnerSelected/ProfileStore",
    "storeId": "store_local",
    "subjectRef": "subject_local"
  },
  "request": {
    "version": "0.1.0",
    "operation": "inspect",
    "claimId": null
  }
}
```

Replace the directory and identifiers with the existing owner-selected configuration. A missing profile returns `absent`; inspection does not create or migrate a Store.

Set `claimId` to one returned identifier for structured evidence and correction details. The view includes state, scope, observed depth, confidence, freshness and whether a Claim is historical. Detailed provenance includes evidence fingerprints, authorship categories and correction IDs/kinds/times. Notes, source paths and native diagnostics are omitted.

## Correct an assessment

Keep the same `store` and replace `request` with the following to correct an evidence-backed Claim:

```json
{
  "version": "0.1.0",
  "operation": "correct",
  "claimId": "claim_from_inspection",
  "expectedGeneration": 0,
  "at": "2026-09-07T12:00:01Z",
  "summary": "This observation does not represent my own implementation."
}
```

Use the generation returned by inspection and a canonical UTC timestamp at or after the prior mutation and target observation. `correct` and `dispute` append an adjustment; `reject` appends a rejection. The effective Claim becomes `disputed`, with its original observation preserved in history. Another correction appends a new record and becomes current, including same-second edits.

Notes are private inert text of 1–256 characters; controls and malformed Unicode are rejected. Notes are persisted but not echoed. Do not include credentials or raw source.

## Declare experience

Use `declare` for an independent assertion about your experience:

```json
{
  "version": "0.1.0",
  "operation": "declare",
  "capability": "language.rust",
  "projectRef": null,
  "expectedGeneration": null,
  "at": "2026-09-07T12:00:00Z",
  "summary": "I have studied Rust independently."
}
```

`null` expected generation creates an absent profile; an existing Store requires its observed generation. A declaration creates a `self-declared` Claim with no observed depth or Evidence. A non-null project reference scopes it to that project.

Corrections target observed evidence-backed Claims; self-declared, unobserved and historical targets return `unsupported-target`. Manual input cannot promote a Claim to demonstrated knowledge. Declaration withdrawal and correction revocation are not implemented.

## Check whether a write succeeded

`saved` means the candidate was validated and reread after atomic activation. `conflict` requires new inspection before deciding on another mutation. `commit-outcome-unknown` means activation may have occurred; inspect rather than blindly retrying. Recovery and pending cleanup are explicit. History exhaustion rejects the whole mutation and preserves the prior valid state.

### Application composition

For local application composition, `saveOwnerDerivation` accepts only an authentic Community derivation, explicit Store authority and a closed `{version, expectedGeneration, at}` JSON request. It initializes or refreshes automated state while retaining declarations, corrections and archived provenance.

Disputed scopes suppress replacement inference; changed, absent or newly observed sources conservatively mark effective disputes stale without revoking them. Recompute a derivation at or after the latest Store validation before saving; old snapshots cannot roll state back. Core task intersection excludes historical originals linked by effective disputes.

## Evidence lookup and doctor

Use `get-capability-evidence` to look up one exact capability without changing the profile:

```json
{
  "version": "0.1.0",
  "operation": "get-capability-evidence",
  "capability": "language.typescript",
  "limit": 8
}
```

The result reports at most eight matching Claims with at most eight Evidence summaries each. `totalClaims`, `totalEvidence` and `truncated` distinguish limited output from missing evidence. An unknown capability produces an empty result, never a claim of ignorance.

Assessment state, depth, confidence, scope, freshness and historical status remain visible; each nested evidence object validates the existing Provider evidence contract.

References are hashes for correlation inside the diagnostic view, not correction handles: use `inspect` for mutation identifiers.

Known limitation codes are allowlisted, while private prose becomes `private-limitations-omitted`. No source locations, notes, author identities or native errors are returned. Consumer/MCP evidence disclosure remains disabled.

### Diagnose local state

The `doctor` request checks local state without repair or mutation:

```json
{
  "version": "0.1.0",
  "operation": "doctor",
  "at": "2026-09-07T12:00:02Z",
  "packet": null,
  "maxContextBytes": 32768,
  "maxContextTokens": 8192
}
```

Keep the existing `store` wrapper, or set `store` to `null` to diagnose installation and cache without selecting a profile. The CLI probes actual module loading and the pinned Node.js 24.20.0 runtime. Missing dependencies return `installation-unavailable` without an import stack. `diagnosed` means the inspection succeeded, not that every component is healthy. Inspect the separate component states:

- Store: absent, active, recovered, deleted, invalid, unsupported version, migration required, unauthorized, unavailable or bounded-limit failure. A present valid Store includes schema validation and bounded counts. `mutationGate: blocked` exposes an occupied or abandoned write gate; diagnostics never break it. An available gate does not override a deleted Store barrier.
- Adapter: module/probe availability and fixed cache state/counts. Read-only cache inspection reports ready, absent, deleted, busy, invalid, unavailable or limit exceeded. Expiry equal to `at` is stale. It reads at most 256 entries, 8 KiB per recognized cache file and 2 MiB total, checks file/root changes and never creates directories, locks or barriers. Unknown entries count toward the scan bound but are not read.
- Context: replace `packet: null` with a parsed DCP to validate its schema and measure canonical JSON bytes and the same conservative one-token-per-UTF-8-byte bound used by Core. Results distinguish invalid, future, expired, over-budget and within-budget packets. Limits are explicit upper bounds, not a tokenizer prediction. The packet and task text are never returned. Omitted packets report `not-provided`.

Diagnostic requests are limited to 64 KiB and results to 32 KiB. Installation checks do not verify npm availability, package integrity, client trust, active hook registration, network connectivity or another process's memory. Programmatic composition without installation/cache probes reports those checks as `not-checked`. The source cache is process-local and has no persistent inventory. Diagnostics read selected metadata only and never collect source evidence, migrate, delete or repair data. See [ADR-0029](adr/0029-owner-evidence-and-safe-diagnostics.md).

## Export and import

Use the same command and `store` wrapper to move a redacted profile between local Stores.

### Export an inspected generation

Replace `request` with:

```json
{
  "version": "0.1.0",
  "operation": "export",
  "at": "2026-09-07T12:00:03Z",
  "expectedGeneration": 1,
  "exportId": "owner_backup_1",
  "destinationDirectory": "C:/OwnerSelected/Exports"
}
```

The destination must already exist. Use the current generation and a timestamp no earlier than the profile's validation or observations.

`exported` returns a relative `fileName` after exclusive creation, schema validation, synchronization and exact readback. Existing exports are never overwritten.

`export-outcome-unknown` means a final file may exist: inspect that artifact before deciding whether to retry with a new ID. `maintenanceRequired` reports a verified artifact whose temporary cleanup failed. Artifacts are limited to 4 MiB minus 32 KiB, reserving space for an import wrapper.

The public `0.1.0` Portable Profile Export retains typed assessments, freshness, preferences, correction order and all provenance links. Redaction deliberately replaces private notes, rationale and limitation prose with fixed text; source locations and record/project/repository identifiers become opaque hashes. Source grants, sharing grants, credentials, raw source and Store bookkeeping are excluded. Semantic capabilities and the configured subject identity remain and must pass sensitive-content checks. This is a lossy portable profile, not a byte-for-byte private backup or source-location map.

### Import into an empty Store

Select a different existing, empty Store directory in `store`, with the same `subjectRef`. Use this request shape, replacing the illustrative empty object with the complete parsed export document:

```json
{
  "version": "0.1.0",
  "operation": "import",
  "at": "2026-09-07T12:00:04Z",
  "portableProfile": {}
}
```

Only a valid Portable Profile Export is accepted; Store files, DCPs, unresolved references, future observations and occupied destinations are rejected. Import applies the same redaction projection and remaps identifiers consistently, then commits generation zero through verified Store persistence. It preserves correction behavior without merging or replacing existing history. Inspect the imported profile for its new identifiers; subsequent repository/project bindings must explicitly use the imported project references. Import grants no source access.

## Delete managed local data

Deletion is irreversible. Stop other processes using the selected Store or adapter cache, then submit the same `store` wrapper with:

```json
{
  "version": "0.1.0",
  "operation": "delete",
  "confirm": "delete-local-profile",
  "cacheScope": "all-local-adapter-caches"
}
```

The explicit cache scope is required because the Codex fixture adapter cache is not bound to individual Stores. This operation clears all recognized entries beneath its fixed local cache root, including entries for other subjects. `deleted` is returned only after the selected Store and adapter cache removals are verified.

| Data | Deletion behavior |
| --- | --- |
| Selected Store generations and staging files | Remove recognized regular files; verify absence with bounded scans. |
| Current-process incremental source cache and prior derivations | Dispose sessions matching the subject, including in-flight publication; later reuse fails. The registry admits at most 128 live sessions. |
| Codex cache under the canonical temporary-directory child `fork-me-up-codex-adapter-v1` | Remove recognized cache/staging files for all subjects; deny later cache reads/writes. |
| Deletion barriers | Keep `.community-profile-store.deleted` (`deleted` plus newline) and adapter `.deleted` (empty). They contain no profile data and prevent recreation. |
| Source repositories, unrelated entries, directories, final exports and independent backups | Preserve. Exported copies and backups must be managed separately by their owner. |
| Already returned immutable objects and other processes | Their owners must release the objects or stop the processes; this operation does not erase their memory. |

### Resume incomplete deletion or recover a stopped writer

An exclusive `.community-profile-store.mutation.lock` coordinates Store writers/migration/deletion; the adapter uses `.mutation.lock`. The deletion barrier is synchronized before removal and retained on interruption. `deletion-incomplete` never claims complete removal: resolve the cause and explicitly repeat the same delete operation to resume. Disposed in-process sessions stay disposed even when a later deletion step fails. A failed gate release after a successful write reports `maintenanceRequired`; after deletion it reports `deletion-incomplete`.

A crashed process can leave its gate. After verifying that every writer has stopped and confirming the exact selected directory, the owner may remove only that directory's mutation lock and retry. There is no automatic stale-lock breaking. Keep deletion barriers: initialize future profile data in a new owner-selected Store directory. Automatic adapter-cache reactivation is not implemented.

### Deletion limits

Store scans are bounded to 64 entries and adapter scans to 256, including unrelated entries. Recognized corrupt Store files up to the 4 MiB read limit can be removed; oversized corrupt files, links/special entries, redirected roots and exhausted scan limits fail closed and require owner maintenance. No successful deletion is reported for those failures. Filesystem guarantees retain the same-OS-user trust limit and do not constitute secure disk erasure. There is no managed backup retention or cross-process memory erasure in this local workflow.

Persistent source caching remains future work. For the current source-to-consumer command workflow, use [local Community](LOCAL_COMMUNITY.md). See [ADR-0027](adr/0027-local-owner-correction-workflow.md), [ADR-0028](adr/0028-owner-portability-and-verified-deletion.md), [architecture](ARCHITECTURE.md), and [security/privacy](SECURITY_PRIVACY.md).
