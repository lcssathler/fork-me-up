# Private source catalog

Use this checkout command to avoid repeating deep source reads between sessions. It checks your saved profile first, ranks only your selected sources by language and related stack, then collects or reuses a bounded sample. It does not update your profile, make expertise claims or send source code to a model. GitHub access uses the existing [selected-source authentication](GITHUB_SOURCES.md).

## Configure a private location

Create a dedicated directory outside every authorized source root and the profile Store, with access restricted to your OS account. Use its full canonical path, without symlinks or Windows short-name aliases. Keep the configuration outside Git. Persistence needs separate owner consent from source reads.

The owner configuration is a closed JSON object with these fields:

| Field | Value |
|---|---|
| `version` | `"0.1.0"` |
| `directory` | Absolute existing private catalog directory |
| `subjectRef` | Same opaque subject as the identity, profile and GitHub configurations |
| `identity` | Complete identity object from the [local configuration](LOCAL_COMMUNITY.md) |
| `profile` | Complete local `store` object, or `null` if none is configured |
| `projectRef` | Opaque project identifier for scoped profile matching |
| `sources` | Up to 32 candidate objects described below |
| `limits` | The limits object below; every value may be lowered |

Each candidate has exactly `sourceRef` (unique opaque ID), `kind` (`local` or `github`), `languages` (hints such as `["typescript"]`) and `configuration`. For a local candidate, use a complete [local source configuration](LOCAL_COMMUNITY.md) containing exactly one repository. For a GitHub candidate, use a complete [GitHub configuration](GITHUB_SOURCES.md) containing exactly one selected repository. Copy objects, not filenames. All candidates must retain their own live source authority. A hint never grants permission or establishes knowledge.

```json
{
  "candidates": 8,
  "collections": 3,
  "requests": 64,
  "durationMs": 60000,
  "probeEntries": 8192,
  "cacheAgeMs": 300000
}
```

Use the supported language identifiers: `typescript`, `javascript`, `java`, `python`, `csharp`, `go`, `rust`, `powershell`, `php`, `ruby`. TypeScript and JavaScript are adjacent selection hints; concept interpretation is not implemented here. Sources with no matching hint may fill remaining places in the bounded batch. Collection limits within each source configuration still apply; increasing the source list does not increase the run budget.

## Select and reuse

Run from the checkout with its pinned toolchain:

```text
node scripts/source-catalog.mjs --config <private-catalog-config.json> --operation select --languages typescript,javascript
```

A current applicable profile declaration can make source work unnecessary. Otherwise the receipt reports selected/unexamined candidates, deep collections, persistent hits, requests, response bytes, probe entries, failures and retained records. `saved` means the catalog write was verified, not that every source succeeded. Check `failures` and `unexamined`; no missing source means lack of knowledge. An unavailable profile is reported and does not block ordinary source selection.

Run the same command in a new process to reuse valid observations. Each hit still checks authorization and current source state. GitHub uses metadata/revision reads without blob or ancestor fetches; local checks include uncommitted changes. Add `--refresh` to explicitly bypass profile coverage and cache reuse for a fresh bounded collection. It does not expand permissions or limits.

The catalog stores hashed references, languages, counts, sample/fork limits and original dates. It stores no source text, repository names, credentials, conversations or profile declarations. A hit lasts at most five minutes from its original observation; checking metadata never renews that date. Inventory expires within 24 hours or earlier grant expiry. Physical removal happens on the next invocation; there is no background cleaner while the application is closed. See the [retention policy](SECURITY_PRIVACY.md#9-retention-export-and-deletion).

## Export, disconnect and delete

An explicit export returns only a minimized inventory in the receipt. It contains no source authority and cannot be imported. Copies you save are independently managed.

```text
node scripts/source-catalog.mjs --config <private-catalog-config.json> --operation export --languages ""
```

Remove a candidate from the configuration to disconnect it. On the next invocation its records are removed from all recovery generations. Changing the configuration during a run stops further authorized work. If a source becomes unavailable, selection reports failure and drops its record.

Deletion removes only recognized catalog generations and staging files in the selected directory. It preserves source repositories, the profile, unknown files and exported copies. It does not require live sources or an available profile. The persistent deletion barrier prevents later reuse; choose a new private directory if you intentionally initialize another catalog.

```text
node scripts/source-catalog.mjs --config <private-catalog-config.json> --operation delete --languages "" --confirm-delete-catalog
```

An interrupted deletion can be resumed with the same command. A failed or uncertain write is never acknowledged as saved. An abandoned `.catalog.lock` requires stopping every catalog writer and explicitly removing only that lock before retrying. Do not remove `.catalog.deleted` or treat unverified staging as a committed catalog. Link/special/oversized entries and exhausted bounds fail closed rather than claiming successful cleanup. The [architecture decision](adr/0044-persistent-selective-source-catalog.md) defines recovery and platform limits.
