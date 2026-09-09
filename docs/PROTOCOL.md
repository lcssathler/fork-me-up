# Fork Me Up — Developer Context Protocol

> Status: unreleased protocol draft
> Draft version: 0.1  
> Last updated: September 9, 2026

This document defines exchanged objects, their meaning, disclosure rules and conformance. DCP, Evidence, Claim, Portable Profile Export, Demand Profile, Profile Provider and conformance schemas are unreleased `0.1.0` drafts. The Community Profile Store is implementation-internal. Released versions follow Section 12; private package versions follow [VERSIONING.md](../VERSIONING.md).

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

Community authorship assessment is private pre-Evidence metadata, not a public enum extension. Explicit private Git names/emails are immediately replaced with collector-compatible digests. Direct target matches map to `attributed`, recognized target collaboration and explicitly configured pair work map to `coauthored`, configured bots map to `bot`, while shared accounts and unmatched identities map to `unknown`; only the first two mappings carry the opaque configured subject reference. Merge and explicit squash history remain independent limitations. Every isolated commit prohibits standalone `demonstrated-depth`, so later Evidence/Claim rules must still aggregate attributable qualitative signals conservatively. [ADR-0021](adr/0021-explicit-conservative-git-authorship-assessment.md) records this private producer decision.

Community source-risk metadata is also private. It correlates bounded filesystem records, Git changed paths, and authentic authorship assessments, then records explicit fork/template/tutorial/uncertain annotations, fixed generated/vendor/template/tutorial path indicators, exact-digest duplication, and missing or non-target attribution as separate limitations. Every flagged record is reduced with a weak strength ceiling; an unflagged record remains `origin-unverified` with at most moderate strength. No record can independently establish `demonstrated-depth`, and the classifier never labels a source original. Evidence production must preserve these ceilings and limitations. See [ADR-0022](adr/0022-conservative-evidence-source-risk-classification.md).

Community Evidence production uses the existing schema. Only the collector's normalized source language becomes a `language.*` capability signal; documents, dependency/script names, prose, and annotations cannot create a capability. Stable Evidence identifiers survive content refresh, while semantic fingerprints cover source digest, authorship/risk state, fixed limitations, and extractor version. Observation/derivation/staleness times and repository-to-project binding are explicit inputs. Refresh comparison reports changed or unavailable prior Evidence without treating an unrelated repository-head change as a source change. See [ADR-0024](adr/0024-deterministic-evidence-claim-derivation.md).

Incremental refresh changes no Evidence, Claim or Demand envelope. Its private process-local cache retains authentic collected snapshots under explicit age/work/memory limits. Cache hits preserve original source observation time, while new derivations use the oldest source observation in the complete selected set. Partial or invalid refreshes expose bounded operational state but no aggregate source payload or derivation; missing peers cannot remove cross-repository risk ceilings. Cache fingerprints, origin, check attempts, session handles and refresh reasons remain implementation-internal, not Provider operations or sharing authority. See [ADR-0026](adr/0026-bounded-incremental-local-refresh.md).

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

The Community Claim producer groups exact language Evidence only within its mapped project. At least one attributable or coauthored observation is required for `demonstrated`; otherwise it emits `insufficient-evidence`. One or weak attributable signal reaches only exposure; two distinct moderate attributable source observations may reach practical use only when both upstream authorship ceilings permit it. Confidence also respects the upstream ceiling. Generated Claims are never global, adjacent, high confidence, or `demonstrated-depth`. Stable internal Claim fingerprints and refresh invalidation remain provider implementation metadata rather than new public Claim fields. Declarations, disputes and correction precedence remain separate owner-controlled operations. See [ADR-0024](adr/0024-deterministic-evidence-claim-derivation.md).

Owner correction precedence uses existing shapes. Adjustments/rejections preserve original Claim/Evidence snapshots privately and make the effective assessment disputed. Core omits historical correction targets linked by an effective dispute before task projection; self-targeted disputes remain compatible. Explicit declarations remain unobserved. Owner requests, inspection views and mutation acknowledgments are implementation-internal, not Provider/MCP or export contracts. See [ADR-0027](adr/0027-local-owner-correction-workflow.md).

### 2.3 Developer Profile Store

The provider's canonical private state containing claims, corrections, preferences, and evidence references. Its internal schema is not an interchange contract and may differ between providers.

The reference Community provider's [internal Store `0.1.0` schema](../schemas/internal/community-profile-store/0.1.0.schema.json) is published for implementation review, not provider interoperability. It declares `storeSchemaVersion` and `kind: community-profile-store`, contains the canonical profile payload, and adds store identity plus generation, creation, update, validation, and migration bookkeeping. Independent providers do not consume or reproduce this envelope. Credentials, raw source, and grants remain outside it. The [Store lifecycle](ARCHITECTURE.md#54-developer-profile) and [mutation/deletion coordination](ARCHITECTURE.md#59-owner-portability-and-verified-deletion) are private Community behavior, not additional Protocol formats. See [ADR-0023](adr/0023-generation-addressed-atomic-local-profile-store.md) and its deletion refinement in [ADR-0028](adr/0028-owner-portability-and-verified-deletion.md).

### 2.4 Portable Profile Export

An owner-initiated, open, versioned export used for portability or migration. It is distinct from internal provider storage and from a DCP.

The public [Portable Profile Export `0.1.0` schema](../schemas/portable-profile-export/0.1.0.schema.json) declares `schemaVersion` and `kind: portable-profile-export`. Its profile payload contains bounded Evidence and Claim records using their exact independent schemas, plus typed declarations, corrections, project references, and preferences. Opaque references must resolve within the envelope and referenced declaration/correction capabilities must match the Claim.

The export requires fixed exclusions for credentials, raw source, Source Grants, Sharing Grants, and provider-internal state. Closed authoring validation rejects those fields, but an exclusions object is not proof of redaction or owner intent. An exporter must construct the projection from authorized private state, validate it, write it safely, and only then report success. The Store, Portable Profile Export, and DCP authoring schemas reject one another. [ADR-0009](adr/0009-profile-store-export-boundary.md) records this boundary.

Local owner operations enforce this boundary. Export reconstructs an allowlist, replaces private prose and opaque identifiers, validates references and redaction, and reports success only after exclusive artifact creation and readback. Import accepts only a valid export for the configured subject into an absent Store, preserving typed correction behavior after consistent identifier remapping. No Provider/MCP tool, source authority or public schema field is added. See [ADR-0028](adr/0028-owner-portability-and-verified-deletion.md).

Private unreleased Protocol and Core workspaces use this draft for synthetic fixture loading. Synthetic Developer Profile fixtures are valid export envelopes used only as input carriers: Protocol validates the canonical shape and reference integrity, then Core copies and deeply freezes the profile payload and `profileVersion` while discarding export metadata. Fixture loading creates no new profile contract, accepts no Store envelope, performs no export and grants no policy or disclosure authority. [ADR-0012](adr/0012-fixture-profile-package-foundation.md) records the package boundary.

### 2.5 Demand Profile

The capabilities relevant to a project and task. It constrains which profile facts can help the consuming tool.

The public [Demand Profile `0.1.0` schema](../schemas/demand-profile/0.1.0.schema.json) binds an opaque current-project reference, bounded explicit task summary and purpose, project-metadata availability, and a bounded list of unique capability identifiers. Each capability is `required` or `supporting` and records whether it arose from task input, authorized project metadata, or both; project-derived bases are invalid when metadata is unavailable. An empty list preserves uncertainty rather than inventing task demand.

Demand Profile describes the task, not the developer. It contains no Claim, Evidence, profile, response policy, grant, credential, raw project metadata, source content, or path. Its task summary is untrusted data and cannot set policy or authorize access. Metadata availability and opaque revision fields do not prove authorization, freshness, or relevance. Protocol validates the canonical envelope before a pure Core intersection: exact capability identifiers select global Claims and project-scoped Claims only for the current project, with unmatched demand explicit and unrelated profile records omitted. [ADR-0010](adr/0010-demand-profile-draft-contract.md) records the contract and [ADR-0014](adr/0014-demand-profile-intersection.md) records the intersection.

Community produces the existing Demand shape. It combines explicit task capability/relevance pairs with supporting `language.*` signals from an authentic bounded filesystem snapshot for one selected repository and optional exact file set. Missing metadata remains unavailable, unsupported collector coverage is partial, and empty demand remains valid. Capabilities merge by exact identifier and retain task/project basis. A private one-question continuation handles materially different explicit interpretations; operation categories never enter the public Demand or grant permission. The emitted task summary is fixed minimized text, not an echo of potentially sensitive input prose. Source selection, snapshot authenticity, clarification state and content-free producer errors remain implementation-internal. See [ADR-0025](adr/0025-source-backed-demand-profile-producer.md).

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

The example is the [insufficient-evidence fixture](../fixtures/dcp/0.1.0/valid/insufficient-evidence.json) for the [DCP 0.1.0 schema](../schemas/dcp/0.1.0.schema.json). It remains an unreleased draft and is not proof of provider or consumer conformance. [ADR-0007](adr/0007-dcp-draft-schema-validation.md) records the schema, and [ADR-0015](adr/0015-deterministic-bounded-dcp-compiler.md) records runtime compilation.

### 4.1 Exact draft authoring rules

The schema validates the exact producer/fixture shape and rejects unknown properties at every object boundary. Released consumers remain governed by Section 12. The Provider contract contains an explicit bounded `extensions` object for safely ignorable namespaced additions while arbitrary fields remain invalid. This development checker accepts only draft `0.1.0`; it does not claim released-version compatibility.

The draft gives existing concepts explicit representations:

- `audience.class` is `local-assistant` or `external-consumer`; the latter requires a non-null opaque `consumerId`. These labels do not prove identity or a Sharing Grant.
- `responsePolicy.mode` is `concise`, `analogy`, or `teach-while-doing`. Policy fields contain only the declared enums, booleans, capability identifiers, and a question budget of 0 or 1; free-form instruction properties are rejected.
- Compact `demonstrated` summaries require non-null observed depth and at least one evidence reference. `adjacent`, `self-declared`, and `insufficient-evidence` summaries have null observed depth; transfer or declaration is not an observation of the target capability.
- An `adjacent` summary requires non-empty `adjacentFrom` and an inert `adjacentRationale`. A `disputed` summary requires an opaque `correctionRef` and inert `correctionSummary`, retaining its original evidence references. Full Claim/Evidence records and behavior precedence are separate boundaries described in Sections 2.1, 2.2 and 5.6.
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

Protocol validates this same exact contract at runtime; Core compiles it through a pure function. Packet identifiers and timestamps are injected. The compiler accepts a previously resolved authorization decision, applies only compatible local `task-context` or external `consumer-session` shapes, projects compact task-relevant Claim summaries, derives structured uncertainties, redacts sensitive free text, and validates the final packet before returning it. It reads no clock, randomness, source, profile store, network, or client state.

The compiler request adds an input-only `maxTokens` from 1 through 8,192. Core uses one conservative portable accounting unit per UTF-8 byte rather than assuming a model tokenizer; emitted bytes must satisfy both this bound and `budget.maxBytes`. Progressive reduction removes limitations, non-demonstrated evidence references, non-material uncertainties, and lower-retention Claim summaries in a fixed order. It never truncates JSON or free text to force validity. A projection that still cannot fit returns no packet.

The same command checks the independent Evidence and Claim corpora through the shared bounded fixture reader. Evidence validation additionally enforces collection-at-or-after-observation ordering. All schemas are self-contained and use only local fragment references. These development checks do not resolve opaque references, inspect a source, derive a Claim, apply correction precedence, or authorize disclosure.

The command also checks the internal Store and public Portable Profile Export corpora. Their committed schema dependencies are preloaded by fixed local URLs and referenced through stable URNs; no network or arbitrary schema loader is used. Supplementary checks enforce unique and resolved in-envelope provenance, matching correction/declaration capabilities, resolved project scope, nested Evidence semantics, and ordered Store timestamps. They do not implement persistence, atomic replacement, migration, export, deletion, or correction precedence.

The self-contained Demand Profile corpus is checked by the same command. Its supplementary check enforces unique capability identifiers and rejects project-derived bases when metadata is unavailable; schema cases cover metadata/revision consistency, task bounds, typed relevance/basis, prohibited profile/raw/policy fields, and cross-envelope rejection. Validation does not read project metadata, derive task demand, interpret task text, intersect a profile, or compile a DCP.

These checks cannot establish source attribution, task relevance, actual redaction, grant validity, correction precedence, or unlinkability. Bounded free text remains unprivileged data and may be structurally valid even when it contains instruction-like or sensitive text. Runtime boundaries must enforce the security and disclosure invariants before any packet is shared. Schema checks alone do not satisfy MCP integration or behavioral evaluation gates.

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

The [reference evidence method](EVIDENCE_METHOD.md) distinguishes identity association, artifact provenance indicators and claim support. `demonstrated` with `exposure` is a limited selected observation, not proof of comprehension or unaided authorship. `generated` limitations do not assert AI detection; AI assistance alone cannot determine knowledge. These interpretations preserve the existing wire schema and categorical confidence semantics.

### 5.4 Scope

- `global`: evidence can reasonably inform tasks beyond one project.
- `project`: evidence describes a project-specific convention or context and must not be promoted to personal proficiency without additional support.

### 5.5 Provenance

A compact packet uses opaque or sanitized evidence references. A reference must be resolvable only through an authorized provider operation. It must not reveal an absolute path, private repository name, user email, access token, or raw source fragment.

The independent Claim record retains the fuller state-matched basis described in Section 2.2. A DCP deliberately projects only the bounded summary required for the task; it never embeds an independent Claim or Evidence record. [ADR-0008](adr/0008-evidence-claim-draft-contracts.md) records this boundary and the unreleased authoring decisions.

### 5.6 Behavior precedence and Response Policy

Core applies a conservative priority only after Claims are validated and selected as task-relevant: disputed, insufficient-evidence, self-declared, adjacent, then demonstrated. This priority selects the minimum guidance for a combined task; it does not collapse, reclassify, or delete any Claim. Stable state, capability, and claim-identifier ordering makes the result independent of input order and locale.

Disputed, insufficient, self-declared, or empty inputs select `teach-while-doing`; adjacent selects `analogy`; demonstrated selects `concise`. A guided developer preference can request more explanation but no preference can suppress uncertainty safeguards. Analogy capabilities come only from structured `adjacentFrom` fields; free text has no policy authority. Exact Demand Profile intersection supplies the task-relevant Claim set. The result uses the existing DCP Response Policy fields but is not a DCP. [ADR-0013](adr/0013-claim-precedence-response-policy.md) records the policy and [ADR-0014](adr/0014-demand-profile-intersection.md) records task selection.

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

Owner-selected local roots and repository paths stay in a versioned implementation-internal Community configuration resolved before collection. Its absolute canonical paths are neither Protocol data nor Profile Provider input/output. This adds no public schema, source operation, or consumer authority; [ADR-0018](adr/0018-authorized-local-repository-configuration.md) records the private boundary.

## 9. Initial MCP contract

The asynchronous Store-backed Provider serves the existing public read operations from an explicit local Store. MCP awaits either synchronous fixture or asynchronous Store responses; public envelopes and tool names remain unchanged. Owner configuration fixes the current project/repository and never enters consumer requests. Protected calls reload Store state and respect corrections, age limits and deletion barriers. Task demand uses explicit capability requests plus authentic project metadata only when present; consumer calls cannot refresh sources or mutate the Store. See [ADR-0030](adr/0030-local-community-workflow-composition.md).

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

The private local CLI provides owner-only `get-capability-evidence` through an exact capability selector. The selector returns bounded typed assessment/history with nested metadata validated against the existing `capabilityEvidence` shape. Hashed references and allowlisted limitation codes exclude private text. Explicit truncation is part of the private wrapper, not a public schema extension. Consumer Provider/MCP capabilities remain unchanged and do not advertise this owner disclosure. The private `doctor` operation reports only component states/counts and optional DCP size/expiry/budget status. See [ADR-0029](adr/0029-owner-evidence-and-safe-diagnostics.md).

Profile correction, source connection, grant management, export, deletion, and refresh may begin as first-party CLI commands rather than freely model-callable tools. If later exposed through MCP, each operation requires a separate threat review, explicit side-effect metadata, authorization, confirmation, and tests.

### 9.6 Local fixture transport profile

The reference server maps MCP tools `get_task_context` and `get_profile_metadata` to the transport-neutral `get-task-context` and `get-profile-metadata` Provider operations. Tool arguments are exactly the corresponding Provider `input`; the server supplies the fixed draft schema version, operation, and an opaque correlation identifier. Each tool result includes the exact Provider response as `structuredContent` and as serialized JSON text for clients without structured-content support. Provider failures set MCP `isError` while retaining the closed, content-free Provider error object.

This initial compatibility profile uses newline-delimited JSON-RPC over `stdio` and MCP revision `2025-11-25`. It implements initialization, ping, tool listing, and tool calls; advertises no resources, prompts, sampling, tasks, network transport, or changing tool list. Request IDs are safe integers or bounded opaque identifier strings so correlation cannot become a content-reflection channel. The two tools are read-only, idempotent, and closed-world. Later MCP revisions or additional lifecycle features require explicit compatibility work and tests rather than an implicit claim.

### 9.7 Codex fixture adapter profile

The first reference adapter consumes the same Provider `0.1.0` operation in-process and owns Codex-specific lifecycle output outside Protocol and Core. On recognized synthetic tasks it validates the complete Provider response again, requires exact request/operation correlation, and maps only Claim capability/state/observed-depth plus the six closed Response Policy fields. Its fixed renderer does not include task summaries, limitations, adjacency rationale, corrections, extensions, errors, paths, Evidence, or profile records.

Repository-local Codex command hooks deliver task guidance on `UserPromptSubmit`. `SessionStart` can restore the last unexpired allowlisted projection after resume or compaction from a bounded ephemeral cache; startup and clear remove prior state. Every optional failure emits no context and explicitly permits normal host continuation. This client profile changes no public schema and does not establish compatibility with another client. See [ADR-0017](adr/0017-codex-lifecycle-hook-adapter.md).

### 9.8 Generic conformance consumer profile

The generic consumer is a stateless JSON command-line harness, materially different from the Codex lifecycle adapter. It installs only the private local Protocol candidate and validates the DCP again through its public SDK; it imports no Core, Community Provider or Codex code. The process accepts at most 65,536 input bytes, rejects expired packets, requires an exact configured audience identifier for `external-consumer`, and produces at most 8,192 UTF-8 bytes.

Successful output contains only Claim capability/state/observed-depth, DCP expiry, the six closed Response Policy fields and an explicit `authority: "none"`. Task summaries, limitations, rationale, corrections, provenance, Evidence and identifiers remain unprivileged data and are omitted. Malformed, incompatible, expired, oversized or audience-mismatched input returns one fixed content-free no-context result. This profile changes no public schema, proves no authorization mechanism and makes no general-client compatibility claim. See [ADR-0036](adr/0036-independent-generic-conformance-consumer.md).

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

The private Protocol `0.0.0` tarball exposes the typed root SDK, typed Provider conformance validator, seven public `0.1.0` schemas and their public JSON fixtures through exact package subpaths. It supports exact draft `0.1.0` inputs and rejects unsupported versions. Private, unpublished artifacts do not establish a released compatibility promise. See [package boundaries](ARCHITECTURE.md#private-package-candidates), [ADR-0034](adr/0034-community-package-dry-run-boundary.md) and [ADR-0035](adr/0035-protocol-sdk-conformance-distribution.md).

The installed Protocol/Core/Community Provider matrix checks supported and rejected Provider/DCP/Export versions. Store versions and migration remain internal even when Store and Export reuse the same profile records. Neither envelope is acceptable as the other or as a DCP. See [ADR-0037](adr/0037-community-artifact-compatibility-matrix.md).

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

The checks establish different levels of evidence:

- **Draft contracts:** the public [Provider corpus](../fixtures/conformance/profile-provider/0.1.0/README.md) and [transcript schema](../schemas/conformance/profile-provider/0.1.0.schema.json) cover four operations, explicit subsets, typed failures, correlation, advertised versions/operations, limits, exact DCP success, safe namespaced extensions and content-free errors. Fixtures alone establish contract expectations, not executable SDK, transport, authorization, redaction or cross-client behavior.
- **Distributed validation:** the typed `@fork-me-up/protocol/conformance/profile-provider` entry point validates transcripts; exact subpaths export every public schema and JSON fixture. The local install smoke test checks supported/unsupported draft versions through the tarball alone. It does not prove transport, authorization, runtime Provider or cross-client conformance. See [ADR-0035](adr/0035-protocol-sdk-conformance-distribution.md).
- **Two-consumer meaning:** an isolated lockfile-enforced offline install runs the generic consumer. `FMU-E-016` compares its complete allowlisted Claim, Response Policy and expiry projection with the Codex structured mapper for the same all-state DCP. This proves equivalent structured meaning for those two consumers, not model-authored prose, transport, authorization, other clients or released compatibility. See [ADR-0036](adr/0036-independent-generic-conformance-consumer.md).
- **Installed-artifact compatibility:** seven cases cover supported/unsupported Provider operations and versions, DCP version rejection, owner Export/Import round trip, Store update conflict, explicit legacy migration, corrupt-newest recovery and cross-envelope rejection. Reports contain fixed case labels, no profile content or paths. This private local matrix is not the public compatibility table or a cross-platform release claim. See [ADR-0037](adr/0037-community-artifact-compatibility-matrix.md).

## 14. Open extension points

The protocol may later define registries for capability taxonomies, provider metadata, response-policy extensions, and evidence-source classes. Extension keys must be namespaced, optional, disclosure-safe, and unable to redefine core claim states.

## 15. References

- [Product specification](PROJECT_SPEC.md)
- [Architecture](ARCHITECTURE.md)
- [Security and privacy](SECURITY_PRIVACY.md)
- [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [OpenAI — MCP server](https://developers.openai.com/plugins/concepts/mcp-server)
- [OpenAI — Plugin authentication](https://developers.openai.com/plugins/build/auth)
