# Fork Me Up — Developer Context Protocol

> Status: pre-implementation protocol draft  
> Draft version: 0.1  
> Last updated: September 4, 2026

This document defines the intended public interoperability boundary. Field names remain draft until M0 produces JSON Schemas and fixtures. Once a schema version is released, compatibility follows the rules in this document.

## 1. Purpose

The Developer Context Protocol lets an evidence provider communicate a small, traceable, task-relevant view of a developer profile to a compatible AI tool without exposing the complete profile or requiring a particular model, client, source provider, or backend.

The primary exchange object is the **Developer Context Packet (DCP)**.

## 2. Objects and boundaries

### 2.1 Evidence

An observation about an approved source. Evidence describes what was found; it does not itself assert that the developer knows a capability.

### 2.2 Claim

A capability statement supported by evidence, inferred by adjacency, declared by the developer, marked as insufficiently evidenced, or disputed by the developer.

### 2.3 Developer Profile Store

The provider's canonical private state containing claims, corrections, preferences, and evidence references. Its internal schema is not an interchange contract and may differ between providers.

### 2.4 Portable Profile Export

An owner-initiated, open, versioned export used for portability or migration. It is distinct from internal provider storage and from a DCP.

### 2.5 Demand Profile

The capabilities relevant to a project and task. It constrains which profile facts can help the consuming tool.

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
  "schemaVersion": "0.1",
  "packetId": "dcp_opaque_id",
  "profileVersion": "profile_opaque_version",
  "purpose": "coding-assistance",
  "audience": {
    "class": "local-assistant",
    "consumerId": null
  },
  "task": {
    "summary": "Add a CI workflow for the current project",
    "requiredCapabilities": ["delivery.ci.github-actions"]
  },
  "claims": [
    {
      "claimId": "claim_opaque_id",
      "capability": "delivery.ci.github-actions",
      "state": "insufficient-evidence",
      "observedDepth": null,
      "confidence": "low",
      "scope": "global",
      "adjacentFrom": ["delivery.ci.generic"],
      "evidenceRefs": [],
      "limitations": ["No attributable workflow evidence in selected repositories"],
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
    "analogyCapabilities": ["delivery.ci.generic"],
    "questionBudget": 1
  },
  "provenanceSummary": {
    "evidenceCount": 0,
    "sourceClasses": ["selected-local-repository"]
  },
  "disclosure": {
    "class": "task-context",

    "redactionsApplied": ["absolute-paths", "private-source-names"]
  },
  "generatedAt": "2026-09-04T00:00:00Z",
  "expiresAt": "2026-09-05T00:00:00Z"
}
```

The example is illustrative, not yet a released schema.

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

## 9. Initial MCP contract

The initial surface is deliberately small and read-oriented.

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

Availability errors may permit the host to continue without context. Authorization, isolation, schema, and redaction errors return no protected payload.

## 12. Compatibility

- Schemas use semantic versioning once released.
- A consumer must reject unsupported major versions safely.
- Within a major version, consumers ignore unknown optional fields unless a capability declaration says otherwise.
- Providers do not remove or change the meaning of existing required fields within a major version.
- Schemas, generated types, fixtures, examples, changelog, and conformance tests change together.
- Migrations preserve correction precedence and provenance.
- Protocol negotiation must never downgrade authorization or disclosure policy.

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

## 14. Open extension points

The protocol may later define registries for capability taxonomies, provider metadata, response-policy extensions, and evidence-source classes. Extension keys must be namespaced, optional, disclosure-safe, and unable to redefine core claim states.

## 15. References

- [Product specification](PROJECT_SPEC.md)
- [Architecture](ARCHITECTURE.md)
- [Security and privacy](SECURITY_PRIVACY.md)
- [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [OpenAI — MCP server](https://developers.openai.com/plugins/concepts/mcp-server)
- [OpenAI — Plugin authentication](https://developers.openai.com/plugins/build/auth)


