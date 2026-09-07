# Local owner inspection and corrections

M2-S10 provides a first-party local CLI without an LLM or network service. Run it from the repository using the pinned Node.js version:

```text
node scripts/owner-profile.mjs
```

Send one UTF-8 JSON document on stdin and close stdin. The command reads at most 32 KiB within 30 seconds, returns one bounded JSON result on stdout, and exits with zero on success or one on failure. Supply an existing Store directory explicitly; there is no implicit directory discovery. This private owner interface is separate from Provider/MCP tools. Do not publish inspection output as a diagnostic.

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

Persistent cache, source-to-consumer command composition, export and deletion remain later roadmap work. The CLI inherits the documented same-operating-system-user trust limit. See [ADR-0027](adr/0027-local-owner-correction-workflow.md), [architecture](ARCHITECTURE.md), and [security/privacy](SECURITY_PRIVACY.md).
