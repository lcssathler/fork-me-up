# Fork Me Up — Developer Context Protocol

> Status: pre-implementation protocol draft  
> Draft version: 0.1  
> Last updated: September 5, 2026

This document defines the public interoperability boundary. M0-S08 through M0-S11 provide the unreleased DCP, Evidence, Claim, Portable Profile Export, and Demand Profile `0.1.0` authoring schemas while keeping the Community Profile Store implementation-internal. M0-S12 adds the unreleased client-neutral Profile Provider and provider/consumer conformance `0.1.0` contracts. Once a schema version is released, compatibility follows the rules in this document.

## 1. Purpose

The Developer Context Protocol lets an evidence provider communicate a small, traceable, task-relevant view of a developer profile to a compatible AI tool without exposing the complete profile or requiring a particular model, client, source provider, or backend.

The primary exchange object is the **Developer Context Packet (DCP)**.

## 2. Objects and boundaries

### 2.1 Evidence

An observation about an approved source. Evidence describes what was found; it does not itself assert that the developer knows a capability.

The independent [Evidence `0.1.0` authoring schema](../schemas/evidence/0.1.0.schema.json) fixes `kind` to `observation` and records:

- an opaque evidence identifier and capability signal;
- a source class, safe source-relative reference, opaque repository/revision references, and visibility;
- attributable, coauthored, bot, unknown, or non-author-specific authorship assessment;
- observed and collection timestamps, categorical strength, and bounded limitations;
- extractor name/version and an invalidation rule with an opaque fingerprint.

Attributed and coauthored observations require an opaque subject reference; bot, unknown, and `not-applicable` assessments prohibit one. Local, public, and private source classes require the matching visibility. Collection cannot predate observation. A source-relative reference is metadata inside the private evidence boundary: its syntax rejects absolute, drive, backslash, and traversal paths, but validation does not authorize or read that location. A private visibility/class value represents metadata only and does not add private-repository access.

### 2.2 Claim

A capability statement supported by evidence, inferred by adjacency, declared by the developer, marked as insufficiently evidenced, or disputed by the developer.

The independent [Claim `0.1.0` authoring schema](../schemas/claim/0.1.0.schema.json) pairs each state with an explicit provenance basis:

| Claim state | Required `basis.kind` | Authoring constraint |
|---|---|---|
| `demonstrated` | `evidence` | Non-empty evidence references, non-null observed depth, and observed-through time. |
| `adjacent` | `adjacency` | Non-empty evidence references and source capabilities plus a bounded transfer rationale; target observed depth remains null. |
| `self-declared` | `declaration` | Opaque declaration reference; no evidence-derived depth or observation timestamp. |
| `insufficient-evidence` | `insufficient-evidence` | Null observed depth and low confidence; never a negative-knowledge assertion. |
| `disputed` | `dispute` | Opaque correction reference/summary, non-empty original evidence references, and observed-through time; original observed depth may remain visible. |

Project-scoped claims require an opaque project reference; global claims prohibit one. References are structurally opaque and are not resolved by authoring validation. The schema does not implement derivation or correction precedence and does not turn descriptive text into policy.

### 2.3 Developer Profile Store

The provider's canonical private state containing claims, corrections, preferences, and evidence references. Its internal schema is not an interchange contract and may differ between providers.

The reference Community provider's [internal Store `0.1.0` schema](../schemas/internal/community-profile-store/0.1.0.schema.json) is published for implementation review, not provider interoperability. It declares `storeSchemaVersion` and `kind: community-profile-store`, contains the canonical profile payload, and adds store identity plus generation, creation, update, validation, and migration bookkeeping. Independent providers do not consume or reproduce this envelope. Credentials, raw source, and grants remain outside it.

### 2.4 Portable Profile Export

An owner-initiated, open, versioned export used for portability or migration. It is distinct from internal provider storage and from a DCP.

The public [Portable Profile Export `0.1.0` schema](../schemas/portable-profile-export/0.1.0.schema.json) declares `schemaVersion` and `kind: portable-profile-export`. Its profile payload contains bounded Evidence and Claim records using their exact independent schemas, plus typed declarations, corrections, project references, and preferences. Opaque references must resolve within the envelope and referenced declaration/correction capabilities must match the Claim.

The export requires fixed exclusions for credentials, raw source, Source Grants, Sharing Grants, and provider-internal state. Closed authoring validation rejects those fields, but an exclusions object is not proof of redaction or owner intent. A future exporter must construct the projection from authorized private state, validate it, write it safely, and only then report success. The Store, Portable Profile Export, and DCP authoring schemas reject one another. [ADR-0009](adr/0009-profile-store-export-boundary.md) records this boundary.

M1-S01 adds the first runtime use of this draft through the private unreleased Protocol and Core workspaces. Synthetic Developer Profile fixtures are valid export envelopes used only as input carriers: Protocol validates the canonical shape and reference integrity, then Core copies and deeply freezes the profile payload and `profileVersion` while discarding export metadata. This does not create another profile contract, accept a Store envelope, implement export, or grant policy or disclosure authority. [ADR-0012](adr/0012-fixture-profile-package-foundation.md) records the package boundary.

### 2.5 Demand Profile

The capabilities relevant to a project and task. It constrains which profile facts can help the consuming tool.

The public [Demand Profile `0.1.0` schema](../schemas/demand-profile/0.1.0.schema.json) binds an opaque current-project reference, bounded explicit task summary and purpose, project-metadata availability, and a bounded list of unique capability identifiers. Each capability is `required` or `supporting` and records whether it arose from task input, authorized project metadata, or both; project-derived bases are invalid when metadata is unavailable. An empty list preserves uncertainty rather than inventing task demand.

Demand Profile describes the task, not the developer. It contains no Claim, Evidence, profile, response policy, grant, credential, raw project metadata, source content, or path. Its task summary is untrusted data and cannot set policy or authorize access. Metadata availability and opaque revision fields do not prove authorization, freshness, or relevance. Runtime derivation remains later work. M1-S03 adds canonical Protocol runtime validation and a pure Core intersection: exact capability identifiers select global Claims and project-scoped Claims only for the current project, with unmatched demand explicit and unrelated profile records omitted. [ADR-0010](adr/0010-demand-profile-draft-contract.md) records the contract and [ADR-0014](adr/0014-demand-profile-intersection.md) records the intersection.

### 2.6 Developer Context Packet

An always-small, task-scoped, expiring projection compiled for a purpose, audience, and disclosure budget. It is never a full-profile export or public portfolio document.

### 2.7 Response Policy

Client-neutral behavioral guidance derived from relevant claims. A client may map supported portions into its own instruction mechanism, but it must not reinterpret a capability level or treat the policy as authorization.

## 3. DCP design rules

A conforming DCP:

- declares a schema version;
- identifies purpose, audience class, task summary, generation time, and expiry;
- contains only task-relevant claims;
- distinguishes claim state, observed depth, and confidence;
- summarizes provenance with opaque or source-relative references;
- records uncertainty and limitations;
- declares redactions and disclosure class;
- respects an explicit byte or token budget;
- excludes raw credentials, raw evidence, and every source-code or document excerpt in protocol v1;
- remains valid structured data after budget reduction;
- carries no execution, network, filesystem, or write authority.

## 4. Draft packet shape

```json
{
  "schemaVersion": "0.1.0",
  "packetId": "dcp_opaque_id",
  "profileVersion": "profile_opaque_version",
  "purpose": "coding-assistance",
  "audience": {
    "class": "local-assistant",
    "consumerId": null
  },
  "task": {
    "summary": "Add a CI workflow for the current project",
    "requiredCapabilities": [
      "delivery.ci.github-actions"
    ]
  },
  "claims": [
    {
      "claimId": "claim_opaque_id",
      "capability": "delivery.ci.github-actions",
      "state": "insufficient-evidence",
      "observedDepth": null,
      "confidence": "low",
      "scope": "global",
      "adjacentFrom": [
        "delivery.ci.generic"
      ],
      "evidenceRefs": [],
      "limitations": [
        "No attributable workflow evidence in selected repositories"
      ],
      "freshness": {
        "observedThrough": "2026-09-04T00:00:00Z",
        "stale": false
      }
    }
  ],
  "uncertainties": [
    {
      "capability": "delivery.ci.github-actions",
      "reason": "insufficient-evidence",
      "material": true
    }
  ],
  "responsePolicy": {
    "mode": "teach-while-doing",
    "explainPurposeBeforeCommands": true,
    "includeExpectedResult": true,
    "includeRiskAndRollback": true,
    "analogyCapabilities": [
      "delivery.ci.generic"
    ],
    "questionBudget": 1
  },
  "provenanceSummary": {
    "evidenceCount": 0,
    "sourceClasses": [
      "selected-local-repository"
    ]
  },
  "disclosure": {
    "class": "task-context",
    "redactionsApplied": [
      "absolute-paths",
      "private-source-names"
    ]
  },
  "generatedAt": "2026-09-04T00:00:00Z",
  "expiresAt": "2026-09-05T00:00:00Z",
  "budget": {
    "maxBytes": 32768
  }
}
```

The example is the [insufficient-evidence fixture](../fixtures/dcp/0.1.0/valid/insufficient-evidence.json) for the [DCP 0.1.0 schema](../schemas/dcp/0.1.0.schema.json). It remains an unreleased draft and is not proof of provider or consumer conformance. [ADR-0007](adr/0007-dcp-draft-schema-validation.md) records the schema, and [ADR-0015](adr/0015-deterministic-bounded-dcp-compiler.md) records its M1-S04 runtime compilation.

### 4.1 Exact draft authoring rules

The schema validates the exact producer/fixture shape and rejects unknown properties at every object boundary. Released consumers remain governed by Section 12. The M0-S12 provider contract contains an explicit bounded `extensions` object for safely ignorable namespaced additions while arbitrary fields remain invalid. This development checker accepts only draft `0.1.0`; it does not claim released-version compatibility.

The draft gives existing concepts explicit representations:

- `audience.class` is `local-assistant` or `external-consumer`; the latter requires a non-null opaque `consumerId`. These labels do not prove identity or a Sharing Grant.
- `responsePolicy.mode` is `concise`, `analogy`, or `teach-while-doing`. Policy fields contain only the declared enums, booleans, capability identifiers, and a question budget of 0 or 1; free-form instruction properties are rejected.
- Compact `demonstrated` summaries require non-null observed depth and at least one evidence reference. `adjacent`, `self-declared`, and `insufficient-evidence` summaries have null observed depth; transfer or declaration is not an observation of the target capability.
- An `adjacent` summary requires non-empty `adjacentFrom` and an inert `adjacentRationale`. A `disputed` summary requires an opaque `correctionRef` and inert `correctionSummary`, retaining its original evidence references. Full Claim/Evidence schemas and precedence enforcement remain M0-S09 and later runtime work.
- `freshness.observedThrough` can be null when there is no observation. Otherwise timestamps use real calendar dates in canonical UTC whole seconds (`YYYY-MM-DDTHH:mm:ssZ`). Expiry must follow generation. Validation does not consult the current clock or treat historical/stale data as fresh.

### 4.2 Draft limits and validation scope

| Value | Draft bound |
|---|---|
| `budget.maxBytes` | Integer from 1 through 32,768; the entire compact JSON serialization in UTF-8, including the budget, must fit. |
| Opaque references | 1–128 ASCII letters, digits, underscores, or hyphens; first character is alphanumeric. Syntax alone does not prove redaction or pairwise identity. |
| Capability and metadata labels | 1–128 lowercase ASCII letters/digits with dot or hyphen separators. No taxonomy registry is established here. |
| Task summary | 1–1,024 Unicode code points. |
| Limitation, uncertainty reason, adjacent rationale, correction summary | 1–256 Unicode code points each. |
| Claims, uncertainties, required/analogy/adjacent capabilities, evidence references | At most 32 entries per array; identifier arrays are unique. |
| Limitations, source classes, applied-redaction labels | At most 8, 8, and 16 entries respectively. |
| Evidence count | Integer from 0 through 1,000,000; this metadata is not verification of the underlying evidence. |

`npm run schema:check` checks the committed corpus and supplements JSON Schema with expiry ordering and the compact-byte check. Fixture files may contain whitespace and are separately capped at 65,536 raw bytes before JSON parsing. A failed check returns a fixed diagnostic and no input content. The command does not accept file arguments, fetch references, compile context, truncate a packet, or read a developer's repositories/profile.

M1-S04 makes Protocol the runtime validator for this same exact contract and adds a pure Core compiler. Packet identifiers and timestamps are injected. The compiler accepts a previously resolved authorization decision, applies only compatible local `task-context` or external `consumer-session` shapes, projects compact task-relevant Claim summaries, derives structured uncertainties, redacts sensitive free text, and validates the final packet before returning it. It reads no clock, randomness, source, profile store, network, or client state.

The compiler request adds an input-only `maxTokens` from 1 through 8,192. Core uses one conservative portable accounting unit per UTF-8 byte rather than assuming a model tokenizer; emitted bytes must satisfy both this bound and `budget.maxBytes`. Progressive reduction removes limitations, non-demonstrated evidence references, non-material uncertainties, and lower-retention Claim summaries in a fixed order. It never truncates JSON or free text to force validity. A projection that still cannot fit returns no packet.

The same command checks the independent Evidence and Claim corpora through the shared bounded fixture reader. Evidence validation additionally enforces collection-at-or-after-observation ordering. All schemas are self-contained and use only local fragment references. These development checks do not resolve opaque references, inspect a source, derive a Claim, apply correction precedence, or authorize disclosure.

M0-S10 extends the command to the internal Store and public Portable Profile Export corpora. Their committed schema dependencies are preloaded by fixed local URLs and referenced through stable URNs; no network or arbitrary schema loader is used. Supplementary checks enforce unique and resolved in-envelope provenance, matching correction/declaration capabilities, resolved project scope, nested Evidence semantics, and ordered Store timestamps. They do not implement persistence, atomic replacement, migration, export, deletion, or correction precedence.

M0-S11 adds the self-contained Demand Profile corpus. Its supplementary check enforces unique capability identifiers and rejects project-derived bases when metadata is unavailable; schema cases cover metadata/revision consistency, task bounds, typed relevance/basis, prohibited profile/raw/policy fields, and cross-envelope rejection. Validation does not read project metadata, derive task demand, interpret task text, intersect a profile, or compile a DCP.

These checks cannot establish source attribution, task relevance, actual redaction, grant validity, correction precedence, or unlinkability. Bounded free text remains unprivileged data and may be structurally valid even when it contains instruction-like or sensitive text. Future runtime boundaries must enforce the security and disclosure invariants before any packet is shared. This slice does not satisfy MCP integration or behavioral evaluation gates.

## 5. Claim semantics

### 5.1 State

Allowed initial states:

- `demonstrated`
- `adjacent`
- `self-declared`
- `insufficient-evidence`
- `disputed`

`demonstrated` means selected evidence supports the claim. It does not certify the person. `adjacent` requires a visible source capability and transfer rationale. `self-declared` must never be relabeled as observed. `disputed` preserves the original provenance and the developer's correction.

### 5.2 Observed depth

Allowed initial values:

- `exposure`
- `practical-use`
- `demonstrated-depth`

Depth is null when the available evidence cannot support a level.

### 5.3 Confidence

Allowed initial values:

- `low`
- `medium`
- `high`

Confidence applies to support for the claim, not the person's seniority. Providers must document their rules and may be more conservative than the reference implementation. Numeric probability fields are reserved until a calibration methodology exists.

### 5.4 Scope

- `global`: evidence can reasonably inform tasks beyond one project.
- `project`: evidence describes a project-specific convention or context and must not be promoted to personal proficiency without additional support.

### 5.5 Provenance

A compact packet uses opaque or sanitized evidence references. A reference must be resolvable only through an authorized provider operation. It must not reveal an absolute path, private repository name, user email, access token, or raw source fragment.

The independent Claim record retains the fuller state-matched basis described in Section 2.2. A DCP deliberately projects only the bounded summary required for the task; it never embeds an independent Claim or Evidence record. [ADR-0008](adr/0008-evidence-claim-draft-contracts.md) records this boundary and the unreleased authoring decisions.

### 5.6 Behavior precedence and Response Policy

M1-S02 applies a conservative priority only after Claims are validated and selected as task-relevant: disputed, insufficient-evidence, self-declared, adjacent, then demonstrated. This priority selects the minimum guidance for a combined task; it does not collapse, reclassify, or delete any Claim. Stable state, capability, and claim-identifier ordering makes the result independent of input order and locale.

Disputed, insufficient, self-declared, or empty inputs select `teach-while-doing`; adjacent selects `analogy`; demonstrated selects `concise`. A guided developer preference can request more explanation but no preference can suppress uncertainty safeguards. Analogy capabilities come only from structured `adjacentFrom` fields; free text has no policy authority. M1-S03 supplies the task-relevant Claim set through exact Demand Profile intersection. The result uses the existing DCP Response Policy fields but is not yet a DCP. [ADR-0013](adr/0013-claim-precedence-response-policy.md) records the policy and [ADR-0014](adr/0014-demand-profile-intersection.md) records task selection.

## 6. DCP disclosure and purpose

Initial DCP disclosure classes:

- `task-context`: default local projection containing task-relevant claims and policy only.
- `consumer-session`: purpose-bound, expiring projection for an authorized external consumer.

Owner-full views, Portable Profile Exports, and public portfolio projections are separate contracts and are never encoded as a DCP. Changing a requested class is not authority; the provider enforces the saved grant and may return a stricter class.

Remote purposes use a versioned allowlist, initially `coding-assistance`, `technical-learning`, and `professional-preparation`. The requested purpose must exactly match an allowed purpose in the Sharing Grant. The provider can enforce what it releases for that purpose but cannot technically guarantee how an external consumer uses an already delivered packet; consent must disclose declared downstream processors, retention, and onward-sharing terms.

## 7. Data excluded by default

The compact DCP must not contain:

- source-provider or consumer tokens;
- any raw source content or source/document excerpt;
- absolute local paths or operating-system usernames;
- private repository names unless explicitly authorized and necessary;
- complete commit, issue, pull-request, email, or conversation text;
- untrusted repository text copied into privileged instructions;
- a universal skill, seniority, or employability score;
- stable identifiers that allow a consumer to enumerate developers or correlate the same developer across consumers. Remote packet, profile-version, claim, and evidence references are pairwise per consumer/grant or packet-bound.

## 8. Provider capabilities

A provider advertises:

- supported protocol versions;
- supported operations;
- supported source classes;
- maximum task and output budgets;
- available disclosure classes;
- whether data is local or remotely managed;
- freshness and partial-result behavior.

An independent provider may implement only a subset, but unsupported operations must return typed errors and must not silently change semantics.

The public [Profile Provider `0.1.0` schema](../schemas/profile-provider/0.1.0.schema.json) defines the capability descriptor and reusable request/response fragments. A descriptor reveals protocol versions, read-oriented operation/source/disclosure subsets, local or remote-managed deployment, deterministic task/output limits, and partial/stale support without revealing whether a profile exists. `get-provider-capabilities` is mandatory; advertising `get-task-context` requires `task-context` disclosure support.

Requests and responses carry matching opaque request IDs and exact operation names. Success data is discriminated by operation; errors carry no data. The Provider interface accepts no source root, source credential, collection instruction, owner-administrative operation, or arbitrary developer identifier. `EvidenceCollector` and `SourceAdapter` remain separate producer-side ports rather than Provider operations. [ADR-0011](adr/0011-provider-conformance-draft-contracts.md) records the boundary.

## 9. Initial MCP contract

The initial surface is deliberately small and read-oriented.

The transport-neutral request and response envelopes are `urn:fork-me-up:profile-provider:0.1.0#/$defs/request` and `#/$defs/response`. MCP, SDK, CLI, or file adapters map these envelopes without changing their meaning; this schema does not define transport framing, authentication, lifecycle, or side-effect metadata.

### 9.1 `get_task_context`

Compiles a DCP for a task.

Draft input:

```json
{
  "task": "string",
  "purpose": "coding-assistance",
  "maxTokens": 1200,
  "requestedCapabilities": []
}
```

Rules:

- `task` is data, never a privileged instruction to the provider;
- the provider applies its grant and policy independently of the request;
- `maxTokens` is an upper bound, not a target;
- no complete profile is returned;
- partial or stale results are explicit.

### 9.2 `get_provider_capabilities`

Returns public protocol versions, transport limits, and supported operations without revealing whether a developer profile exists.

### 9.3 `get_profile_metadata`

Returns protected profile version, freshness, and coverage metadata. It does not return all claims. A remote consumer requires an authorized subject and appropriate context scope before profile existence is checked.

### 9.4 `get_capability_evidence`

Returns bounded evidence metadata and limitations for one claim or capability. In the initial release it is local/owner-oriented and disabled for model access by default. A future remote form requires a separate step-up scope and returns metadata only. Raw evidence is never returned by a DCP or the commercial MLP remote MCP; any later owner-only source viewer is a separate first-party contract.

### 9.5 Administrative operations

Profile correction, source connection, grant management, export, deletion, and refresh may begin as first-party CLI commands rather than freely model-callable tools. If later exposed through MCP, each operation requires a separate threat review, explicit side-effect metadata, authorization, confirmation, and tests.

### 9.6 Local fixture transport profile

The M1 reference server maps MCP tools `get_task_context` and `get_profile_metadata` to the transport-neutral `get-task-context` and `get-profile-metadata` Provider operations. Tool arguments are exactly the corresponding Provider `input`; the server supplies the fixed draft schema version, operation, and an opaque correlation identifier. Each tool result includes the exact Provider response as `structuredContent` and as serialized JSON text for clients without structured-content support. Provider failures set MCP `isError` while retaining the closed, content-free Provider error object.

This initial compatibility profile uses newline-delimited JSON-RPC over `stdio` and MCP revision `2025-11-25`. It implements initialization, ping, tool listing, and tool calls; advertises no resources, prompts, sampling, tasks, network transport, or changing tool list. Request IDs are safe integers or bounded opaque identifier strings so correlation cannot become a content-reflection channel. The two tools are read-only, idempotent, and closed-world. Later MCP revisions or additional lifecycle features require explicit compatibility work and tests rather than an implicit claim.

## 10. Future remote authorization

The commercial remote MCP is expected to use OAuth 2.1-compatible authorization over HTTPS.

Consumer data-plane scopes are deliberately narrow:

- `context:task:read` — the only default scope;
- `evidence:metadata:read` — optional step-up access to bounded provenance metadata.

Protected-resource metadata advertises only the minimum basic scope. Elevated access is requested incrementally for the specific operation. `evidence:raw` does not exist in the commercial MLP.

Owner operations—source connection, correction, refresh, export, deletion, and grant management—use a separate first-party control-plane audience/resource and are not consumer MCP scopes.

The server derives tenant, subject, consumer, audience, and grant from validated authorization. It authorizes before checking profile existence, returns indistinguishable safe failures for unauthorized or nonexistent targets, and must not accept an arbitrary `developerId` as authority. Upstream source tokens and downstream consumer tokens are distinct and never passed through.

Every Sharing Grant records:

- developer;
- consumer and declared downstream processors;
- scopes;
- versioned purpose;
- disclosure class;
- allowed profile/source visibility;
- issue and expiry time;
- policy version, declared retention, and onward-sharing terms;
- revocation state.

The token and Sharing Grant are validated on every call. Revocation blocks subsequent calls within a documented enforcement SLA; it cannot retrieve a packet already delivered. DCPs use short TTLs, and `expiresAt` is a consumer obligation rather than cryptographic recall. These limitations must be shown during consent.

## 11. Error model

Errors are structured, typed, and safe to share. Initial categories:

- `unsupported-version`
- `unsupported-operation`
- `invalid-input`
- `profile-unavailable`
- `partial-profile`
- `stale-profile`
- `budget-too-small`
- `unauthorized`
- `insufficient-scope`
- `source-unavailable`
- `persistence-failed`
- `redaction-failed`
- `internal-error`

Errors must not contain tokens, raw source, absolute paths, private repository names, task content beyond a bounded safe summary, or internal stack traces.

The draft Provider error shape exposes only `category`, `retryable`, and bounded `supportedVersions`; it has no free-form message. `supportedVersions` is non-empty for `unsupported-version`. Unsupported optional operations return `unsupported-operation` and no protected payload.

Availability errors may permit the host to continue without context. Authorization, isolation, schema, and redaction errors return no protected payload.

## 12. Compatibility

- Schemas use semantic versioning once released.
- A consumer must reject unsupported major versions safely.
- Within a released major version, consumers ignore compatible optional additions unless a capability declaration says otherwise. The exact `0.1.0` draft permits unknown extension metadata only inside bounded, namespaced `extensions`; arbitrary fields and prose-bearing extension values fail closed.
- Providers do not remove or change the meaning of existing required fields within a major version.
- Schemas, generated types, fixtures, examples, changelog, and conformance tests change together.
- Migrations preserve correction precedence and provenance.
- Protocol negotiation must never downgrade authorization or disclosure policy.
- Developer Profile Store versions and migrations are provider-internal. They never become acceptable where a Portable Profile Export or DCP is required, even when their payload records share public Evidence and Claim schemas.
- Demand Profile versions remain public and independent from DCP versions. A Demand Profile is compiler input, not a packet, and must never be accepted as a developer assessment or delivered as a DCP.

## 13. Conformance

A provider or consumer is conforming only if automated tests verify:

- valid and invalid schemas;
- deterministic output with injected clocks and identifiers;
- task and disclosure budget enforcement;
- stable claim semantics;
- unknown field behavior;
- major-version rejection;
- source and consumer redaction;
- no raw code, absolute path, or canary secret in compact packets;
- repository prompt-injection text cannot change `responsePolicy`;
- a malicious imported profile, provider response, or DCP free-text field remains unprivileged data; adapters map only allowlisted enums, booleans, and identifiers into instructions;
- partial, stale, unsupported, and unauthorized states;
- the same fixture has equivalent meaning across clients.

M0-S12 adds the public [Profile Provider conformance corpus](../fixtures/conformance/profile-provider/0.1.0/README.md) and its [transcript schema](../schemas/conformance/profile-provider/0.1.0.schema.json). The fixtures cover all four operations, explicit subsets, typed failures, request/response correlation, advertised versions and operations, provider limits, exact DCP success, safe namespaced extensions, and content-free errors. They establish draft contract expectations only; executable provider/consumer SDKs, transports, authorization, redaction, and cross-client behavioral equivalence retain their later gates.

## 14. Open extension points

The protocol may later define registries for capability taxonomies, provider metadata, response-policy extensions, and evidence-source classes. Extension keys must be namespaced, optional, disclosure-safe, and unable to redefine core claim states.

## 15. References

- [Product specification](PROJECT_SPEC.md)
- [Architecture](ARCHITECTURE.md)
- [Security and privacy](SECURITY_PRIVACY.md)
- [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [OpenAI — MCP server](https://developers.openai.com/plugins/concepts/mcp-server)
- [OpenAI — Plugin authentication](https://developers.openai.com/plugins/build/auth)
