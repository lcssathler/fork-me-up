# Fork Me Up — Product Specification

> Status: normative product contract
> Version: 0.6
> Last updated: September 10, 2026
> Canonical language: English

This is the official source for product behavior and product rules. Accepted product changes must update the affected requirements, evaluations and dependent protocol or architecture documents in the same change.

Read Sections 1–8 for purpose, scope and principles; Sections 10–11 and 15 for how evidence becomes useful context; and Sections 12–14 for the stable requirement IDs used by agents and tests. These are product requirements, not a release checklist. The [roadmap](ROADMAP.md) records implementation state and gates; [local usage](LOCAL_COMMUNITY.md) explains the runnable checkout workflow.

<a id="1-executive-summary"></a>

## 1. What does Fork Me Up do?

Fork Me Up helps AI tools adapt their explanations to a developer's technical context. It builds a private, inspectable profile from authorized repositories, explicit statements and corrections. The intended experience is brief, progressive guidance that connects a task to concepts the developer already knows. For each task, it sends a small relevant projection called a **Developer Context Packet (DCP)** to a compatible tool.

The developer can reuse this context across clients and model providers. Repository evidence is a limited view of their experience, so every assessment must keep its uncertainty and source visible.

<a id="2-problem"></a>

## 2. What problem does it solve?

Developers repeatedly explain their background and preferences to coding agents, models and compatible preparation tools. This costs turns and tokens. Tools may over-explain familiar subjects, under-explain unfamiliar commands, or mistake a dependency, template, fork or team repository for personal expertise. Assumptions can also become trapped in a vendor or conversation, with no way to inspect why they were made.

Fork Me Up preserves reusable calibration: what was observed, inferred, declared, corrected, disputed or insufficiently evidenced. It does not attempt to determine everything a person knows.

<a id="3-product-thesis"></a>

## 3. How does the context reach an agent?

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

The DCP is advisory context. It never grants permissions or overrides the user's current instructions, repository policy or the consuming tool's safety boundaries.

<a id="4-target-users"></a>

## 4. Who is it for?

Fork Me Up is for developers who use coding agents, have uneven experience across concepts and projects, and want useful explanations without repeatedly describing their background. The first live-client target is Codex. Open contracts allow other adapters, but support is claimed only for tested clients and capabilities.

<a id="5-product-boundary"></a>

## 5. What is the public product?

Community combines a local profile, deterministic collection, owner controls, task-context compilation and open integrations. It must remain useful without a hosted account or separate model API.

The MVP target includes:

- a guided skill and local MCP workflow in the first tested client;
- selected local and authenticated public/private GitHub repositories;
- a small persistent catalog that selects relevant evidence before deeper reads;
- interpretation assisted by the developer's existing agent, with verifiable references;
- reusable experience across projects without silently treating project evidence as universal expertise;
- inspection, explicit declarations, corrections, export and deletion;
- short explanations and bounded analogies that keep the current task moving.

These are requirements, not availability claims. The current checkout has deterministic language signals, project-scoped automatic Claims, a process-local source cache and Store-backed MCP reads. Guided installation, general agent interpretation, persistent source cataloging and authenticated private GitHub collection remain to be implemented. See the [current queue](ROADMAP.md#15-current-m3-execution-queue).

### Integration and licensing

Connect is the open protocol, SDK and adapter boundary. It delivers minimized context and never owns source credentials. Local delivery may use MCP, files or SDKs; remote services are deferred and retain separate source/sharing authorization.

Public repository content uses [Apache-2.0](../LICENSE), [NOTICE](../NOTICE) and the [trademark policy](../TRADEMARKS.md). Profile data is not relicensed by processing it. These terms are unchanged; [ADR-0004](adr/0004-apache-license-and-trademark-policy.md) remains the licensing authority.

<a id="6-goals"></a>

## 6. What outcomes should it deliver?

- Explain the current task using relevant prior experience and bounded analogies.
- Reduce redundant clarification and context cost, including setup and profile maintenance.
- Introduce unfamiliar concepts briefly when needed, without blocking new technologies.
- Preserve evidence, uncertainty, corrections and portable user control.
- Work in a real client before treating packaging or synthetic conformance as product validation.

<a id="7-non-goals"></a>

## 7. What is outside the product?

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
- a separate model API requirement in the Community runtime; optional interpretation uses the developer's existing agent.

<a id="8-product-principles"></a>

## 8. Which rules always apply?

### P-01 — Evidence is bounded

Every material automated claim has provenance, confidence, freshness, and limitations. Evidence supports a claim; it does not turn it into objective truth.

### P-02 — Missing evidence is uncertainty

The default state is `insufficient-evidence`, never `does-not-know`. For example, no React evidence in the selected repositories means the system lacks evidence about React; it does not mean the developer lacks React knowledge.

### P-03 — The developer remains the authority

Explicit corrections and rejections outrank automated inference while the conflicting evidence remains traceable. If a developer rejects an inferred capability, refreshing the repository must not silently restore that inference.

### P-04 — The profile is private; packets are projections

The canonical Developer Profile is not delivered to consumers by default. A DCP contains the smallest useful slice for a declared task, purpose, audience, and token budget.

### P-05 — Open interoperability

Anyone may build a provider or consumer for the public protocol. Client-specific behavior belongs in adapters.

### P-06 — Local-first, explicit connections

Local operation remains available without GitHub login. Network discovery, source reads and model disclosure each require their own explicit scope; an account's technical access is not blanket consent.

### P-07 — Graceful for availability, strict for security

If optional analysis fails, ordinary AI work continues without Fork Me Up context. Authorization, isolation, schema validation, and redaction fail closed.

### P-08 — Engineering is evidence-backed too

Every material behavior has a test, evaluation, or reproducible verification proportional to risk.

### P-09 — Questions have a cost

Ask only when the answer materially changes behavior, risk, or scope, and ask at most one high-information question per unresolved decision.

### P-10 — No hidden data bargain

Source access, profile sharing, telemetry, and model processing require distinct, understandable consent. Profile data is not sold or used for model training without a separate explicit opt-in.

<a id="9-hypotheses-and-invalidation-signals"></a>

## 9. How will we know it is useful?

| ID | Hypothesis | Validation | Invalidation signal |
|---|---|---|---|
| H-01 | A persistent developer profile reduces repeated calibration turns and tokens. | Compare first-task conversations with and without a DCP. | DCP overhead is equal to or greater than the avoided calibration. |
| H-02 | Repository evidence produces useful claims when authorship and uncertainty remain visible. | Measure accepted, corrected, rejected, and false `demonstrated` claims. | Material claims require frequent downgrades or cannot be attributed. |
| H-03 | A task-scoped DCP is more useful and safer than a complete profile. | Compare usefulness, token size, and unnecessary disclosure. | Consumers need the full profile for ordinary tasks. |
| H-04 | The same public contract works across different clients. | Run conformance and behavioral tests in at least two materially different consumers. | Each client requires a fork or different core semantics. |
| H-05 | Explicit provenance and corrections increase user trust. | Measure inspections, corrections, successful writes, and continued use. | Users do not trust or understand the resulting claims. |
| H-06 | Community is valuable without a hosted account. | Users complete a local workflow and reuse the profile. | The runtime needs an undeclared hosted dependency. |
| H-09 | Integration can remain partner-neutral. | Implement through open contracts and generic authentication. | A target integration requires client-specific profile semantics. |
| H-10 | Evidence-bounded calibration changes AI behavior usefully. | Behavioral evaluations for direct, adjacent, and insufficient evidence. | Responses remain indistinguishable or less useful. |

H-07 and H-08 are retired from the active public plan; their identifiers are reserved and must not be reassigned. Initial owner calibration tests H-01/H-05/H-10 without claiming population results.

<a id="10-domain-model"></a>

## 10. What information does the system handle?

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

<a id="11-assessment-model"></a>

## 11. How are assessments made and controlled?

### 11.1 Claim states

- `demonstrated`: selected attributable evidence supports the stated exposure, practical use or depth within its recorded scope; it does not certify understanding or unaided ability.
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

### 11.4 AI-assisted development and interpretation limits

AI assistance alone neither establishes nor negates a developer's understanding. Git attribution is a configured metadata association, not proof of who typed, reviewed or understood each line. Generated-source indicators describe possible artifact/provenance limitations; they must not be presented as detection of AI use. Path indicators may be wrong about actual origin, and unflagged content remains origin-unverified. Explicit bot coauthors/committers do not erase recognized human participation; ordinary collaboration limits remain visible.

The current Community two-observation practical-use rule is a project-evidence heuristic, not a validated scale of expertise. All its automated claims remain project-scoped and at most medium confidence/practical-use. The [evidence method](EVIDENCE_METHOD.md) records primary-source research, rejected alternatives and interpretation limits. The [M2 quality protocol](evaluations/M2_QUALITY_PROTOCOL.md) measures frozen synthetic conformance, including assisted-workflow invariance; its rates must not be advertised as human knowledge accuracy or human acceptance rates. [ADR-0031](adr/0031-evidence-method-and-frozen-quality-protocol.md) records the owner-delegated decision.

### Planned interpretation and transfer

The existing agent may suggest task capabilities, concept relationships and assessments from a bounded authorized evidence view. No complete technology catalog is required before use. Names, descriptions and language metadata select candidates; they do not establish personal knowledge. Concept-level interpretation needs relevant collected facts or bounded redacted source excerpts in a separately authorized owner view, never raw code inside a DCP. New identifiers and relationships still need validated representations and executable compatibility checks.

An interpretation is a provisional inference with evidence references, confidence, scope and limitations. It cannot certify understanding, erase source-risk ceilings or rewrite policy. Evidence references must resolve to collected records; unsupported statements remain uncertain. The initial overview is presented for owner review. Later provisional inferences may be saved through a separately authorized owner workflow without interrupting every task.

Reuse across projects must retain the original evidence scope and express transfer as a hypothesis. Never relabel an old project Claim as global or treat the new project's stack as evidence about its developer. A new or empty project can supply intended task needs while prior authorized projects supply experience. Analogy generation must identify both the shared concept and where the comparison stops.

These requirements extend the current producer; they do not enable free-text interpretation or cross-project selection in today's Core.

### 11.5 What happens when repositories change?

Community refresh uses a bounded private cache in the current process (`FMU-FR-017`/`FMU-FR-020`). Unchanged metadata within the maximum observation age avoids content rescanning and Git processes, but still requires bounded path and metadata verification.

Original source age, cache origin, fingerprint changes and partial or invalid outcomes remain inspectable. A `fresh` refresh means the source cache passed validation; individual Claims can still be stale. An incomplete source set cannot produce an aggregate assessment that drops the limitations of missing repositories. Restart or changed configuration begins a cold source cache; the persisted profile and correction history remain available.

### Planned selective collection and reuse

Consult saved context first. Within the owner's authorized repository set, inspect a bounded metadata catalog, select candidates by task concepts as well as stack, and deepen only useful reads. Include possible adjacent experience instead of filtering by language alone. The initial experiment may inspect three to five candidates; this is a tuning hypothesis, not a completeness claim or fixed production limit.

Persist only the reviewed catalog/evidence inventory with provenance and observation age. Recheck permissions, source identity, changes and freshness before reuse. Metadata checks never renew old evidence age. Stop at explicit request, file, byte, time, retry, concurrency and model-context budgets; expose omitted coverage and avoid repeatedly starting collection for every prompt. A catalog larger than the collection limit is not permission to bypass that limit.

Selection can be partial, but each selected collection must satisfy its integrity checks. Do not promote incomplete or selectively omitted evidence into stronger claims; failed collection retains current fail-closed behavior. Persistent cache, invalidation and deletion require implementation-specific schemas and tests before use.

### 11.6 How can the developer inspect and correct the profile?

The local owner CLI works without an LLM (`FMU-FR-013`/`FMU-FR-014`). Corrections, disputes and rejections override automated interpretation while preserving its original provenance. Declarations stay self-declared and never acquire observed depth. History survives source refresh, source removal and restart; only verified persistence reports success.

Owner collection and persistence are separate from Store-backed MCP delivery of bounded current-project context. Source authority never crosses into consumer requests.

Historical automated Claims remain privately inspectable but do not count as current task knowledge. Notes remain private and inert. See [inspection and corrections](OWNER_WORKFLOW.md).

Owner-only capability evidence lookup preserves assessment and history metadata while omitting private content. Read-only diagnostics report installation/module, Store schema/gate, adapter cache and optional DCP size, expiry and budget state. Missing and unchecked components remain explicit. These owner operations do not expand public contracts or consumer disclosure (`FMU-FR-010`/`FMU-FR-022`/`FMU-FR-023`/`FMU-FR-026`). See [diagnostics](OWNER_WORKFLOW.md#evidence-lookup-and-doctor).

### Planned conversational updates

Within an explicit owner-approved profile-write scope, a direct statement or correction can be persisted through the owner workflow with verified acknowledgment. A model summary is not an owner declaration. Asking a question does not prove ignorance. General familiarity can justify a tentative explanation shortcut, but does not create verified mastery of every related concept.

Keep only the bounded declaration or correction and its provenance; do not archive the full conversation. Corrections outrank subsequent inference. The guided workflow must make inspection, revision and withdrawal accessible without requiring a second questionnaire.

### 11.7 What can be exported, imported or deleted?

Owner exports retain typed profile and correction behavior in the open format while omitting private prose, source locations and internal authority. Imports require an absent Store and matching subject (`FMU-FR-015`/`FMU-FR-026`, `FMU-NFR-020`).

Explicit local deletion covers recognized Store files, subject-scoped in-process caches and, with separate explicit scope, all local Codex adapter cache entries. Content-free barriers prevent recreation. Independent exports and backups, source repositories and already returned objects remain owner-managed. Bounded failures never claim successful deletion. The [deletion inventory and recovery procedure](OWNER_WORKFLOW.md#delete-managed-local-data) defines the exact scope and steps.

<a id="12-primary-use-cases"></a>

## 12. Which user journeys must be supported?

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
- **UC-14 — Independent provider:** allow a third party to implement a compatible provider using only the public contracts.
- **UC-15 — Delete data:** remove local or hosted profile data without modifying source repositories.
- **UC-16 — New-project transfer:** explain an unfamiliar project or task through relevant experience from other authorized projects.
- **UC-17 — Guided calibration:** configure sources, review an initial overview and persist explicit conversational corrections in the first tested client.

## 13. Functional requirements

These stable IDs specify required behavior. Priority names a delivery obligation, not current availability.

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
| FMU-FR-027 | Let the owner see and revoke Source Grants and Sharing Grants. | Before authenticated source access or remote sharing |
| FMU-FR-028 | Use a GitHub App with selected-repository, least-privilege access for managed private repositories. | Before hosted private-source access |
| FMU-FR-029 | Expose an authenticated remote MCP endpoint with minimized scopes and purpose-bound grants. | Before remote delivery |
| FMU-FR-030 | Derive the remote subject and consumer from authorization, never an arbitrary client-provided developer identifier. | Before remote delivery |
| FMU-FR-031 | Provide guided identity/source setup and real Store-backed context in the first tested client. | Must for usable MVP |
| FMU-FR-032 | Read explicitly selected public/private GitHub repositories through a bounded authenticated owner connector. | Must for usable MVP |
| FMU-FR-033 | Select evidence progressively from a persistent private catalog and reuse valid results across sessions. | Must for usable MVP |
| FMU-FR-034 | Validate agent-assisted interpretations with evidence, uncertainty and owner review, without a separate model API. | Must for usable MVP |
| FMU-FR-035 | Reuse scoped experience across projects through explicit, bounded transfer hypotheses. | Must for usable MVP |
| FMU-FR-036 | Persist explicit conversational declarations/corrections through authorized owner operations and verified writes. | Must for usable MVP |
| FMU-FR-037 | Validate progressive explanations and total context cost with an owner-led, versioned live-client experiment. | Must before release preparation resumes |

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
| FMU-NFR-016 | The runtime requires no separate model API account; optional interpretation uses the existing agent and counts its context cost. |
| FMU-NFR-017 | A clean checkout has a pinned, documented, lockfile-enforced setup and verification path. |
| FMU-NFR-018 | Public releases are reproducible, inspectable, checksummed, and accompanied by an SBOM and provenance when supported. |
| FMU-NFR-019 | A consumer receives only data allowed by its grant, purpose, scopes, and disclosure policy. |
| FMU-NFR-020 | The developer can export and delete their data without losing access to the open format. |

<a id="15-generated-response-policy"></a>

## 15. How should an agent adapt its response?

For a demonstrated capability, a consuming agent should use direct technical language, omit unnecessary fundamentals, and emphasize decisions, alternatives, and trade-offs.

For adjacent knowledge, it should start with the known concept, state why the transfer may help, and identify where the analogy or idiom differs.

For insufficient evidence, it should not assume either expertise or ignorance. Start with brief, progressive guidance and introduce concepts at the point of use. Ask one short question only when the answer materially changes the implementation path or risk. Do not switch the task into an unsolicited tutorial or block a useful technology because familiarity is uncertain.

For commands and operational actions, the policy may require:

- category: routine, diagnostic, recovery, or exceptional;
- purpose and preconditions;
- expected result and stopping signal;
- side effects and risk;
- validation and rollback when applicable.

Irreversible or security-sensitive actions receive explanation and confirmation regardless of inferred experience.

### 15.1 How does Community determine task needs?

The Community Demand producer accepts explicit structured task capabilities and optional candidate interpretations; it does not interpret natural-language prose. Source languages from the selected current project provide supporting demand. An explicit collected-file selection can narrow that scope.

- Empty demand and equivalent interpretations do not start an onboarding questionnaire.
- Interpretations require one clarification only when effective capabilities, relevance or operation risk differ. An offered answer resolves that decision without another question.
- Demand does not establish developer knowledge or authorize an operation.
- Potentially sensitive task prose is replaced with a fixed minimized summary.

`FMU-E-009` and `FMU-E-010` verify this implementation of `FMU-FR-003` and `FMU-FR-021`. The planned agent-assisted interpretation must validate proposed task needs before this boundary; it remains unimplemented. The [local workflow](LOCAL_COMMUNITY.md) documents the separate owner and consumer entry points.

<a id="16-product-stages"></a>

## 16. What defines each delivery stage?

These are stage acceptance outcomes. Completion and release eligibility are recorded only in the [roadmap](ROADMAP.md). The current [local checkout workflow](LOCAL_COMMUNITY.md) has synthetic end-to-end verification using actual subprocesses and temporary Git repositories. That evidence does not establish a packaged release, new live-client hook integration or model-authored output.

### Technical MVP

A fixture-backed, client-neutral DCP compiler and local MCP server prove that direct, adjacent, and insufficient evidence produce observably different behavior. One client adapter demonstrates lifecycle integration, but adapter behavior is not part of Core.

### Usable Community MVP

A developer configures authorized sources in the first tested client, reviews a profile, receives useful task explanations through live MCP delivery, corrects it conversationally and reuses the result in another project. Selected public/private GitHub sources, bounded selective reuse and evidence-backed agent interpretation are included. The owner-led calibration must distinguish actual response usefulness from structured conformance.

### Public distribution

New users can reproduce the supported workflow from public instructions and exact artifacts. Compatibility names tested clients, platforms, transports and lifecycle behavior; it never promises every agent. Packaging, supply-chain verification and publication follow the usable-MVP gate.

### Deferred remote delivery

Any future hosted deployment must preserve open contracts, independent source/sharing grants, least privilege, minimized authenticated delivery and revocation. It is not a prerequisite for the local MVP.

<a id="17-metrics"></a>

## 17. What should be measured?

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

### Portability and continued use

- conformance across independent providers and consumers;
- integrations requiring no Core fork;
- Community activation and continued use;
- repeated use across sessions and projects;
- setup, scanning, interpretation and delivered-context cost per useful task.

The [M3 Community benchmark](evaluations/M3_COMMUNITY_BENCHMARK.md) measures only constructed evidence outcomes, exact payload disclosure and repeated structured policy conformance across the Codex and generic consumers. It does not measure conversational turns avoided, response usefulness, human accuracy, time saved, population behavior or rankings; those metrics require separate studies.

<a id="18-product-level-definition-of-done"></a>

## 18. When is a milestone complete?

A milestone is complete only when:

- its entry conditions, deliverables, and exit gate in `ROADMAP.md` are satisfied;
- requirements and evaluations are traceable to executable checks;
- public contracts, schemas, examples, and compatibility notes agree;
- security invariants and negative authorization/redaction tests pass;
- installation and verification succeed from a clean checkout;
- residual limitations are documented without overstating compatibility;
- no unrelated future-milestone functionality is bundled into the release.

<a id="19-deferred-decisions"></a>

## 19. Which decisions need further evidence?

The following require a validated need, a dedicated ADR, and an updated threat model:

- Google Workspace, email, calendar, and personal-document connectors;
- other hosted source providers;
- embeddings or vector databases;
- team or organization profiles;
- employer-facing workflows;
- hosted deployment, enterprise environments or VPC operation;
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
- [ADR-0041: Guided, evidence-backed local MVP](adr/0041-guided-evidence-backed-local-mvp.md)
- [ADR-0002: Client-neutral core](adr/0002-client-neutral-core.md)
- [ADR-0003: Separate source and sharing grants](adr/0003-separate-source-and-sharing-grants.md)
- [ADR-0004: Adopt Apache-2.0 and a separate trademark policy](adr/0004-apache-license-and-trademark-policy.md)

## 21. External references

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [OpenAI — MCP server](https://developers.openai.com/plugins/concepts/mcp-server)
- [OpenAI — Plugin authentication](https://developers.openai.com/plugins/build/auth)
- [OpenAI — Security and privacy](https://developers.openai.com/plugins/guides/security-privacy)
- [GitHub — Deciding when to build a GitHub App](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/deciding-when-to-build-a-github-app)
