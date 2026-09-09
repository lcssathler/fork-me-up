<a id="local-community-workflow"></a>

# Build and use a local developer profile

This guide takes you from selected repositories to a saved profile, corrections and task context for a compatible MCP client. Everything runs locally without an account, network service or model API.

Use this checkout with pinned Node.js 24.20.0/npm 11.19.0 and installed workspace dependencies. This is a development workflow on the tested Windows baseline, not a packaged release.

Follow the steps to [configure sources](#configure-explicitly), [collect and correct](#collect-and-control-the-profile), [request task context](#compile-and-consume-task-context), then [diagnose, export or delete](#diagnose-export-and-delete). Owner mode manages the profile. MCP mode only reads context; it cannot collect sources or change the profile.

<a id="configure-explicitly"></a>

## Configure your sources and private Store

Create a private Store directory outside every selected repository before starting the runtime. The Store is the directory where the private profile is saved. The runtime rejects Store/source overlap in either direction, including a Store directory that contains a selected repository. Keep configuration outside analyzed source and do not commit private identity settings. Select only repositories you authorize for local collection; repository code, scripts, hooks and build commands are never executed by collection.

Save a UTF-8 configuration file using this exact shape, replacing the paths and explicit Git identity with your chosen local values:

```json
{
  "version": "0.1.0",
  "sources": {
    "configVersion": "0.1.0",
    "authorizedRoots": [{ "rootId": "root_local", "path": "C:/OwnerSelected/Sources" }],
    "repositories": [{ "repositoryId": "repo_local", "rootId": "root_local", "relativePath": "repository" }],
    "limits": {
      "maxRepositories": 1,
      "maxFilesPerRepository": 1000,
      "maxBytesPerFile": 65536,
      "maxTotalBytesPerRepository": 1048576,
      "maxDepth": 16,
      "maxDurationMs": 30000,
      "maxConcurrency": 1
    }
  },
  "identity": {
    "configVersion": "0.1.0",
    "subjectRef": "subject_local",
    "identities": [{ "role": "developer", "name": "Selected Git Name", "email": "selected@example.invalid" }],
    "annotations": []
  },
  "risk": { "configVersion": "0.1.0", "repositoryAnnotations": [], "pathAnnotations": [] },
  "refresh": {
    "refreshVersion": "0.1.0",
    "repositoryProjects": [{ "repositoryId": "repo_local", "projectRef": "project_local" }],
    "limits": { "maxCacheAgeMs": 300000, "maxCacheBytes": 1048576, "maxProbeEntries": 10000, "maxDurationMs": 30000, "maxCollections": 1 }
  },
  "store": { "configVersion": "0.1.0", "directoryPath": "C:/OwnerSelected/ProfileStore", "storeId": "store_local", "subjectRef": "subject_local" },
  "project": { "projectRef": "project_local", "repositoryId": "repo_local" }
}
```

The selected identity and Store subjects must match. Each repository needs exactly one refresh project mapping; the current project/repository must match that mapping. Identity, risk, authorization and refresh use their exact validators and limits.

Configuration reads accept at most 128 KiB, reject non-regular/linked files and verify file identity, timestamps and canonical target before and after the bounded read. Invalid configuration returns a fixed failure without echoing its contents or paths.

<a id="collect-and-control-the-profile"></a>

## Collect evidence and correct the profile

From the checkout, run:

```text
node scripts/community.mjs --config C:/OwnerSelected/community.json --mode owner
```

Send one JSON command per line on stdin. Each command produces one JSON result. Close stdin to exit. A process accepts at most 256 commands and 4 MiB per line; each operation also retains its tighter service limit. Output is bounded to 256 KiB per result. Invalid operations report failure; there is no implicit retry. The process exits nonzero if any command fails. This local control stream is for the owner, not an MCP model tool.

### Create or refresh the profile

For a first profile, send this refresh command with current canonical UTC timestamps:

```json
{"version":"0.1.0","operation":"refresh","request":{"refreshVersion":"0.1.0","observedAt":"2026-09-07T12:00:00Z","staleBefore":"2026-09-07T11:00:00Z","force":false},"expectedGeneration":null,"at":"2026-09-07T12:00:00Z"}
```

`expectedGeneration: null` requires an absent Store. Later refreshes use the last observed generation. `at` cannot precede collection or prior Store validation. Only verified correction-preserving persistence returns `refreshed`, with its new generation, cleanup status and bounded work/origin metadata.

A second unchanged refresh in the same process reuses the source cache and reports zero collections. Restart starts a cold source cache while retaining the persisted profile and owner history.

### Inspect and reject an assessment

Inspect the profile, then reject one returned Claim identifier:

```json
{"version":"0.1.0","operation":"inspect","claimId":null}
{"version":"0.1.0","operation":"reject","claimId":"claim_from_inspection","expectedGeneration":0,"at":"2026-09-07T12:00:01Z","summary":"This observation does not represent my implementation."}
```

All existing [owner requests](OWNER_WORKFLOW.md) are accepted directly as lines, without the standalone CLI's outer `store` wrapper: inspect, declare, correct, dispute, reject, evidence lookup, doctor, import, export and delete. Repeated edits preserve original provenance and owner precedence through later refreshes and restart. Use a new generation after each saved mutation. Conflicts and uncertain writes require inspection before deciding whether to retry.

### Handle collection failures

Incomplete or failed collection preserves the prior Store but blocks context from that runtime until a complete refresh is verified. Malformed commands do not invalidate a previously usable runtime. Sources are never deleted or repaired. Collection can fail on unsupported Git layouts, unsafe roots or exhausted budgets; those failures cannot produce a partial aggregate with inflated support. Uncommitted files and uncertain attribution remain conservative evidence, not proof of ownership.

<a id="compile-and-consume-task-context"></a>

## Request context for a task

In owner mode, the following request compiles current-project context from the reloaded Store. Explicit capability requests remain useful after restart; authentic project metadata contributes Demand only when a complete owner refresh exists in that process.

```json
{"version":"0.1.0","operation":"provider","request":{"schemaVersion":"0.1.0","kind":"profile-provider-request","requestId":"request_local","operation":"get-task-context","input":{"task":"Explain this TypeScript change","purpose":"coding-assistance","maxTokens":8192,"requestedCapabilities":["language.typescript"]}}}
```

The response is the existing public Provider envelope, containing a schema-valid DCP on success. Core handles project scope, effective corrections, redaction, budget reduction and response policy. Claims older than the configured maximum observation age are marked stale in the returned private working view without modifying the Store. Consumers cannot pass source roots, request collection or invoke owner operations.

### Connect a compatible MCP client

Configure a local stdio server with these executable arguments, replacing checkout/configuration paths:

```json
{
  "command": "node",
  "args": ["C:/Checkout/fork-me-up/scripts/community.mjs", "--config", "C:/OwnerSelected/community.json", "--mode", "mcp"]
}
```

MCP mode exposes `get_profile_metadata` and `get_task_context` through the existing initialization flow. It reads the saved Store and never accepts owner commands, refreshes sources or writes profiles. Each protected request reloads and validates the Store, so corrections and deletion barriers take effect without restarting the MCP server.

Configuration is explicitly validated at launch; unavailable configured roots fail startup. The current project is fixed by the owner configuration. Consumer requests do not discover projects, infer general task needs or ask automatic clarification questions; provide explicit requested capabilities when source metadata is unavailable.

The checked-in Codex fixture hooks remain unchanged. Configure the MCP server in a compatible client through that client's normal trust controls. The synthetic end-to-end test is a real subprocess MCP consumer; it does not claim a new live-client hook integration or model-authored output.

## Diagnose, export and delete

Use the requests in the [owner guide](OWNER_WORKFLOW.md):

- [Diagnose local state](OWNER_WORKFLOW.md#diagnose-local-state) with `doctor`. Supply an optional parsed DCP to measure size, expiry and budgets. Diagnostics never repair or migrate data.
- [Export or import](OWNER_WORKFLOW.md#export-and-import) a portable profile. Choose an existing export destination and the current Store generation. Export redacts private prose and source locations and verifies exclusive creation. Import requires an absent Store and matching subject.

Deletion requires the explicit confirmation and all-local-adapter-cache scope from [owner deletion](OWNER_WORKFLOW.md#delete-managed-local-data). It clears recognized Store data and matching in-process source state, delegates adapter cleanup, and retains barriers that deny future Store/cache reuse. Sources, unrelated files, independent exports and backups remain owner-managed. A partial deletion requires explicit recovery/resume. A new profile after deletion uses a new selected Store directory; reverting code is not data restoration.

## Verification

The real synthetic workflow test covers two repositories, first collection, unchanged cache reuse, correction, changed-source refresh, process restart, Store-backed MCP delivery, doctor, export and verified deletion with source preservation. Negative tests cover configuration size/shape/identity/root boundaries, malformed commands, partial refresh, unavailable/deleted state, consumer authority rejection and context redaction. See [ADR-0030](adr/0030-local-community-workflow-composition.md) and the [M2 execution record](ROADMAP.md#14-m2-execution-record).
