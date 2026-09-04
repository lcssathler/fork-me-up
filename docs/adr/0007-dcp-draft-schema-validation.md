# ADR-0007: First DCP draft schema and offline fixture validation

- Status: Accepted
- Date: 2026-09-04

## Context and task contract

M0-S07 is integrated at `f98a049` with successful pull-request and post-merge CI. M0-S08 is the next eligible slice. It must produce one versioned DCP draft, synthetic positive and negative fixtures, and an executable local/CI check without implementing the M1 runtime or the independent contracts of M0-S09 through M0-S12.

Traceability: `M0-S08`, `FMU-FR-009`, `FMU-NFR-009`, `FMU-NFR-011`, PROTOCOL Sections 3–7 and 12–13, SECURITY_PRIVACY T-01/T-04/T-11/T-12, and ADR-0002/0005/0006. No behavioral `FMU-E-*` evaluation applies to this development-only schema slice; schema/security regression tests are not evidence of M1 behavior, MCP integration, or provider/consumer conformance.

The observable result is that `npm run schema:check` accepts the committed positive fixtures, rejects the negative fixtures, and fails on missing or unexpected fixture results. `npm run check` and the existing Windows CI execute it. In scope are one DCP schema, synthetic fixtures, development validation scripts and tests, exact development dependency/lockfile changes, and synchronized documentation. No private data, analyzed repository, external service, production dependency, product package, runtime, adapter, or remote setting is in scope. Local edits, installation from the reviewed lockfile, tests, and a reviewable local commit are allowed. Stop on a conflicting public contract, unresolved high-severity dependency finding, or a need for external authorization.

## Decision

- Use a self-contained JSON Schema draft 2020-12 at `schemas/dcp/0.1.0.schema.json`, identified by `urn:fork-me-up:dcp:0.1.0`. The packet declares `schemaVersion: "0.1.0"`; this is an unreleased draft, not a release or compatibility claim. Existing `0.1` examples become `0.1.0`; no released data needs migration.
- Validate the exact producer/fixture shape with closed objects. Unknown fields and other draft versions fail this authoring check. This is not the future consumer acceptance path: released consumers must preserve PROTOCOL Section 12's unknown-optional-field and major-version rules. Consumer negotiation/conformance remains M0-S12.
- Inline compact claim summaries in this schema only. They do not define the independent Evidence or Claim contracts of M0-S09. Adjacent summaries include a source capability and bounded rationale; disputed summaries include a correction reference and summary while preserving evidence references.
- Retain the draft packet fields and add an explicit `budget.maxBytes`. Bound identifiers, text, arrays, question count, and budget. The development validator also checks compact JSON UTF-8 size including the budget itself and requires expiry after generation. It never truncates a packet, compiles task context, or uses the wall clock; stale or historically dated packets can be structurally valid.
- Use Ajv `8.20.0` as an exact development dependency, with draft 2020-12, strict schema validation, one-error validation, and no type coercion, defaults, or property removal. No production dependency or dedicated format package is added. A small canonical UTC date-time format checks calendar validity; the draft deliberately uses whole seconds and `Z`.
- Compile only the committed schema synchronously, with no schema download, async loading, or user-supplied schema. The fixture runner has fixed repository-relative directories, bounded regular-file reads, no symlink traversal, no recursion, and bounded fixture counts. Diagnostics contain only fixed categories and counts, never Ajv errors, input fragments, paths, or arbitrary filenames.
- Structural validity does not prove redaction, authorization, task relevance, attribution, correction precedence, pairwise identifiers, or safe behavior by a consumer. Free text stays unprivileged data. Runtime enforcement and its adversarial evaluations remain required by their existing gates.

## Consequences and alternatives

A portable schema becomes reviewable before runtime code exists. Development checks add a small dependency graph and explicit schema semantics; exact draft changes require fixtures and documentation together. Generated product types are deferred until a producer/consumer package needs them, rather than creating an unused parallel representation.

A handwritten JSON Schema interpreter is rejected because it would create a second, incomplete standards implementation. ESLint's transitive Ajv v6 is not an owned dependency and does not supply the chosen dialect. A general user-input CLI, network schema loader, broad redaction engine, full Claim model, and MCP server are outside this slice.

## Validation

Run the pinned Node.js/npm clean-install path and the complete aggregate on Windows. Cover valid states, invalid/missing fields, unsupported versions, unknown fields, safe enums, missing evidence/rationale/correction summaries, canonical dates and ordering, array/text/byte limits, malformed fixture input, missing fixtures, symlink rejection, non-mutation, and canary-safe diagnostics. Review schema and dependency diffs, synchronize the protocol example, and verify local documentation links. CI for the reviewed revision must pass before integration; only integrated transitions make the next slice eligible.

## Development dependency review

Ajv `8.20.0` is MIT-licensed, maintained upstream, and explicitly supports Node.js 24. Its resolved runtime transitives are `fast-deep-equal 3.1.3` (MIT), `fast-uri 3.1.7` (BSD-3-Clause), `json-schema-traverse 1.0.0` (MIT), and `require-from-string 2.0.2` (MIT); none has further runtime dependencies or preinstall/install/postinstall hooks. Source-development build scripts are not executed: lifecycle scripts remain disabled. The lockfile preserves ESLint's independent Ajv v6 dependency. The live npm audit of this resolved development graph on September 4, 2026 reported zero vulnerabilities; it is a point-in-time check, not a permanent assurance or part of the deterministic aggregate. No product bundle/startup cost is introduced; removing these scripts and the direct development dependency removes the added tooling surface.

Review sources: [npm package metadata](https://registry.npmjs.org/ajv/8.20.0), [upstream releases](https://github.com/ajv-validator/ajv/releases), [dialect support](https://ajv.js.org/json-schema.html), [validator security](https://ajv.js.org/security.html), and [validation options](https://ajv.js.org/options.html).
