# ADR-0041: Guided, evidence-backed local MVP

- Status: Accepted
- Date: 2026-09-10

## Context and authority

The owner requested a public documentation and roadmap revision prioritizing useful explanations in a real client. The existing local workflow and synthetic benchmarks provide a foundation, but do not establish guided onboarding, general interpretation, cross-project transfer or human usefulness. Product Specification Sections 5, 11 and 15–17 define the revised outcomes; Roadmap owns their execution order.

This decision supersedes ADR-0001's public product scope. Apache-2.0, NOTICE and trademark terms under ADR-0004 are unchanged. Existing implementation ADRs remain authoritative for their delivered boundaries until an implementing slice explicitly refines them. Historical evidence and frozen M2/M3 results are not rewritten or treated as proof of new behavior.

## Decision

- Start with a guided local skill and Store-backed MCP workflow in Codex. Keep Protocol/Core independent of the host; publish only tested compatibility. The skill orchestrates owner-authorized setup and review; it grants no source, disclosure or write authority itself.
- Include explicitly selected local and public/private GitHub repositories in the local MVP. Discovery permission and content-read permission are bounded separately. Account access is not a repository grant. A connector-specific ADR and security review must settle authentication, exact repository selection and credential ownership before implementation; this document does not expand the current public-history port.
- Consult the profile before collecting. A private metadata catalog selects a small set of task-relevant and potentially adjacent repositories, including across languages. Metadata selects candidates, never proves capability. Bound total work, report coverage and stop rather than recursively scanning the account.
- Add persistent, schema-validated catalog/evidence reuse outside source roots. Bind reuse to subject, authorization, source revision, identity, extractor/interpretation version and observation age. Define revocation, expiry, deletion and recovery before persistence ships. Never deserialize cached authority or use HEAD alone to validate local uncommitted content.
- Keep collectors deterministic. The existing host agent may interpret a separately authorized minimized evidence view; it needs no new model API account. The view and structured proposal are distinct from DCP and consumer read tools. Credentials, whole repositories and complete conversations stay outside that exchange. Concept interpretation may use bounded redacted source excerpts tied to collected references only through a separately authorized first-party owner view; excerpts never enter DCPs or ordinary consumer tools. Every proposal is untrusted and must pass a deterministic admission boundary before storage or projection.
- Preserve provenance and uncertainty when interpreting concepts across technologies. An agent-generated statement is provisional, never an owner declaration or certified mastery. Cross-project transfer retains original scope and limits; it cannot silently promote project Claims to global Claims or weaken attribution ceilings. Core remains a deterministic validator/compiler, not a language model.
- Present the initial overview for review. Later provisional interpretations and explicit conversational declarations use an owner-approved, bounded write workflow with generation checks and verified acknowledgment. A question is not negative evidence; a broad declaration may guide a tentative explanation shortcut without generating verified subskills.
- Keep explanations brief and progressive. Use grounded analogies with transfer limits; introduce unfamiliar concepts when needed. Do not block new technologies or turn uncertainty into an unsolicited tutorial.
- Calibrate with the owner in real tasks before release preparation resumes. Freeze cases, prompt/model/settings, budgets, measures and acceptance criteria before scoring; keep failed attempts and distinguish iterative tuning from evaluation. Compare no profile, a short manual summary and Fork Me Up context. Count setup, scanning, interpretation and packet overhead. Single-owner evidence cannot establish general accuracy or universal client support.

## Compatibility and validation

This is a documentation-only target decision: no code, manifest, schema, fixture, dependency, license or stored data changes. Existing `0.1.0` wire validation, exact current-project intersection, public-only history, process-local cache and fixture hooks remain unchanged. New proposal/source/cache boundaries and any affected wire representations require focused ADRs, schemas, migrations, negative tests and consumer compatibility checks in their implementing slices. No schema extension or privileged model tool is enabled by this decision.

Traceability: FMU-FR-031 through FMU-FR-037; UC-16/17; H-01 through H-06 and H-09/10; new evaluation contracts FMU-E-019 through FMU-E-024. The Roadmap retains completed IDs and inserts these outcomes ahead of the remaining release work. The evaluation specification is [MVP calibration](../evaluations/MVP_CALIBRATION.md); no measurement is claimed here.

For this revision, verify documentation links, incoming anchors, complete-diff consistency, stable IDs and unchanged frozen artifacts. Future runtime slices retain Engineering's executable gates. This planning authorization permits no repository ingestion, model disclosure, external publication or integration; live trials require an explicit source/client scope.
