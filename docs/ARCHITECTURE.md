# Fork Me Up — Architecture

> Status: pre-implementation architecture baseline  
> Version: 0.1  
> Last updated: September 5, 2026

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

### 3.5 Cloud/Pro — proprietary service, optional

The managed product may add:

- accounts, subscription, and control plane;
- GitHub App installation and selected-repository grants;
- isolated ingestion workers and encrypted credential storage;
- stronger cross-repository attribution and evidence fusion;
- continuously updated profile versions;
- owner review, corrections, export, and deletion;
- a policy and consent service;
- authenticated remote MCP delivery;
- audit events, quotas, rate limits, reliability, and support.

Revocation blocks future calls within a documented enforcement SLA but cannot retrieve an already delivered packet. Short DCP TTLs limit exposure, and consent states this limitation.

Cloud implements the open Profile Provider and DCP contracts. Its internal storage may contain private implementation fields, but ordinary consumers never require them and owner exports remain conformant to the public Portable Profile Export.

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
- no private data leaves the machine through Fork Me Up;
- the host model may still receive the minimized DCP according to that host's own configuration and terms;
- profile inspection, correction, export, and deletion remain local.

### 4.2 Community with bounded public history

A later Community provider may use an existing local Git or GitHub authentication path for repositories selected by the developer. Network use must be explicit, visible, bounded, cached, and optional. No token is copied into Fork Me Up profile data or logs.

### 4.3 Cloud/Pro

```text
selected GitHub repositories
          ↓  Source Grant
GitHub App + ingestion workers
          ↓
tenant-isolated evidence and profile versions
          ↓
policy + Sharing Grant + DCP compiler
          ↓
authenticated remote MCP
          ↓
authorized consumer
```

The ingestion authorization and delivery authorization are separate. A consumer never receives the GitHub token, raw repository, or a queryable developer directory.

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

### 5.3 Claim derivation

Claims are produced from evidence rules and developer input. The engine:

- keeps observed and inferred facts distinct;
- represents adjacent transfer explicitly;
- records insufficient evidence;
- prevents uncertain authorship alone from producing high-confidence depth;
- applies correction precedence without erasing history;
- never converts a confidence category into a person-ranking score.

### 5.4 Developer Profile

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

### 5.5 Demand Profile

The Demand Profile represents capabilities relevant to a current project and task. It is derived from explicit task input and authorized project metadata. It is not a generic repository digest.

The draft public envelope carries only opaque demand/project/revision references, bounded task context, typed project-metadata availability, and unique required or supporting capability identifiers with a typed task/project basis. It deliberately excludes Developer Profile content, Evidence, Claims, response policy, grants, credentials, paths, and raw metadata. An empty capability set is valid when demand cannot be established without inventing it. Schema validation does not perform derivation or authorize project access.

At runtime, Protocol validates this canonical envelope before Core intersects it with an already loaded Developer Profile. Core uses exact capability identifiers, admits global Claims and current-project-scoped Claims only, preserves unmatched demand explicitly, and returns no Evidence records or complete profile. The result is an immutable compiler input, not a DCP; task prose cannot change selection or policy.

### 5.6 DCP compilation

M1-S03 performs the pure relevance intersection before the compiler. The compiler then applies:

- declared purpose and audience;
- consumer grant and scopes, when remote;
- task relevance;
- visibility and disclosure rules;
- recency and expiry;
- token and output-size budget;
- redaction invariants;
- client-neutral response policy.

The result contains summarized claims and opaque evidence references. Protocol v1 never embeds raw evidence or source/document excerpts in a DCP. Any future owner-only source viewer is a separate first-party contract.

The M1-S04 reference compiler is pure: IDs and timestamps are injected, authorization is a resolved typed decision, and no clock, random source, filesystem, or network is read. It validates the final DCP through Protocol, replaces sensitive free text, scans the serialized result, and enforces exact UTF-8 byte plus conservative token-accounting bounds. Progressive reduction follows one stable order and returns no packet when the minimum valid projection cannot fit.

## 6. Provider interface

An `EvidenceCollector` or `SourceAdapter` reads an authorized source and emits normalized evidence; it does not own profile or delivery semantics. A `ProfileProvider` may be the local Community implementation, an independent implementation, or Fork Me Up Cloud. It can operate from collectors or an imported profile and need not collect sources itself. At minimum it must be able to:

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

Codex is the first candidate reference adapter because skills, MCP, and lifecycle hooks can exercise the full flow. Portability is not considered proven until the same protocol semantics work through a materially different consumer without a Core fork.

## 8. MCP surfaces

### 8.1 Local

The initial MCP server uses `stdio` and a small read-oriented tool surface. Processes running as the same operating-system user are not automatically isolated, and the connected model process is not assumed to be the profile owner. Each client installation has explicit authorized roots and profile-store configuration; local files use restrictive ACLs where supported; owner operations remain in the first-party CLI/UI; and model-facing evidence lookup is disabled by default. Output limits and redaction still apply.

### 8.2 Remote

The commercial MLP may expose MCP over Streamable HTTP on stable HTTPS. Private data requires OAuth 2.1-compatible authorization, PKCE, protected-resource metadata, resource/audience binding, per-call token validation, short-lived access, revocation, and minimal step-up scopes.

The remote MCP derives the subject, consumer, grant, and tenant from validated authorization. It never accepts a client-supplied arbitrary developer identifier as authority and never passes a consumer token to an upstream source provider.

## 9. Cloud planes

The future hosted implementation separates:

- **Control plane:** accounts, billing, source connections, consumer registration, consent, grants, retention, and audit policy.
- **Data plane:** bounded ingestion, evidence normalization, claim derivation, profile versions, correction precedence, and DCP compilation.
- **Integration plane:** remote MCP, SDK/API compatibility, rate limits, protocol negotiation, and revocation enforcement.

Every persisted Cloud record carries a tenant boundary. Consumer-facing identifiers are opaque and may be pairwise per developer-consumer relationship to reduce cross-service correlation.

## 10. Suggested repository boundaries

The exact workspace tooling is an M0 ADR, but dependency direction should resemble:

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

Future proprietary services should live in a separately access-controlled repository or workspace while consuming released public protocol packages. Public packages must not import proprietary modules.

M1-S01 instantiated the first two boundaries as private unreleased npm workspaces. `packages/protocol` owns exact runtime contract validation and imports no Core or client code. `packages/core` depends on Protocol and began with deterministic, detached, deeply immutable loading of validated synthetic profile fixtures. That slice did not contain claim precedence, response policy, Demand Profile intersection, DCP compilation, persistence, provider, transport, or adapter behavior. See [ADR-0012](adr/0012-fixture-profile-package-foundation.md).

M1-S02 adds pure Claim behavior precedence and Response Policy selection to Core. It accepts already validated, already relevant Claims, preserves their full state-matched provenance, and chooses the most conservative required communication posture without client types or free-form instructions. Demand Profile relevance and DCP projection remain separate downstream boundaries. See [ADR-0013](adr/0013-claim-precedence-response-policy.md).

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
