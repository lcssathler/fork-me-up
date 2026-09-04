# Fork Me Up — Security and Privacy

> Status: mandatory pre-implementation baseline  
> Version: 0.1  
> Last updated: September 4, 2026

This document turns “do not leak anything” into explicit, testable boundaries. It is normative for security and privacy. A feature that cannot satisfy these invariants does not ship.

## 1. Security objectives

Fork Me Up must:

- analyze only developer-authorized sources;
- treat every source as untrusted data;
- avoid executing analyzed code;
- keep the canonical profile private by default;
- deliver only a minimized, authorized DCP;
- separate source credentials from consumer credentials;
- prevent cross-root, cross-profile, cross-consumer, and future cross-tenant access;
- keep secrets and raw sensitive content out of logs, diagnostics, errors, fixtures, exports, and compact packets;
- make access, persistence, sharing, revocation, export, and deletion observable to the developer;
- continue ordinary AI work without weakening protection when Fork Me Up is unavailable.

## 2. Data classes

| Class | Examples | Default handling |
|---|---|---|
| Public contract | schemas, capability identifiers, SDK types | Public and versioned. |
| Public source metadata | approved public repository and revision references | Store only when needed; disclose according to DCP policy. |
| Private source metadata | private repository names, branches, contributor identity | Private; redact from ordinary consumer packets. |
| Raw source content | code, configuration, commit/PR/issue text | Process minimally; do not place in compact DCP or logs. |
| Evidence | normalized observations and source-relative references | Private profile data; disclose bounded metadata only. |
| Claims and corrections | capability assessments, developer assertions | Personal profile data; purpose-bound disclosure. |
| Credentials | provider tokens, consumer tokens, session secrets | Dedicated secure storage only; never profile data. |
| Operational metadata | timings, versions, error categories, correlation IDs | Content-free and minimized. |

The classification is based on sensitivity, not only repository visibility. Public code can still contain secrets, personal data, or malicious instructions.

## 3. Trust boundaries

```text
Untrusted repository content
        ↓ authorized, bounded read
Collection boundary
        ↓ normalized evidence only
Private profile boundary
        ↓ task/purpose/grant compiler
DCP disclosure boundary
        ↓ minimized packet
External client and its model provider
```

Future Cloud adds separate boundaries for source providers, ingestion workers, tenant storage, authorization, remote MCP, and third-party consumers. Each boundary validates inputs and re-authorizes access independently.

## 4. Testable invariants

### Local Community invariants

- Offline mode makes no network call and opens no network listener.
- Only canonical paths inside explicitly selected roots are read.
- Symlinks cannot escape authorized roots.
- No repository script, binary, hook, package manager, build, or test command is executed during evidence collection.
- Embedded URLs are not followed automatically.
- File count, size, depth, time, concurrency, and output budgets are enforced.
- Compact DCPs contain no credentials, complete source files, absolute personal paths, or complete conversations.
- Repository content cannot alter privileged configuration or response policy.
- Real personal data is absent from fixtures and test snapshots.
- Failed redaction returns no affected payload.
- Failed profile writes leave the prior valid version available and are never reported as saved.

### Future Cloud invariants

- Every record and cache key is tenant-bound.
- Every protected operation derives subject and consumer from validated authorization.
- Invalid or expired tokens return no protected data.
- Insufficient scopes return no partial protected result.
- A consumer cannot choose an arbitrary developer identifier.
- Source tokens are never returned to or passed through a consumer.
- Source Grants and Sharing Grants are distinct and independently revocable.
- A Sharing Grant restricts consumer, purpose, scopes, disclosure, and duration.
- Repository selection is enforced end to end, not only in the UI.
- Audit records omit source content, DCP bodies, prompts, and tokens.
- Export and deletion cover primary data, derived data, caches, and documented backup retention.

## 5. Threat model

### T-01 — Prompt injection in source material

**Threat:** a README, code comment, commit, issue, pull request, or document tells an agent to ignore rules, expose data, or execute actions.

**Controls:**

- source text is untrusted data, never system or tool instruction;
- deterministic collectors extract typed signals rather than forwarding documents wholesale;
- free text is bounded and sanitized;
- source text cannot directly set `responsePolicy`, grants, scopes, or configuration;
- adversarial fixtures assert that instruction-like text has no privileged effect.

### T-02 — Path traversal, symlink escape, and unsafe filesystem access

**Threat:** crafted paths escape a selected root or cause excessive reads.

**Controls:** real-path canonicalization, selected-root enforcement, explicit symlink policy, no implicit submodule expansion, ignore rules, and resource budgets. Tests cover traversal, junctions/symlinks, device paths, unusual Unicode, deep trees, and platform-specific separators.

### T-03 — Command or code execution

**Threat:** repository names, paths, manifests, or metadata become shell syntax or cause package scripts to run.

**Controls:** no repository execution during collection; subprocess argument arrays; no shell-composed input; no dependency install; explicit allowlist of required Git operations; sanitized Git environment with pagers, hooks, fsmonitor, external diff, and textconv disabled; untrusted config/includes ignored or strictly controlled; bounded environment; negative fixtures for `.git/config`, `.gitattributes`, names, and shell metacharacters.

### T-04 — Secret and personal-data leakage

**Threat:** credentials, code, personal paths, emails, or task content appear in packets, logs, errors, diagnostics, telemetry, tests, or crash reports.

**Controls:** data classification, minimization before serialization, structured logging allowlists, secret redaction, opaque identifiers, canary tests in every output channel, and no real-data fixtures.

### T-05 — Incorrect authorship and inflated claims

**Threat:** team code, forks, templates, vendor files, generated output, tutorials, bots, squash commits, or copied examples are treated as demonstrated personal depth.

**Controls:** explicit attribution state, negative evidence flags, coauthor representation, configured identity matching, repeated qualitative signals, conservative confidence, visible limitations, and developer correction. Unknown authorship alone cannot yield high-confidence `demonstrated-depth`.

### T-06 — Profile poisoning or unsafe correction text

**Threat:** imported profiles or free-text corrections inject instructions or permanently distort the profile.

**Controls:** schema validation, typed correction fields, length and character limits, separation of descriptive text from policy, source/version metadata, correction history, and safe migration. Corrections outrank inference but do not gain execution authority.

### T-07 — Excessive disclosure to a consumer

**Threat:** a client or model requests the complete profile, raw evidence, unrelated capabilities, or another person's profile.

**Controls:** server-side task relevance, disclosure budgets, scope checks, purpose-bound grants, subject and audience derivation, opaque evidence references, no remote raw-evidence scope in the commercial MLP, and authorization-negative tests.

### T-08 — Confused deputy and token passthrough

**Threat:** a consumer token is reused against a source provider, or a source token is exposed downstream.

**Controls:** separate OAuth roles and token stores, resource/audience validation, no token passthrough, per-call authorization, least privilege, short-lived tokens, PKCE `S256`, exact redirect-URI and `state` validation, revocation, and secret-safe diagnostics. If client metadata or dynamic registration is supported, metadata retrieval is SSRF-restricted and registration, redirects, and discovery are rate-limited and abuse-monitored.

### T-09 — Cross-tenant or cache leakage

**Threat:** future hosted data is returned across accounts through identifiers, caches, queues, logs, or object storage.

**Controls:** tenant key on every record, tenant-derived cache keys, policy enforcement at access layers, non-enumerable identifiers, pairwise consumer identifiers where practical, negative integration tests, and audit alerts.

### T-10 — Stale, inconsistent, or corrupted state

**Threat:** outdated evidence, interrupted writes, incompatible schemas, or concurrency causes incorrect context.

**Controls:** fingerprints, observed-through timestamps, expiry, atomic write-and-replace, validation before activation, migration tests, optimistic concurrency or equivalent version checks, retained prior valid state, and explicit partial/stale results.

### T-11 — Supply-chain compromise

**Threat:** dependencies, install scripts, CI actions, or release infrastructure leak data or alter artifacts.

**Controls:** minimal dependencies, lockfile-enforced installs, dependency and license review, immutable CI action pins, minimum workflow permissions, secret scanning, SBOMs, artifact inspection, checksums, and provenance/signing when supported.

### T-12 — Malicious provider, import, or DCP

**Threat:** an independent provider or imported profile places instruction-like text in limitations, task summaries, extension fields, or identifiers that an adapter promotes into privileged instructions.

**Controls:** validate schema and budgets at the consumer boundary; treat every free-text field as unprivileged data; map only allowlisted enums, booleans, and identifiers into instructions; disallow prompt-bearing extension strings; use pairwise or packet-bound remote identifiers; and include malicious DCP fixtures in conformance tests.

### T-13 — Occupational misuse

**Threat:** profile claims are used to rank candidates, infer employability, monitor workers, fabricate experience, or provide covert assistance where prohibited.

**Controls:** no universal score, no employer enumeration, developer-controlled disclosure, evidence/uncertainty labels, purpose restrictions, auditability, and product positioning around personal calibration, preparation, or explicitly permitted assistance.

## 6. Consent model

### 6.1 Source Grant

Authorizes Fork Me Up to read a defined source. It records:

- source provider and account;
- explicit repository or root selection;
- permissions and visibility;
- issue, expiry, and revocation state;
- policy version;
- allowed processing and retention.

The first managed connector should be a GitHub App with selected-repository, read-only, least-privilege access and short-lived installation tokens. Connecting one source does not authorize other repositories or providers.

Source revocation offers two explicit owner choices. `disconnect` stops new collection and marks affected evidence and claims stale according to retention policy. `disconnect-and-delete` also removes derived evidence, claims, caches, and scheduled refresh, recompiles the profile, and applies documented backup deletion. Existing Sharing Grants are re-evaluated and may return less or no context.

### 6.2 Sharing Grant

Authorizes one consumer to receive a projection. It records:

- developer and consumer;
- purpose and audience;
- allowed disclosure class and scopes;
- issue and expiry time;
- policy version and revocation state;
- declared downstream processors, retention, and onward-sharing terms.

Remote purposes come from a versioned allowlist and must match the saved grant exactly. The provider can enforce what it releases but cannot guarantee downstream use after delivery. Consent names declared processors and explains that revocation blocks subsequent calls within a documented enforcement SLA but cannot retrieve an already delivered DCP. Short packet TTLs limit, but do not eliminate, this exposure.

### 6.3 Owner operations

Connecting or revoking sources, correcting claims, managing Sharing Grants, exporting, and deleting data are owner-controlled operations. Initially they should use a first-party CLI or UI rather than unconstrained model-callable tools.

## 7. Authentication and authorization baseline

Local `stdio` does not by itself isolate processes running as the same operating-system user and does not prove that the connected model is the profile owner. Each client installation has explicit roots and profile-store configuration, restrictive local ACLs where supported, and model-facing evidence lookup disabled by default. Future remote MCP uses stable HTTPS and standards-compatible authorization, including OAuth 2.1, PKCE, protected-resource metadata, audience/resource binding, token and Sharing Grant validation on every request, short-lived access, refresh rotation where applicable, step-up scopes, and revocation enforcement within a documented SLA.

The server authorizes before revealing profile existence. It returns `401` for absent, invalid, or expired authorization and `403` for insufficient scope, with no protected payload and no enumerable difference for another person's or a nonexistent profile.

Stale context may be used only while the token and Sharing Grant remain valid and the source-retention policy permits it. Schema or redaction failure never falls back to stale output. An expired DCP is not reused silently. Source unavailability may produce an explicitly stale packet only within its configured freshness and retention bounds.

## 8. Logging, telemetry, and diagnostics

- Telemetry is off by default.
- Logs use an allowlist of content-free fields such as operation, duration bucket, version, result category, and opaque correlation ID.
- Logs omit task text, DCP bodies, profile claims, raw evidence, paths, repository names, commit messages, tokens, and identity fields unless a separately reviewed first-party owner view requires a minimized form.
- Diagnostics are designed to be safely shareable and tested with canary secrets.
- Crash handling must not serialize arbitrary inputs or environment variables.
- Debug modes cannot bypass redaction; sensitive local debugging requires explicit, temporary owner action and must never be the default.

## 9. Retention, export, and deletion

Community stores only documented local profile and cache files. Export validates the output schema and excludes credentials and raw private source by default. Deletion is scoped to Fork Me Up data and must never alter source repositories.

Before Cloud beta, the project must publish and test:

- data inventory and purpose;
- retention periods per data class;
- cache and derived-data deletion;
- backup retention and eventual deletion behavior;
- account export format;
- source disconnection behavior;
- Sharing Grant revocation behavior;
- incident response and user notification process.

## 10. Security test matrix

Required cases include:

- valid and escaped roots;
- hostile Git configuration and attributes with pagers, hooks, fsmonitor, external diff, textconv, and untrusted includes disabled;
- symlinks/junctions and platform-specific paths;
- shell metacharacters in names and Git metadata;
- malicious README, code comment, commit, imported profile, provider response, and DCP instructions;
- adapter mapping that promotes only allowlisted enums, booleans, and identifiers;
- very large, binary, compressed, and deeply nested inputs;
- forks, templates, vendor, generated files, bots, coauthors, and unknown identity;
- canary secrets in every input with absence assertions for every output channel;
- invalid, stale, and incompatible schemas;
- interrupted, concurrent, and failed writes;
- unauthorized evidence lookup and excessive task context;
- invalid token, wrong audience, insufficient scope, expired grant, and revoked grant;
- cross-tenant identifiers and poisoned caches before Cloud;
- dependency, artifact, and release-content inspection.

M0-S08 adds development-only [DCP draft checks](PROTOCOL.md#42-draft-limits-and-validation-scope): exact authoring fields, bounded fixture reads, invalid-input and symlink cases, and fixed CLI diagnostics. These tests do not prove runtime authorization, redaction, task relevance, pairwise identity, or safe adapter behavior; a structurally valid free-text field can still contain sensitive or instruction-like content. The runtime and conformance gates above remain mandatory.

## 11. Gates

### Before Community implementation is considered safe

- Initial threat model reviewed.
- Authorized-root and no-execution design accepted.
- Synthetic adversarial fixtures exist.
- Redaction and canary strategy is executable.
- Offline no-network behavior is tested.
- Profile write, export, and deletion behavior is specified.

### Before any private repository reaches Cloud

- Updated data-flow diagram and data inventory.
- GitHub App permissions documented and minimized.
- Token vault and key-management design reviewed.
- Tenant isolation and authorization-negative tests passing.
- Retention, export, deletion, backup, and incident plans documented.
- Independent security review or a documented second-responsible review appropriate to the exposure, covering GitHub App permissions/webhooks, token and key management, isolation, deletion including backups, recovery, and incident response.
- No confirmed, unresolved, unmitigated critical or high-severity finding before real private data is processed.

### Before remote consumer access

- OAuth and MCP conformance tests pass.
- Source and Sharing Grants are independent end to end.
- Scope matrix and audience validation are enforced.
- Remote raw-evidence access is absent.
- Audit events are content-free.
- Revocation is observable and tested.

## 12. Deferred sources

Google Workspace, email, calendar, and broad personal-document sources are deliberately outside the initial Community and commercial MLP. Adding any such source requires a validated product need, source-specific privacy analysis, consent design, provider verification requirements, new adversarial fixtures, accepted ADR, and updated retention policy.

## 13. References

- [Product specification](PROJECT_SPEC.md)
- [Architecture](ARCHITECTURE.md)
- [Protocol](PROTOCOL.md)
- [Engineering process](ENGINEERING.md)
- [OpenAI — Security and privacy](https://developers.openai.com/plugins/guides/security-privacy)
- [OpenAI — Plugin authentication](https://developers.openai.com/plugins/build/auth)
- [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [GitHub — Deciding when to build a GitHub App](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/deciding-when-to-build-a-github-app)


