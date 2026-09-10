# Fork Me Up — Architecture

> Status: current architecture and future boundaries
> Version: 0.1  
> Last updated: September 10, 2026

## 1. Architectural objective

Fork Me Up must let different providers construct developer profiles and different AI clients consume task-relevant context without sharing a vendor-specific internal model.

The architecture separates four concerns:

1. Collect developer-approved evidence.
2. Derive bounded, explainable capability claims.
3. Maintain a private canonical Developer Profile.
4. Compile and deliver a minimized Developer Context Packet.

Client adapters, source connectors, and hosted operations sit outside the domain core.

## 2. System context

```text
Authorized sources
local Git / selected public repositories / future selected private repositories
                              ↓
                    Collection adapters
                bounds, consent, normalization
                              ↓
                     Fork Me Up Core
          Evidence → Claims → Developer Profile → DCP
                              ↓
                    Fork Me Up Connect
           file / SDK / MCP stdio / future remote MCP
                              ↓
              Compatible AI tools and harnesses
```

The Core never assumes that a specific client, model, source provider, or integration partner exists.

## 3. Architectural layers

### 3.1 Protocol — public

Defines the portable contracts:

- Evidence references and visibility classes.
- Claims and uncertainty.
- Portable Profile Export interchange and migrations; Developer Profile Store schemas remain implementation-internal.
- Demand Profile.
- Developer Context Packet.
- Provider and consumer conformance.
- MCP tool inputs, outputs, errors, and compatibility.

This layer contains schemas and types, not source access or client lifecycle behavior.

### 3.2 Core — public

Owns pure or deterministic domain behavior:

- evidence collection through separate `EvidenceCollector`/`SourceAdapter` ports;
- evidence normalization;
- claim precedence;
- correction handling;
- adjacency representation;
- profile versioning;
- demand/profile intersection;
- DCP compilation and disclosure budgeting;
- response-policy generation;
- redaction and output invariants.

Core accepts ports for time, identifiers, persistence, evidence providers, and policy. It has no Codex types, network credentials, HTTP server, GitHub API, or UI.

### 3.3 Community Runtime — public

Provides an operational local implementation:

- CLI;
- versioned local persistence;
- selected-root and Git repository scanners;
- deterministic basic evidence rules;
- MCP server over `stdio`;
- local diagnostics, import, export, correction, and deletion;
- reference client adapters;
- fixtures and evaluation harness.

Offline mode opens no listener and makes no network request. The initial provider does not require a second LLM.

### 3.4 Connect — public contract and adapters

Connect transports already-compiled context. It must not become a hidden ingestion layer or a second profile source of truth.

Possible delivery mechanisms:

- versioned JSON file;
- in-process SDK;
- CLI output;
- local MCP `stdio`;
- future HTTPS MCP Streamable HTTP;
- a local bridge to a remote service when a client lacks native remote authentication support.

Every adapter publishes its tested transport, authentication, lifecycle, size, and schema-version compatibility. Unsupported capabilities degrade explicitly; the project does not claim universal compatibility.

### 3.5 Guided interpretation — planned boundary

[ADR-0041](adr/0041-guided-evidence-backed-local-mvp.md) adds a target workflow, not new runtime capabilities:

- **Owner orchestration:** a local skill guides identity, source/disclosure selection, overview review and bounded owner operations. Read-only Provider/MCP tools cannot acquire these permissions.
- **Source catalog:** Community owns authenticated discovery, deterministic collection and a private bounded persistent index. Selection ranks candidate repositories for relevance, never people for ability.
- **Interpretation:** the existing host agent proposes task capabilities, assessments and analogies from a minimized authorized evidence view. The view is separate from ordinary DCP delivery and may include explicitly authorized bounded redacted source excerpts with resolvable references; language labels alone cannot establish concept-level experience. A deterministic admission service validates evidence references, versions, scope, uncertainty and owner intent before storage.
- **Transfer:** a task projection may use validated relationships to experience in another project without rewriting the source Claim's scope. The present exact-match Core remains unchanged until its affected contracts and consumers are updated together.
- **Delivery:** Core compiles validated data; the client renders progressive explanations. A skill is orchestration, not a source grant or permission to write.

The implementing slices must specify exact proposal/view schemas, disclosure budgets, credential ownership, source/cache inventory, admission rules and compatibility. Unsupported host capabilities yield an explicit manual path or no context; no second model API is required.

## 4. Deployment modes

### 4.1 Community local

```text
selected local repositories
          ↓
local scanner + local profile store
          ↓
DCP compiler
          ↓
MCP stdio / JSON / SDK
          ↓
local compatible client
```

Properties:

- no account;
- no network in offline mode;
- source collection and profile storage remain local in this mode;
- the host model may still receive the minimized DCP according to that host's own configuration and terms;
- profile inspection, correction, export, and deletion remain local.

### 4.2 Community with bounded public history

The Community provider prefers the quarantined local Git collector for every selected repository. An optional owner-only configuration can map that same authorized repository to a public `github.com` repository for a maximum 24-hour consent window evaluated against the runtime wall clock rather than request metadata. A complete local history makes no network request. A shallow history may be enriched from its exact local head; eligible local Git unavailability requires an exact owner-configured head before GitHub can be used.

GitHub access invokes only fixed read-only REST endpoints through an already authenticated external `gh` installation. Fork Me Up accepts no token or credential path, never prompts for or stores authentication, verifies the repository is public, enforces request/response/commit/path/time limits and performs no automatic retry. Local Git consumes the enclosing collection budget first, and remote work receives only the smaller configured or remaining deadline. Only sanitized Git snapshot fields enter the existing authorship/risk pipeline. Owner refresh reports the history source, GitHub status and request count; unchanged source cache hits are process-local and make zero requests. Offline operation and MCP consumers retain no network capability. See [ADR-0039](adr/0039-local-first-bounded-public-history.md).

### 4.3 Selected GitHub collection — planned local mode

An owner connector discovers metadata only within its approved scope, reads selected public/private repositories under a separate bounded content grant, and stores minimized derived state locally. Public-only history in Section 4.2 remains unchanged until this connector's dedicated ADR and private-source review pass. A broader catalog is not an expanded collection batch.

The catalog checks saved context first, selects task-relevant and adjacent candidates, and deepens reads within fixed budgets. Permission/identity/source/version changes invalidate reuse. Revalidation never refreshes an old observation timestamp. Local source fingerprints must include relevant uncommitted changes. Persistent state uses separate validated storage, not serialized in-process authority.

### 4.4 Remote deployment — deferred

Any remote provider implements the same open contracts. Source credentials and consumer authorization remain separate; tenant isolation, minimized disclosure, expiry, revocation and deletion follow Security and Protocol. A consumer never receives upstream tokens, raw repositories or a queryable developer directory. This mode is not required for the local MVP.

## 5. Domain data flow

### 5.1 Evidence collection

Collectors receive an explicit source and root or repository set. Before reading, they apply:

- authorization and root checks;
- ignore and visibility rules;
- file, byte, tree-depth, time, and concurrency budgets;
- symlink and path canonicalization policy;
- binary, generated, vendor, template, fork, and submodule policy;
- secret and sensitive-content filters.

Repository content is data, never instruction. Collectors do not execute code, install dependencies, evaluate scripts, or follow embedded URLs.

The Community collection boundary starts with a bounded implementation-internal `0.1.0` JSON configuration that names absolute owner-selected roots by opaque ID and selects repositories beneath each root by opaque ID plus a safe forward-slash relative path. The Community Provider resolves directories through a narrow metadata-only port using `realpath` and `stat`, rejects duplicate physical identities and canonical escape, and returns an immutable private authority object with fixed collection ceilings. Absolute canonical paths remain inside that owner-side boundary and never enter Protocol, Core, a Provider request/error, DCP, or normal log.

Resolution is a snapshot: every collector read must recanonicalize at the point of use and recheck containment. [ADR-0018](adr/0018-authorized-local-repository-configuration.md) records the decision.

### 5.2 Evidence normalization

An evidence record identifies what was observed without claiming proficiency. It includes:

- source and stable source-relative reference;
- repository and revision identifiers appropriate to visibility;
- observed capability signal;
- author or contributor assessment;
- time and freshness metadata;
- strength and limitations;
- extractor version and fingerprint;
- visibility and disclosure class.

Authorship assessment is pure: it combines the collected Git snapshot with explicit private identity configuration before producing Evidence. Raw configured names/emails are normalized directly to digests and discarded. Attribution (`attributed`, `shared`, `coauthored`, `bot`, `pair-work`, or `unknown`) stays independent from history shape (`ordinary`, `merge`, or explicitly annotated `squash`), then maps conservatively into the existing Evidence author states. Shared identities remain unknown at the individual level, and all isolated commits carry depth/confidence ceilings plus an explicit prohibition on standalone demonstrated depth. This richer private snapshot is not itself Evidence or a Claim. See [ADR-0021](adr/0021-explicit-conservative-git-authorship-assessment.md).

Source-risk classification correlates those authentic assessments with the complete bounded filesystem and Git snapshots. A pure classifier combines explicit owner annotations, fixed source-relative path indicators, exact SHA-256 duplicate counts, and bounded changed-path attribution. Fork, template, generated, vendored, tutorial, duplicated, and uncertain flags remain distinct and visible; any flag reduces support and caps strength at weak. Absence of a flag means only `origin-unverified`, never original. The resulting immutable object remains private pre-Evidence metadata, carries only the already normalized source language needed by the next boundary, and gives later derivation a ceiling rather than a capability conclusion. See [ADR-0022](adr/0022-conservative-evidence-source-risk-classification.md).

### 5.3 Claim derivation

Claims are produced from evidence rules and developer input. The engine:

- keeps observed and inferred facts distinct;
- represents adjacent transfer explicitly;
- records insufficient evidence;
- prevents uncertain authorship alone from producing high-confidence depth;
- applies correction precedence without erasing history;
- never converts a confidence category into a person-ranking score.

The currently implemented pure Community Evidence/Claim producer admits only authentic source-risk snapshots and an exact request with injected source/derivation/staleness times plus complete repository-to-project bindings. Supported source languages become project-scoped `language.*` Evidence; no other collected or free-text field has capability authority. Stable IDs and semantic fingerprints make source changes observable across refreshes. Claims aggregate only exact same-project capability observations, require attributable/coauthored support for `demonstrated`, preserve upstream strength plus authorship depth/confidence ceilings, stop at medium/practical-use, and otherwise remain `insufficient-evidence`. The entire reference graph is revalidated through the accepted Profile payload contract. See [ADR-0024](adr/0024-deterministic-evidence-claim-derivation.md).

### 5.4 Developer Profile

The [evidence method](EVIDENCE_METHOD.md) and [ADR-0031](adr/0031-evidence-method-and-frozen-quality-protocol.md) document why identity association, artifact-origin indicators and human understanding remain separate. The current Community pipeline uses no AI detector or learned expertise classifier. M2 quality evaluation freezes its expected behavior before measurement and reports conformance without converting synthetic rates into population accuracy.

The Developer Profile is the canonical private state. It may contain more claims and evidence references than any single consumer needs. It is:

- versioned;
- inspectable;
- correctable;
- migratable;
- exportable;
- deletable;
- separated into global and project-scoped observations.

The profile is never implicitly equivalent to a DCP.

The Community reference provider's Store envelope is implementation-internal even though its schema is inspectable in the public repository. Its exportable profile payload may reuse public Evidence and Claim contracts, while store identity, generation, validation, and migration bookkeeping remain private implementation state. An owner-initiated Portable Profile Export wraps only the public profile payload and explicit exclusions; consumers never ingest a Store file as an export or context packet.

The Community Store persists this envelope as immutable generation-addressed files in one canonical private directory. Same-directory exclusive staging is synced and reread before an exclusive hard link activates the final generation; the final value is reread before success. Expected generation and never-overwritten names form the compare-and-set boundary. Loading validates all bounded recognized candidates, chooses the newest valid generation, preserves an older rollback generation, never activates orphan staging, and exposes recovery or cleanup debt. A synthetic legacy migration uses the same activation path. See [ADR-0023](adr/0023-generation-addressed-atomic-local-profile-store.md).

### 5.5 Demand Profile

The Demand Profile represents capabilities relevant to a current project and task. It is derived from explicit task input and authorized project metadata. It is not a generic repository digest.

The draft public envelope carries only opaque demand/project/revision references, bounded task context, typed project-metadata availability, and unique required or supporting capability identifiers with a typed task/project basis. It deliberately excludes Developer Profile content, Evidence, Claims, response policy, grants, credentials, paths, and raw metadata. An empty capability set is valid when demand cannot be established without inventing it. Schema validation does not perform derivation or authorize project access.

In the current runtime, Protocol validates this canonical envelope before Core intersects it with an already loaded Developer Profile. Core uses exact capability identifiers, admits global Claims and current-project-scoped Claims only, preserves unmatched demand explicitly, and returns no Evidence records or complete profile. The result is an immutable compiler input, not a DCP; task prose cannot change selection or policy.

The pure Community Demand producer consumes an authentic filesystem snapshot or explicit unavailable state, one current repository/project binding, optional exact collected-file selection, and bounded structured task capabilities. Only source-language metadata contributes supporting demand; explicit task requirements take priority, and unrelated repositories cannot contribute. Coverage and a deterministic opaque metadata revision remain visible. A bounded set of explicit interpretations triggers one fixed clarification only when effective capability relevance or operation risk differs; equivalent interpretations retain common task input without asking. The authentic pending object resolves an offered choice into a validated Demand Profile with no further question.

Task prose is minimized to a fixed summary, and no path, source text, profile or operation authority enters the output. See [ADR-0025](adr/0025-source-backed-demand-profile-producer.md).

### 5.6 DCP compilation

Core performs the pure relevance intersection before compilation. The compiler then applies:

- declared purpose and audience;
- consumer grant and scopes, when remote;
- task relevance;
- visibility and disclosure rules;
- recency and expiry;
- token and output-size budget;
- redaction invariants;
- client-neutral response policy.

The result contains summarized claims and opaque evidence references. Protocol v1 never embeds raw evidence or source/document excerpts in a DCP. Any future owner-only source viewer is a separate first-party contract.

The reference compiler is pure: IDs and timestamps are injected, authorization is a resolved typed decision, and no clock, random source, filesystem, or network is read. It validates the final DCP through Protocol, replaces sensitive free text, scans the serialized result, and enforces exact UTF-8 byte plus conservative token-accounting bounds. Progressive reduction follows one stable order and returns no packet when the minimum valid projection cannot fit.

### 5.7 Incremental local refresh

Incremental refresh composes the local source boundaries in a bounded private process-local session. The session binds authentic source/identity/risk configuration and complete repository/project mappings. A privilege-reducing selector creates single-repository authorities; both collectors still reauthorize them at use. Before reuse, a bounded metadata-only walk checks canonical identities, directory membership and device/inode/mode/size/mtime/ctime stamps, including the selected repository's standard Git tree. It ignores fixed dependency/state directories and probes only the fixed marker at nested-repository boundaries. Unchanged metadata within the explicit content-observation age reuses authentic source snapshots without content reads or Git subprocesses. Expiry, force or a changed fingerprint requires full collection with matching before/after probes.

The refresh enforces aggregate metadata-observation, collection-count, elapsed-time and retained-cache-byte limits, including the previous derivation. Directory enumeration charges ignored names and pessimistically consumes its allowance on failure. Clocks must remain finite, nonnegative and monotonic across session calls; concurrent refreshes return busy. Records expose source/cache origin, fingerprints, original collection times, check attempts, freshness and fixed reasons. Aggregate `fresh` describes source-cache validation; individual Claims can remain stale under the supplied stale threshold. No cache hit renews collection time.

Authorship, cross-repository duplication/source risk and Evidence/Claim derivation run over the complete fresh source set. The oldest collection timestamp becomes the aggregate observation time. Any incomplete set withholds both aggregate derivation and source payloads, preventing a missing duplicate peer from increasing apparent support. Stale cached sources remain private, invalid sources are evicted, and later successful refresh compares against the previous complete derivation. Complete output retains authentic filesystem snapshots usable by the Demand producer. Restart or configuration change begins a cold session; persistent cache, Store writes and correction-preserving owner workflows remain separate. See [ADR-0026](adr/0026-bounded-incremental-local-refresh.md).

### 5.8 Owner inspection and correction

Owner inspection and correction use a bounded first-party JSON CLI and Community service over authentic Store configuration. Inspection exposes minimized structured Claim, evidence and correction metadata. Correct/dispute/reject append private records, archive exact original Claims and Evidence under deterministic opaque identifiers, and produce an effective disputed assessment. Independent declarations remain unobserved and low confidence. Repeated corrections preserve prior records and use commit order; only verified Store commitment produces a saved acknowledgment.

The derivation composer preserves owner records and archival provenance across refresh/removal. Corrected capability/scope pairs suppress new automated assessments. Core excludes correction targets linked by effective disputes before task intersection. Changed or newly observed sources conservatively mark the effective dispute stale while its history stays immutable. Old derivations and backward owner timestamps fail closed. Existing schema/byte ceilings bound history; no owner record is silently pruned. See [ADR-0027](adr/0027-local-owner-correction-workflow.md) and [owner usage](OWNER_WORKFLOW.md).

### 5.9 Owner portability and verified deletion

The first-party owner CLI supports absent-only import, redacted export and explicit managed-data deletion. Community reconstructs the public Portable Profile Export from an allowlist, preserving typed assessments and correction graphs while replacing private prose, source locations and identifiers. Imports require matching subject identity and revalidate the complete graph before verified Store commitment. Export uses an explicit existing destination, exclusive activation and exact schema/byte readback. Public schemas stay unchanged.

Store mutation gates coordinate writes and migration against a persistent deletion barrier, refining ADR-0023's earlier lock-free concurrency design. Recognized Store generations/staging files are removed under bounded scans, with synchronization before removal where supported and verified absence afterward. The process-local incremental registry is capped at 128 live sessions and supports subject-scoped disposal. The CLI composes adapter-owned cleanup through an injected callback; Community does not depend on Codex. Its explicit all-adapter-cache scope reflects the fixture cache's lack of Store binding. Both stores retain content-free barriers to prevent resurrection. Crashed gates require explicit owner recovery after writers stop. See [ADR-0028](adr/0028-owner-portability-and-verified-deletion.md) and the [data inventory and recovery procedure](OWNER_WORKFLOW.md#delete-managed-local-data).

## 6. Provider interface

The local runtime combines authentic configuration, incremental refresh, correction-preserving persistence and owner operations. Store/source directory overlap is rejected. The owner launcher accepts bounded sequential JSON requests; only explicit refresh collects or persists derived state. Its separate MCP mode uses an asynchronous Store-backed Provider with the existing public read surface. Each protected request reloads and validates the Store, derives task demand from explicit capabilities and available authentic project metadata, and delegates task intersection/redaction/budgets to Core. Incomplete refresh withholds that runtime's context until a verified refresh succeeds. Restart retains Store history and begins with no source snapshots; consumers never trigger collection. See [ADR-0030](adr/0030-local-community-workflow-composition.md) and [local workflow](LOCAL_COMMUNITY.md).

Bounded owner capability-evidence lookup and `doctor` run through the first-party CLI. Evidence summaries reuse the public Provider evidence shape and validate it before returning a private owner view with typed assessment/history and explicit truncation. Diagnostic references are hashes and limitation text is an exact allowlist. This does not enable evidence disclosure through consumer MCP. Doctor independently reports actual module/runtime checks, Store validation and mutation-gate state, adapter-owned read-only cache inventory, and optional DCP size/expiry/budget validation. The Community service receives a trusted adapter probe without importing a client. It exposes only fixed states/counts, performs no repair, and explicitly identifies checks it cannot perform. See [ADR-0029](adr/0029-owner-evidence-and-safe-diagnostics.md).

An `EvidenceCollector` or `SourceAdapter` reads an authorized source and emits normalized evidence; it does not own profile or delivery semantics. A `ProfileProvider` may be the local Community implementation, an independent implementation, or a future remote provider. It can operate from collectors or an imported profile and need not collect sources itself. At minimum it must be able to:

- report supported protocol versions and capabilities;
- return profile metadata;
- compile a task-context packet;
- explain an authorized claim through bounded metadata;
- expose typed unsupported, stale, invalid, and unauthorized states;
- preserve protocol semantics independent of transport.

The draft public [Profile Provider contract](../schemas/profile-provider/0.1.0.schema.json) makes this boundary executable as a capability descriptor plus discriminated request/response fragments. Providers advertise honest operation subsets and fixed limits; consumers correlate every response to its request and accept no silent operation fallback. The contract has no client or transport types and exposes neither collector configuration nor profile existence during capability discovery.

Administrative operations such as connecting sources, editing a profile, exporting, deleting, or granting consumers are owner operations. They do not need to be freely callable by a model and should begin in a first-party CLI or UI.

## 7. Client adapters

An adapter translates a client's lifecycle and configuration into Core operations. It may:

- request a DCP at session or task start;
- restore a compact packet after client-side compaction;
- make evidence lookup available on demand;
- map response-policy fields into client-supported instructions;
- report unsupported lifecycle behavior.

It may not:

- redefine claim semantics;
- inspect sources directly;
- place client-specific types in Core or Protocol;
- silently expand disclosure;
- interpret the profile as authorization.

Codex is the first live-client target. The existing hook adapter is fixture-backed; guided Store-backed use must be verified separately. The generic consumer proves only structured conformance, not equivalent model responses or support for every client.

## 8. MCP surfaces

### 8.1 Local

The initial MCP server uses `stdio` and a small read-oriented tool surface. Processes running as the same operating-system user are not automatically isolated, and the connected model process is not assumed to be the profile owner. Each client installation has explicit authorized roots and profile-store configuration; local files use restrictive ACLs where supported; owner operations remain in the first-party CLI/UI; and model-facing evidence lookup is disabled by default. Output limits and redaction still apply.

### 8.2 Remote

A future remote provider may expose MCP over Streamable HTTP on stable HTTPS. Private data requires OAuth 2.1-compatible authorization, PKCE, protected-resource metadata, resource/audience binding, per-call token validation, short-lived access, revocation, and minimal step-up scopes.

The remote MCP derives the subject, consumer, grant, and tenant from validated authorization. It never accepts a client-supplied arbitrary developer identifier as authority and never passes a consumer token to an upstream source provider.

## 9. Remote deployment planes

The future hosted implementation separates:

- **Control plane:** accounts, source connections, consumer registration, consent, grants, retention, and audit policy.
- **Data plane:** bounded ingestion, evidence normalization, claim derivation, profile versions, correction precedence, and DCP compilation.
- **Integration plane:** remote MCP, SDK/API compatibility, rate limits, protocol negotiation, and revocation enforcement.

Every persisted hosted record carries a tenant boundary. Consumer-facing identifiers are opaque and may be pairwise per developer-consumer relationship to reduce cross-service correlation.

## 10. Suggested repository boundaries

The workspace keeps Protocol below Core, Core below Community Provider, and client adapters outside those libraries:

```text
packages/protocol
        ↑
packages/core
        ↑
packages/community-provider
        ↑
apps/cli             apps/mcp-local
        ↑                    ↑
adapters/reference-clients
```

Optional deployment components depend on public protocol packages. Protocol, Core and the local runtime must not depend on a hosted implementation.

### Libraries and applications

- `packages/protocol` owns exact runtime contract validation and imports no Core or client code. `packages/core` depends only on Protocol for contracts. Its synthetic fixture loader validates, detaches and deeply freezes profile payloads; claim precedence, task relevance and DCP compilation are separate pure boundaries. See [ADR-0012](adr/0012-fixture-profile-package-foundation.md) and [ADR-0013](adr/0013-claim-precedence-response-policy.md).
- `packages/community-provider` depends on Core and Protocol. It owns local configuration, collectors, pre-Evidence assessment, the private Store, derivation and owner workflows described in Section 5. Its fixture Provider injects time and identifiers and implements the same transport-neutral contract as the Store-backed Provider.
- `apps/mcp-local` owns MCP lifecycle and newline framing. It maps only the two model-facing read operations, bounds every input/output line and has no network module or listener. Compatibility is limited to the referenced MCP `2025-11-25` profile. See [ADR-0016](adr/0016-local-provider-mcp-stdio.md).

### Source and persistence ports

Local source access stays inside Community Provider and outside Protocol/Core/MCP payloads. The filesystem collector accepts only live private authority, rechecks canonical identity and containment for every root, repository, directory and selected file, and uses an injected Node port limited to path inspection, the fixed nested-repository marker, bounded enumeration and bounded read-only regular-file handles.

Collection is sequential and all-or-nothing. Fixed version-control, dependency and local-state directories are ignored; a nested `.git` marker ends traversal; unsupported files are counted but not opened; links and special files fail closed. Supported UTF-8 documents, manifests and source files produce immutable private metadata: repository-relative paths, SHA-256 digests, byte/line/structure counts, fixed formats/languages, test markers and bounded sanitized `package.json` names. See [ADR-0018](adr/0018-authorized-local-repository-configuration.md) and [ADR-0019](adr/0019-bounded-filesystem-metadata-collector.md).

The Git port reads bounded `HEAD`, branch/packed-ref and shallow control data, validates the entire selected object-store metadata before and after use, and rejects alternate or linked object databases. Exact allowlisted plumbing commands run with `shell: false` against the authorized object directory from a fresh trusted temporary bare directory. Repository configuration, worktree attributes, hooks, filters, external diff, text conversion, pagers, replacement objects, lazy fetching, remotes and credentials stay outside that boundary.

Git output contains only SHA-1/SHA-256 object IDs, parent relationships, UTC timestamps, SHA-256 identity/coauthor digests and safe changed paths under commit/object/path/output/time ceilings. Neither collector emits raw source, absolute paths, manifest values, raw identities/messages, native diagnostics, Evidence, Claims or policy. See [ADR-0020](adr/0020-quarantined-bounded-git-metadata-collector.md).

The optional public-history port remains inside Community Provider and owner refresh. Its closed temporary consent binds exact authorized repository objects to validated public `github.com` names. The port uses only fixed `gh api` GET calls, verifies public visibility and converts bounded commit responses into the same private Git snapshot fields. Local Git remains first, remote failure cannot bypass an authorization/validation failure, no raw response or credential is persisted, and Provider/MCP requests cannot trigger collection. See [ADR-0039](adr/0039-local-first-bounded-public-history.md).

Identity resolution hashes explicitly configured developer/shared/bot identities through the collector's normalization and rejects duplicate cross-role digests. Its immutable configuration contains no raw identity. The pure assessor validates the complete Git snapshot and annotation references, then emits only opaque IDs, fixed enums/limitations, timestamps and conservative ceilings. Malformed or dangling input yields no partial result. Pair/squash annotations describe attribution, never capability; automatic identity/bot/squash heuristics are prohibited. See [ADR-0021](adr/0021-explicit-conservative-git-authorship-assessment.md).

Source-risk classification is also pure and all-or-nothing. Exact snapshot correspondence and explicit annotation targets are validated before combining fixed path indicators, exact digest duplication and bounded attribution. Separate source/authorship limitations prohibit originality claims and standalone demonstrated depth, and every flagged source is down-ranked before derivation. See [ADR-0022](adr/0022-conservative-evidence-source-risk-classification.md).

The Store persists only validated internal envelopes. It writes no repository and exposes no filesystem path through Protocol/Core/Provider/MCP objects. Generation-addressed activation, readback, rollback, recovery and synthetic migration follow Section 5.4; mutation gates and deletion barriers follow Section 5.9.

Derivation is separate from persistence. It reads no filesystem or clock, accepts only sanitized authentic source-risk metadata and explicit inputs, and emits a Store-compatible project/evidence/claim graph with internal fingerprints and invalidation events. The owner runtime controls collection and persistence; owner operations control declarations, corrections, disputes and rejection.

### Consumers

`adapters/codex` owns repository-local lifecycle hooks. `UserPromptSubmit` requests fixture task context; `SessionStart` restores only an unexpired minimized structured cache on resume or after compaction. Consumer validation and a closed renderer admit only Claim capability/state/depth and the six Response Policy fields. Any input, Provider, cache-read/clear, validation, expiry or adapter failure continues the host without context. The separate MCP surface remains available to other consumers. See [ADR-0017](adr/0017-codex-lifecycle-hook-adapter.md).

`consumers/generic` is a materially different stateless JSON process depending only on the Protocol artifact. It validates DCP shape, expiry and audience and emits only Claim capability/state/depth, the six Response Policy fields, expiry and an explicit no-authority marker. It has no Core, Provider, source, profile, lifecycle, cache, network or write capability. Invalid or unavailable input produces one content-free no-context result. `FMU-E-016` compares its all-state fixture projection with the Codex structured mapper; this proves equivalent structured meaning for those two consumers only. See [ADR-0036](adr/0036-independent-generic-conformance-consumer.md).

### Private package candidates

Only Protocol, Core and Community Provider are library package candidates. Bounded staging emits JavaScript, declarations and required runtime schemas, removes source/configuration and checks the exact npm file allowlist. Root tooling, fixture-dependent applications and client adapters stay outside these packages. See [ADR-0034](adr/0034-community-package-dry-run-boundary.md).

Protocol's private local tarball provides typed root and conformance entry points, exact subpaths for seven public draft schemas and public JSON fixture corpora, and no internal Store schema/corpus or development fixture carriers. Repository conformance checks use its distributed validator. Core, Community Provider, applications, adapters and transport behavior are not part of the Protocol artifact. See [ADR-0035](adr/0035-protocol-sdk-conformance-distribution.md).

The three exact private tarballs are installed together in a temporary lockfile-derived offline consumer. Artifact checks cover Provider/DCP/Export contracts, absent-only import, verified export, expected-generation update/conflict, explicit synthetic migration, prior-valid-generation recovery and Store/Export/DCP boundary rejection. That local compatibility matrix alone proves neither application packaging nor cross-platform behavior. Publication remains separately gated. See [ADR-0037](adr/0037-community-artifact-compatibility-matrix.md).

The platform lifecycle composes those installed libraries into a temporary synthetic application on Windows, macOS and Linux. Two private prerelease candidate graphs from the same source revision prove exact npm replacement and Store compatibility, then the consumer verifies correction-preserving refresh, task context, export, managed deletion, package uninstall and retained source/export data. The version-only transition is not evidence of migration between different implementations, a packaged application, public compatibility or release support. See [ADR-0038](adr/0038-cross-platform-community-lifecycle.md).

## 11. Failure semantics

- Optional evidence provider unavailable: return a typed partial/stale result and continue without weakening disclosure.
- Profile absent: return a typed empty-profile state, not an invented assessment.
- Schema incompatible: fail safely with supported-version information.
- Output budget exceeded: reduce optional detail deterministically; never truncate into invalid JSON.
- Authorization missing or invalid: return no protected data.
- Redaction invariant cannot be established: return no affected payload.
- Persistence failure: keep the prior valid version and report the new write as unpersisted.
- Adapter unavailable: ordinary host work continues without Fork Me Up behavior.

## 12. Architectural quality attributes

- **Portability:** open versioned contracts and conformance fixtures.
- **Privacy:** local-first processing and minimized projections.
- **Explainability:** evidence-linked claims and explicit limitations.
- **Reliability:** atomic writes, typed degradation, bounded work, and deterministic compilation.
- **Security:** least privilege, untrusted-input treatment, isolated credentials, and fail-closed disclosure.
- **Testability:** injected side effects, synthetic fixtures, stable clocks, and contract tests.
- **Evolvability:** provider ports and adapters without premature distributed services.

## 13. Deliberately deferred architecture

- Google Workspace and broad personal-data connectors;
- a vector database or embeddings;
- generic conversation memory;
- organization profiles and rankings;
- employer-facing access;
- arbitrary remote source connectors;
- enterprise self-hosting or VPC deployment;
- native integration code for unvalidated partners.

Each requires a new hypothesis, accepted ADR, data-flow update, threat-model review, and roadmap gate.

## 14. References

- [Product specification](PROJECT_SPEC.md)
- [Protocol](PROTOCOL.md)
- [Security and privacy](SECURITY_PRIVACY.md)
- [Roadmap](ROADMAP.md)
- [MCP specification](https://modelcontextprotocol.io/specification/2025-11-25/)
- [OpenAI — MCP server](https://developers.openai.com/plugins/concepts/mcp-server)
- [OpenAI — Plugin authentication](https://developers.openai.com/plugins/build/auth)
- [GitHub — Deciding when to build a GitHub App](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/deciding-when-to-build-a-github-app)
