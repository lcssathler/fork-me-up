# ADR-0040: Reproducible public Community benchmark

- Status: Accepted
- Date: 2026-09-09

## Context and task contract

M3-S06 is integrated on `main` at `5a4b109`, making M3-S07 the earliest eligible unclaimed slice. The public Community benchmark must join evidence-quality outcomes, repeated task calibration, minimized disclosure cost and two-consumer policy behavior without converting constructed conformance into a study of people or model-authored answers.

Traceability is M3-S07; hypotheses H-02 through H-04 and H-06; Community-relevant `FMU-E-001` through `FMU-E-016`; the M3 public-benchmark deliverable; ADR-0013/0015/0017/0031/0032/0036. The observable result is one pinned offline command that reruns the frozen M2 evidence-quality experiment, compiles three existing public synthetic profile fixtures into task DCPs, repeats both consumer projections three times and writes an exclusive minimized report.

Scope is an internal benchmark runner, independent scorer regressions, a subprocess integration test, documentation and synthetic result evidence. No schema, package export, runtime behavior, dependency, source permission, network request, private data, model call, human study, publication or release is added. Public wire compatibility and stored data remain unchanged; no migration applies. Required checks are scorer corruption tests, exact repeated outputs, immutability, canary/disclosure bounds, report non-overwrite, the pinned aggregate, clean-checkout reproduction and documentation audit. Stop on a need for private data, a new human interpretation, a changed M2 oracle or a broader compatibility claim.

## Decision

- Reuse the accepted, hash-verified `m2-quality-0.2.0` experiment for false-Claim and attribution outcomes. M3 neither edits its cases nor reinterprets its categorical outputs.
- Use the existing demonstrated Java, adjacent React and insufficient CI fixtures as scenario-owned oracles for `FMU-E-001` through `FMU-E-004`, with `FMU-E-016` traced through every consumer pair. Each scenario fixes the expected Claim state, observed depth and complete closed Response Policy independently of either consumer.
- Compile one local, purpose-bound DCP per scenario through current Core. Invoke the Codex structured mapper and fixed renderer plus the independent generic consumer three times each. Every run must match its oracle, both structured meanings must match, all repeats must be byte-stable and inputs must remain unchanged.
- Measure compact UTF-8 bytes for the complete portable fixture, DCP, Codex guidance and generic result. Report the compiler's conservative one-token-per-DCP-byte upper bound. Count full-profile Claims/Evidence, disclosed Claims, zero disclosed Evidence records and any opaque Evidence references.
- Present repeated cost as three repetitions of the measured payloads, not as avoided conversational tokens or time. Report every scenario independently: a minimal profile can be smaller than its DCP, so only observed values and the aggregate difference may be stated.
- Emit only fixed scenario IDs, counts, ratios, toolchain/revision provenance and bounded outcomes. The report excludes task/profile text, source paths, subjects, repositories, raw Evidence and native diagnostics, never overwrites an existing path and fails if any required case is missing.
- State the benchmark limit in the report itself: it does not measure human accuracy, response quality, population performance, time saved, seniority or ranking. Two-consumer equivalence covers only structured Claim/Response Policy meaning for the tested Codex and generic paths.

## Consequences and rejected alternatives

The benchmark makes the Community claim inspectable with current code and no hosted service. It also exposes counterexamples to simplistic token-saving claims while verifying that minimized task disclosure removes complete Evidence records and irrelevant Claims.

Inventing conversational baselines, treating bytes as model tokenizer counts, replaying the same consumer implementation twice, scoring consumers only against one another, changing the frozen M2 oracle after seeing results, calling expected unknown attribution an error, or ranking developers/clients are rejected. Real usefulness, onboarding turns, comprehension, latency and population calibration require separately designed consented studies and remain unmeasured.

## Validation

The documented `npm run measure:m3 -- --output <new-report-path.json>` command must run from a full-history checkout with the pinned toolchain. Unit tests deliberately introduce a shared wrong policy, consumer divergence, privileged authority, disclosure canaries, missing guidance and invalid expiry so parity alone cannot pass. Integration reruns the real evidence protocol and both consumers, verifies exact denominators and limits, and proves exclusive report creation. The complete aggregate and protected CI remain required before integration.

The clean local report from implementation revision `ad1159f` passed 9/9 stable consumer pairs, 18/18 policy runs, 9/9 structured equivalence pairs and all 48 frozen evidence cases. It measured 3,676 aggregate DCP bytes against 5,145 portable-profile Export bytes while retaining one larger-DCP counterexample, zero complete Evidence records in every packet, zero false `demonstrated` outcomes and 10/52 expected unknown attributions. The report and protocol retain all interpretation limits. Complete aggregate, review and protected CI remain pending before integration.
