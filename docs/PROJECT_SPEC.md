# Fork Me Up — Product Specification

> Status: pre-implementation product contract  
> Version: 0.5
> Last updated: September 4, 2026  
> Canonical language: English

This is the single normative product specification. Accepted product changes must update this document, affected requirements and evaluations, and any dependent protocol or architecture documents in the same change.

## 1. Executive summary

Fork Me Up is a client-neutral developer-context system. It turns evidence from developer-approved repositories, explicit developer statements, and corrections into an inspectable, versioned profile. It then compiles a small, purpose-bound Developer Context Packet (DCP) for an AI tool and the task at hand.

The product exists to remove repetitive calibration. A developer should not have to tell each model, coding agent, interview-preparation tool, or compatible harness what they already understand, which knowledge transfers from another stack, and where they want more explanation. Fork Me Up carries that context across tools without pretending that repository evidence is a complete account of the person.

The public product consists of an open protocol and a useful local Community runtime. A future paid service may provide deeper multi-repository compilation, continuous refresh, private-repository connectivity, secure remote delivery, and operational guarantees. The paid value is depth, freshness, convenience, and governed delivery—not ownership of a closed profile format.

## 2. Problem

AI tools can inspect a project but usually start each relationship without durable knowledge of the developer using them. This creates recurring costs:

- the developer repeats their technical background and preferences;
- the same calibration consumes turns and context tokens in every client;
- familiar subjects are over-explained;
- unfamiliar commands and operational decisions are under-explained;
- a tool may infer expertise from a dependency, fork, template, or team repository;
- personal context becomes trapped in one vendor or conversation;
- the developer cannot inspect why the tool made an assumption.

The problem is not to determine everything a developer knows. It is to preserve a useful, evidence-bounded calibration that clearly distinguishes what was observed, inferred, declared, corrected, disputed, or not sufficiently evidenced.

## 3. Product thesis

> Build developer context once, keep it inspectable, and carry only the relevant part into each AI-assisted task.

Fork Me Up owns the boundary between developer evidence and AI behavior:

```text
developer-approved evidence + explicit corrections
                         ↓
             private Developer Profile
                         ↓
task + purpose + audience + disclosure budget
                         ↓
             Developer Context Packet
                         ↓
       compatible AI tool or harness behavior
```

The DCP is advisory context. It never grants permissions and never overrides the user's current instructions, repository policy, or the consuming tool's safety boundaries.

## 4. Target users

Initial Community users are individual developers who:

- use one or more AI coding tools or compatible agent harnesses;
- have uneven experience across technologies and engineering domains;
- want concise peer-level help where evidence is strong and more guidance where it is not;
- want to reduce repeated onboarding prompts and token use;
- have local or public repositories they choose to analyze;
- value inspectable evidence, corrections, portability, and local control.

Initial paid users are developers who additionally value:

- managed analysis of selected public and private repositories;
- continuous, incremental profile refresh;
- stronger cross-repository attribution and inference;
- secure remote access from multiple compatible tools;
- history, auditability, sharing grants, and revocation.

Partners and enterprise teams are later consumers of the same open protocol. They are not allowed to enumerate developers or obtain profiles without a grant from each developer.

## 5. Product boundary

### 5.1 Fork Me Up Community — public and useful on its own

- versioned DCP schemas and semantics;
- evidence, claim, portable-export, profile-provider, and evidence-collector contracts;
- local CLI and storage;
- deterministic basic scanner for selected local repositories;
- manual profile editing and explicit corrections;
- task-context compiler and response policy;
- local MCP server over `stdio`;
- import, export, deletion, diagnostics, fixtures, and conformance tests;
- reference adapters and BYO-model/BYO-harness use.

Community must provide meaningful value without an account, hosted backend, or proprietary service.

### 5.2 Fork Me Up Cloud/Pro — optional paid service

- accounts and secure credential storage;
- a GitHub App limited to repositories explicitly selected by the developer;
- managed public and private repository ingestion;
- deeper authorship, fork, template, vendor, and generated-code analysis;
- multi-repository evidence fusion and continuously refreshed profiles;
- profile history, review, correction, audit, export, and deletion;
- purpose-bound sharing grants;
- authenticated remote MCP delivery;
- quotas, billing, reliability, support, and later service-level commitments.

### 5.3 Fork Me Up Connect — open integration boundary

Connect is the set of public schemas, SDKs, conformance fixtures, and adapters through which clients consume a DCP. It does not ingest repositories and never owns source-provider credentials.

Local delivery may use a file, SDK, CLI, or MCP `stdio`. A future hosted service may use HTTPS and MCP Streamable HTTP with OAuth. Compatibility is limited by the transports, authentication flows, lifecycle hooks, and context controls supported by each client. Fork Me Up must document tested compatibility rather than claim universal drop-in support.

### 5.4 Licensing model

The adopted model is:

- the [Apache License 2.0](../LICENSE) for content distributed from the public repository, including protocols, schemas, SDKs, the Community runtime, reference adapters, examples, conformance tests, and project documentation, unless a file explicitly states otherwise;
- proprietary terms for a separately controlled hosted Cloud/Pro implementation and its operations;
- a separate [trademark policy](../TRADEMARKS.md) for the Fork Me Up name and visual identity;
- user-owned, fully exportable profile data with no format lock-in and no relicensing merely because Fork Me Up processes it.

On September 4, 2026, the project owner confirmed authority to license the current project content and explicitly accepted this license, its Community/Cloud implications, the separate trademark policy, and the residual risk from the preliminary name review. [ADR-0004](adr/0004-apache-license-and-trademark-policy.md) records the decision. Publishing code, packages, or repository history remains separately gated.

## 6. Goals

### 6.1 Community goals

- Reduce repeated turns and tokens used to explain developer background.
- Produce an inspectable profile from selected local evidence and corrections.
- Generate compact task-, purpose-, and audience-specific DCPs.
- Preserve provenance, uncertainty, recency, authorship limitations, and corrections.
- Adapt explanation depth and command rationale without blocking ordinary work.
- Work locally without a paid service or dedicated model API.
- Keep the core independent of any client or model provider.
- Prove portability through materially different consumers.
- Export and delete all locally managed profile data.

### 6.2 Commercial goals

- Validate willingness to pay for better compilation, continuous refresh, and secure remote delivery.
- Connect only developer-selected repositories through least-privilege credentials.
- Let the developer review claims before or after sharing them.
- Deliver minimized context to authorized consumers without exposing upstream tokens or raw repositories.
- Provide observable revocation, retention, deletion, audit, and cost boundaries.

## 7. Non-goals

Fork Me Up is not:

- a universal measure of knowledge, seniority, employability, or professional worth;
- a certification, résumé truth engine, candidate-ranking product, or automated hiring decision system;
- a surveillance or employee-monitoring product;
- a generic conversation-memory or semantic code-editing platform;
- an excuse to send complete repositories, documents, or conversations to every model;
- a covert interview-answering or assessment-circumvention tool;
- exclusive to Codex, another client, an LLM provider, or an integration partner.

The initial product also does not include:

- Google Workspace, email, calendar, or broad personal-document ingestion;
- arbitrary private-repository access;
- team profiles or cross-developer comparisons;
- a complete taxonomy of every technology;
- embeddings or vector infrastructure without measured need;
- an always-on hosted backend for Community;
- execution of analyzed repository code;
- an additional LLM dependency in the Community reference provider.

## 8. Product principles

### P-01 — Evidence is bounded

Every material automated claim has provenance, confidence, freshness, and limitations. Evidence supports a claim; it does not turn it into objective truth.

### P-02 — Missing evidence is uncertainty

The default state is `insufficient-evidence`, never `does-not-know`.

### P-03 — The developer remains the authority

Explicit corrections and rejections outrank automated inference while the conflicting evidence remains traceable.

### P-04 — The profile is private; packets are projections

The canonical Developer Profile is not delivered to consumers by default. A DCP contains the smallest useful slice for a declared task, purpose, audience, and token budget.

### P-05 — Open interoperability

Anyone may build a provider or consumer for the public protocol. Client-specific behavior belongs in adapters.

### P-06 — Local-first, cloud opt-in

The reference product proves one user and local evidence before remote collection, multi-tenancy, or paid infrastructure.

### P-07 — Graceful for availability, strict for security

If optional analysis fails, ordinary AI work continues without Fork Me Up context. Authorization, isolation, schema validation, and redaction fail closed.

### P-08 — Engineering is evidence-backed too

Every material behavior has a test, evaluation, or reproducible verification proportional to risk.

### P-09 — Questions have a cost

Ask only when the answer materially changes behavior, risk, or scope, and ask at most one high-information question per unresolved decision.

### P-10 — No hidden data bargain

Source access, profile sharing, telemetry, and model processing require distinct, understandable consent. Profile data is not sold or used for model training without a separate explicit opt-in.

## 9. Hypotheses and invalidation signals

| ID | Hypothesis | Validation | Invalidation signal |
|---|---|---|---|
| H-01 | A persistent developer profile reduces repeated calibration turns and tokens. | Compare first-task conversations with and without a DCP. | DCP overhead is equal to or greater than the avoided calibration. |
| H-02 | Repository evidence produces useful claims when authorship and uncertainty remain visible. | Measure accepted, corrected, rejected, and false `demonstrated` claims. | Material claims require frequent downgrades or cannot be attributed. |
| H-03 | A task-scoped DCP is more useful and safer than a complete profile. | Compare usefulness, token size, and unnecessary disclosure. | Consumers need the full profile for ordinary tasks. |
| H-04 | The same public contract works across different clients. | Run conformance and behavioral tests in at least two materially different consumers. | Each client requires a fork or different core semantics. |
| H-05 | Explicit provenance and corrections increase user trust. | Measure inspections, corrections, successful writes, and continued use. | Users do not trust or understand the resulting claims. |
| H-06 | Community is valuable without a hosted account. | External users complete a local workflow and reuse the profile. | The public runtime is unusable without proprietary infrastructure. |
| H-07 | Users will pay for depth, freshness, and governed delivery. | Paid-design interviews, preorders, or a limited Pro alpha. | Users value the schema but will not pay for managed compilation. |
| H-08 | Better fork, template, generated-code, vendor, and authorship handling differentiates the paid compiler. | Compare correction and false-positive rates against Community. | Advanced analysis does not materially improve trust or accuracy. |
| H-09 | Integration can remain partner-neutral. | Implement through open contracts and generic authentication. | A target integration requires proprietary profile semantics. |
| H-10 | Evidence-bounded calibration changes AI behavior usefully. | Behavioral evaluations for direct, adjacent, and insufficient evidence. | Responses remain indistinguishable or less useful. |

## 10. Domain model

- **Evidence:** an immutable observation with source, repository, revision, author assessment, timestamp, visibility, strength, limitations, and invalidation rule.
- **Claim:** a capability statement derived from evidence or supplied by the developer, with state, confidence, scope, provenance references, and freshness.
- **Correction:** an explicit assertion, rejection, or adjustment made by the developer. It changes claim precedence without deleting history.
- **Developer Profile Store:** the provider's canonical private, versioned state of claims, corrections, preferences, and evidence references. Its internal schema is not an interchange contract.
- **Portable Profile Export:** an owner-initiated, open, versioned export distinct from internal storage and from a DCP.
- **Demand Profile:** capabilities relevant to the current project and task.
- **Developer Context Packet:** an always-small, task-scoped, versioned projection produced for a declared purpose, audience, expiry, and disclosure budget. It is never a full-profile export.
- **Evidence Collector/Source Adapter:** a bounded component that reads an authorized source and emits normalized evidence. It does not own profile or delivery semantics.
- **Profile Provider:** an implementation that maintains a profile and compiles a conforming DCP. It may consume collectors or an imported profile and need not collect sources itself. Providers may be local, independent, or managed.
- **Source Grant:** authorization for Fork Me Up to ingest a specific data source and repository set.
- **Sharing Grant:** authorization for a specific consumer to receive a defined profile projection for a purpose and duration.

Source Grants and Sharing Grants are independent. Authorizing repository ingestion never authorizes delivery to another tool.

## 11. Assessment model

### 11.1 Claim states

- `demonstrated`: direct attributable evidence supports practical use or depth.
- `adjacent`: evidence supports a transfer hypothesis from a related capability, not equivalence.
- `self-declared`: explicitly stated by the developer and not independently evidenced.
- `insufficient-evidence`: available evidence cannot support a stronger claim.
- `disputed`: the developer rejected or corrected an automated claim.

### 11.2 Observed depth

- `exposure`
- `practical-use`
- `demonstrated-depth`

Observed depth and confidence are separate. Confidence describes support for the claim, not the value or seniority of the person. The initial protocol uses categorical `low`, `medium`, and `high`; it must not display statistically precise percentages until a documented calibration method and suitable evaluation dataset exist.

### 11.3 Evidence strength

Stronger evidence includes explicit corrections, attributable changes, decisions, tests, failure handling, security or performance work, meaningful refactoring, and repeated use. Confidence is reduced for uncertain identity, team code, forks, templates, tutorials, generated or vendored files, unused dependencies, bots, pair work without attribution, old evidence, and isolated keywords.

No single unverified source may independently produce `demonstrated-depth` with high confidence.

## 12. Primary use cases

- **UC-01 — Reuse calibration:** start a session without re-explaining technical background and explanation preferences.
- **UC-02 — Direct knowledge:** remain concise and focus on trade-offs when task-relevant depth is demonstrated.
- **UC-03 — Adjacent knowledge:** use a known concept as an analogy while clearly stating where transfer stops.
- **UC-04 — Insufficient evidence:** explain purpose, mechanics, expected result, risks, validation, and rollback without claiming ignorance.
- **UC-05 — Local profile:** compile an inspectable profile from one or more repositories explicitly selected on the machine.
- **UC-06 — Task projection:** let a compatible client request only the context required for a task and token budget.
- **UC-07 — Provenance:** inspect why a claim exists and which limitations apply.
- **UC-08 — Correction:** accept, reject, or amend a claim and preserve the verified write and history.
- **UC-09 — Portability:** create a Portable Profile Export for owner-controlled migration, or consume a task-scoped DCP from another compatible tool.
- **UC-10 — Refresh:** update only stale or changed evidence while retaining corrections.
- **UC-11 — Degraded operation:** continue ordinary work when Fork Me Up, Git, network access, or an optional adapter is unavailable.
- **UC-12 — Controlled sharing:** grant a consumer a temporary, purpose-bound context slice and revoke it later.
- **UC-13 — Professional preparation:** create a developer-controlled briefing for a portfolio, mock interview, or assistance explicitly permitted by the relevant process.
- **UC-14 — Independent provider:** allow a third party to implement a compatible provider without proprietary Cloud code.
- **UC-15 — Delete data:** remove local or hosted profile data without modifying source repositories.

## 13. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FMU-FR-001 | Detect and enforce explicitly authorized project and repository roots. | Must |
| FMU-FR-002 | Read selected project documents, manifests, Git metadata, and supported source structures without executing repository code. | Must |
| FMU-FR-003 | Produce a Demand Profile for the current project and task. | Must |
| FMU-FR-004 | Store evidence, claims, corrections, and profiles in versioned schemas. | Must |
| FMU-FR-005 | Separate observations, adjacent inferences, self-declarations, disputes, and insufficient evidence. | Must |
| FMU-FR-006 | Track provenance, author assessment, scope, visibility, freshness, limitations, and invalidation. | Must |
| FMU-FR-007 | Compile a DCP by task, purpose, audience, expiry, and token/disclosure budget. | Must |
| FMU-FR-008 | Keep the canonical Developer Profile distinct from every DCP projection. | Must |
| FMU-FR-009 | Validate all persisted and exchanged data against versioned schemas. | Must |
| FMU-FR-010 | Provide a client-neutral Profile Provider interface distinct from Evidence Collector/Source Adapter interfaces. | Must |
| FMU-FR-011 | Expose a generic local read surface through MCP `stdio`. | Must |
| FMU-FR-012 | Provide at least one reference adapter without placing client-specific types in Core. | Must |
| FMU-FR-013 | Support manual inspection and editing without requiring an LLM. | Must before Community release |
| FMU-FR-014 | Accept explicit developer corrections and verify persistence before reporting success. | Must before Community release |
| FMU-FR-015 | Create an owner-initiated Portable Profile Export and delete profile data without credentials or raw private source. | Must before Community release |
| FMU-FR-016 | Operate meaningfully without GitHub authentication or a hosted account. | Must |
| FMU-FR-017 | Analyze multiple selected local repositories with bounded work. | Should |
| FMU-FR-018 | Configure developer identity and represent uncertain, coauthored, bot, squash, and pair-work attribution. | Should |
| FMU-FR-019 | Detect or down-rank forks, templates, generated, vendored, tutorial, and duplicated evidence. | Should |
| FMU-FR-020 | Refresh incrementally and expose cache origin, fingerprints, freshness, and invalidation. | Should |
| FMU-FR-021 | Ask at most one high-information clarification when uncertainty materially changes behavior. | Should |
| FMU-FR-022 | Diagnose installation, schemas, adapters, cache, and context size without exposing sensitive content. | Should before Community release |
| FMU-FR-023 | Maintain public conformance fixtures and compatibility tests for providers and consumers. | Must before Community release |
| FMU-FR-024 | Prove the same DCP semantics in at least two materially different consumers. | Must before portability claim |
| FMU-FR-025 | Continue ordinary client work when optional analysis or delivery fails. | Must |
| FMU-FR-026 | Reject unauthorized access, invalid schemas, cross-tenant data, and redaction failures. | Must |
| FMU-FR-027 | Let the owner see and revoke Source Grants and Sharing Grants. | Must before Cloud beta |
| FMU-FR-028 | Use a GitHub App with selected-repository, least-privilege access for managed private repositories. | Must before Pro private-repository support |
| FMU-FR-029 | Expose an authenticated remote MCP endpoint with minimized scopes and purpose-bound grants. | Must for commercial MLP |
| FMU-FR-030 | Derive the remote subject and consumer from authorization, never an arbitrary client-provided developer identifier. | Must for commercial MLP |

## 14. Non-functional requirements

| ID | Requirement |
|---|---|
| FMU-NFR-001 | Public contracts remain client-, model-, transport-, and provider-neutral. |
| FMU-NFR-002 | Common DCPs are compact, bounded, and task-oriented. |
| FMU-NFR-003 | Cached local context loads quickly enough not to disrupt an interactive task. |
| FMU-NFR-004 | The Community offline mode opens no listener and makes no network request. |
| FMU-NFR-005 | Secrets, tokens, raw evidence, source/document excerpts, absolute personal paths, and complete conversations never appear in DCPs or normal logs. |
| FMU-NFR-006 | Every material automated claim is traceable to evidence or explicitly labeled as a developer declaration. |
| FMU-NFR-007 | Authorization, isolation, validation, and redaction fail closed. |
| FMU-NFR-008 | Optional analysis failures degrade availability without weakening security. |
| FMU-NFR-009 | Schemas have explicit versions, migrations, examples, and compatibility rules. |
| FMU-NFR-010 | Windows, macOS, and Linux are release targets; early spikes may document a smaller tested matrix. |
| FMU-NFR-011 | Tests are deterministic, offline by default, and use only synthetic fixtures. |
| FMU-NFR-012 | Network work is bounded, cancellable, cache-aware, visible, and retry-limited. |
| FMU-NFR-013 | Repository scanning enforces path, symlink, file-count, byte, depth, and time limits. |
| FMU-NFR-014 | Profile writes are atomic, recoverable, schema-validated, and observable. |
| FMU-NFR-015 | Telemetry is disabled by default and contains no source or profile content when enabled. |
| FMU-NFR-016 | The Community reference provider requires no additional LLM API or usage charge. |
| FMU-NFR-017 | A clean checkout has a pinned, documented, lockfile-enforced setup and verification path. |
| FMU-NFR-018 | Public releases are reproducible, inspectable, checksummed, and accompanied by an SBOM and provenance when supported. |
| FMU-NFR-019 | A consumer receives only data allowed by its grant, purpose, scopes, and disclosure policy. |
| FMU-NFR-020 | The developer can export and delete their data without losing access to the open format. |

## 15. Generated response policy

For a demonstrated capability, a consuming agent should use direct technical language, omit unnecessary fundamentals, and emphasize decisions, alternatives, and trade-offs.

For adjacent knowledge, it should start with the known concept, state why the transfer may help, and identify where the analogy or idiom differs.

For insufficient evidence, it should not assume either expertise or ignorance. It should explain what is necessary for safe progress and may ask one short question only when the answer changes the implementation path or risk.

For commands and operational actions, the policy may require:

- category: routine, diagnostic, recovery, or exceptional;
- purpose and preconditions;
- expected result and stopping signal;
- side effects and risk;
- validation and rollback when applicable.

Irreversible or security-sensitive actions receive explanation and confirmation regardless of inferred experience.

## 16. Product stages

### Technical MVP

A fixture-backed, client-neutral DCP compiler and local MCP server prove that direct, adjacent, and insufficient evidence produce observably different behavior. One client adapter demonstrates lifecycle integration, but adapter behavior is not part of Core.

### Community MVP

A developer can install the local runtime, select repositories, inspect and correct claims, compile a DCP, use it through a compatible client, diagnose the installation, export data, and delete it. The process is reproducible and contains no proprietary-service dependency.

### Commercial MLP

A developer can connect selected GitHub repositories, receive a managed and reviewable profile, authorize a compatible remote consumer for a purpose and duration, receive a minimized DCP through authenticated MCP, inspect an audit trail, revoke access, export data, and delete the account.

The commercial MLP is **GitHub → Profile → task-scoped DCP → authenticated MCP**. It excludes Google Workspace and broad personal-data connectors.

## 17. Metrics

### Calibration value

- turns and tokens avoided during repeated onboarding;
- unnecessary over-explanation and unsafe under-explanation rates;
- task-context usefulness per thousand tokens;
- time to first useful action;
- behavior-policy compliance.

### Profile quality

- accepted, corrected, disputed, and rejected claim rates;
- false `demonstrated` claims;
- attribution accuracy and unknown-attribution rate;
- evidence freshness and stale-packet rate;
- recovery after explicit correction.

### Trust and privacy

- claims inspected before sharing;
- grants revoked and deletion requests completed;
- unauthorized or excessive-disclosure test failures;
- incidents of secrets, raw source, or personal paths in output, with a target of zero;
- security and privacy support requests.

### Portability and business

- conformance across independent providers and consumers;
- integrations requiring no Core fork;
- Community activation and continued use;
- Community-to-Pro conversion after Pro exists;
- cost per active managed profile and remote context request.

## 18. Product-level definition of done

A milestone is complete only when:

- its entry conditions, deliverables, and exit gate in `ROADMAP.md` are satisfied;
- requirements and evaluations are traceable to executable checks;
- public contracts, schemas, examples, and compatibility notes agree;
- security invariants and negative authorization/redaction tests pass;
- installation and verification succeed from a clean checkout;
- residual limitations are documented without overstating compatibility;
- no unrelated future-milestone functionality is bundled into the release.

## 19. Deferred decisions

The following require a validated need, a dedicated ADR, and an updated threat model:

- Google Workspace, email, calendar, and personal-document connectors;
- other hosted source providers;
- embeddings or vector databases;
- team or organization profiles;
- employer-facing workflows;
- enterprise deployment, VPC, or self-hosted Cloud;
- statistically calibrated numeric confidence;
- practical capability challenges;
- semantic conversation memory;
- provider-specific native integrations.

## 20. Related documents

- [Architecture](ARCHITECTURE.md)
- [Developer Context Protocol](PROTOCOL.md)
- [Security and privacy](SECURITY_PRIVACY.md)
- [Engineering process](ENGINEERING.md)
- [Risk-driven roadmap](ROADMAP.md)
- [Competitive landscape](COMPETITIVE_ANALYSIS.md)
- [ADR-0001: Open contracts and managed intelligence](adr/0001-open-contracts-managed-intelligence.md)
- [ADR-0002: Client-neutral core](adr/0002-client-neutral-core.md)
- [ADR-0003: Separate source and sharing grants](adr/0003-separate-source-and-sharing-grants.md)
- [ADR-0004: Adopt Apache-2.0 and a separate trademark policy](adr/0004-apache-license-and-trademark-policy.md)

## 21. External references

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [OpenAI — MCP server](https://developers.openai.com/plugins/concepts/mcp-server)
- [OpenAI — Plugin authentication](https://developers.openai.com/plugins/build/auth)
- [OpenAI — Security and privacy](https://developers.openai.com/plugins/guides/security-privacy)
- [GitHub — Deciding when to build a GitHub App](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/deciding-when-to-build-a-github-app)


