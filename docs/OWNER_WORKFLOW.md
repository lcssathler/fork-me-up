# Local owner inspection, corrections and portability

M2-S10 provides a first-party local CLI without an LLM or network service. Run it from the repository using the pinned Node.js version:

```text
node scripts/owner-profile.mjs
```

Send one UTF-8 JSON document on stdin and close stdin. The command reads at most 4 MiB within 30 seconds; inspection/correction requests retain their 32 KiB service limit. It returns one bounded JSON result on stdout and exits with zero on success or one on failure. Supply an existing Store directory explicitly; there is no implicit directory discovery. This private owner interface is separate from Provider/MCP tools. Do not publish inspection output as a diagnostic.

Example input to list Claims:

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

Replace the directory and identifiers with the existing owner-selected configuration. A missing profile returns `absent`; inspection does not create or migrate a Store. Set `claimId` to one returned identifier for structured evidence and correction details. The view includes state, scope, observed depth, confidence, freshness and whether a Claim is historical. Detailed provenance includes evidence fingerprints, authorship categories and correction IDs/kinds/times. Notes, source paths and native diagnostics are omitted.

To correct an evidence-backed Claim, keep the same `store` and replace `request` with:

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

Use the generation returned by inspection and a canonical UTC timestamp at or after the prior mutation and target observation. `correct` and `dispute` append an adjustment; `reject` appends a rejection. The effective Claim becomes `disputed`, with its original observation preserved in history. Another correction appends a new record and becomes current, including same-second edits. Notes are private inert text of 1–256 characters; controls and malformed Unicode are rejected. Notes are persisted but not echoed. Do not include credentials or raw source.

Independent assertions use `declare`:

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

`null` expected generation creates an absent profile; an existing Store requires its observed generation. A declaration creates a `self-declared` Claim with no observed depth or Evidence. A non-null project reference scopes it to that project. Corrections target observed evidence-backed Claims; self-declared, unobserved and historical targets return `unsupported-target`. Manual input cannot promote a Claim to demonstrated knowledge. Declaration withdrawal and correction revocation are not implemented in this slice.

`saved` means the candidate was validated and reread after atomic activation. `conflict` requires new inspection before deciding on another mutation. `commit-outcome-unknown` means activation may have occurred; inspect rather than blindly retrying. Recovery and pending cleanup are explicit. History exhaustion rejects the whole mutation and preserves the prior valid state.

For local application composition, `saveOwnerDerivation` accepts only an authentic Community derivation, explicit Store authority and a closed `{version, expectedGeneration, at}` JSON request. It initializes or refreshes automated state while retaining declarations, corrections and archived provenance. Disputed scopes suppress replacement inference; changed, absent or newly observed sources conservatively mark effective disputes stale without revoking them. Recompute a derivation at or after the latest Store validation before saving; old snapshots cannot roll state back. Core task intersection excludes historical originals linked by effective disputes.

## Export and import

M2-S11 adds portability through the same command and `store` wrapper. To export an inspected generation, replace `request` with:

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

The destination must already exist. Use the current generation and a timestamp no earlier than the profile's validation or observations. `exported` returns a relative `fileName` after exclusive creation, schema validation, synchronization and exact readback. Existing exports are never overwritten. `export-outcome-unknown` means a final file may exist: inspect that artifact before deciding whether to retry with a new ID. `maintenanceRequired` reports a verified artifact whose temporary cleanup failed. Artifacts are limited to 4 MiB minus 32 KiB, reserving space for an import wrapper.

The public `0.1.0` Portable Profile Export retains typed assessments, freshness, preferences, correction order and all provenance links. Redaction deliberately replaces private notes, rationale and limitation prose with fixed text; source locations and record/project/repository identifiers become opaque hashes. Source grants, sharing grants, credentials, raw source and Store bookkeeping are excluded. Semantic capabilities and the configured subject identity remain and must pass sensitive-content checks. This is a lossy portable profile, not a byte-for-byte private backup or source-location map.

For import, select a different existing, empty Store directory in `store`, with the same `subjectRef`. Use this request shape, replacing the illustrative empty object with the complete parsed export document:

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

An exclusive `.community-profile-store.mutation.lock` coordinates Store writers/migration/deletion; the adapter uses `.mutation.lock`. The deletion barrier is synchronized before removal and retained on interruption. `deletion-incomplete` never claims complete removal: resolve the cause and explicitly repeat the same delete operation to resume. Disposed in-process sessions stay disposed even when a later deletion step fails. A failed gate release after a successful write reports `maintenanceRequired`; after deletion it reports `deletion-incomplete`.

A crashed process can leave its gate. After verifying that every writer has stopped and confirming the exact selected directory, the owner may remove only that directory's mutation lock and retry. There is no automatic stale-lock breaking. Keep deletion barriers: initialize future profile data in a new owner-selected Store directory. Automatic adapter-cache reactivation is not implemented.

Store scans are bounded to 64 entries and adapter scans to 256, including unrelated entries. Recognized corrupt Store files up to the 4 MiB read limit can be removed; oversized corrupt files, links/special entries, redirected roots and exhausted scan limits fail closed and require owner maintenance. No successful deletion is reported for those failures. Filesystem guarantees retain the same-OS-user trust limit and do not constitute secure disk erasure. There is no managed backup retention or cross-process memory erasure in this local slice.

Persistent source cache and source-to-consumer command composition remain later roadmap work. See [ADR-0027](adr/0027-local-owner-correction-workflow.md), [ADR-0028](adr/0028-owner-portability-and-verified-deletion.md), [architecture](ARCHITECTURE.md), and [security/privacy](SECURITY_PRIVACY.md).
