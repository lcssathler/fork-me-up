# Usable MVP evaluation contract

Status: planned; no live result is recorded. This contract adds coverage for the [product requirements](../PROJECT_SPEC.md) without changing the frozen M2 or M3 benchmarks.

## Required coverage

| ID | Observable outcome | Failure that must remain visible |
|---|---|---|
| FMU-E-019 | Guided setup and real Store-backed context in the first tested client; inspect, correct, restart and reuse. | Fixture context, missing tool invocation, false saved acknowledgment or broken ordinary work. |
| FMU-E-020 | Catalog and selected public/private GitHub reads respect separate permissions and fixed work budgets. | Reading excluded repositories, treating metadata as expertise, unbounded account scanning or credential disclosure. |
| FMU-E-021 | Persistent reuse checks permission, source changes, identity, versions and age; deletion prevents reuse. | Warm-cache authority bypass, silent freshness renewal, lost corrections or source deletion. |
| FMU-E-022 | Agent interpretations use resolvable evidence and preserve scoped transfer, uncertainty and owner precedence. | Invented evidence, raw excerpts in DCPs, global promotion, policy injection, inferred subskill mastery or treating a question as ignorance. |
| FMU-E-023 | Live explanations use relevant analogies with limits and introduce concepts progressively. | Unsupported familiarity, excessive tutorial detours, unnecessary blocking or omitted safety guidance. |
| FMU-E-024 | Owner tasks show an acceptable benefit after counting the complete context and setup cost. | Conformance or payload-size arithmetic substituted for response usefulness or token savings. |

FMU-E-019 through FMU-E-022 need synthetic boundary tests in their implementing slices. FMU-E-023/024 additionally require owner-reviewed live evidence; deterministic response templates alone cannot pass them. Prior FMU-E-001 through FMU-E-018 retain their original meaning and applicable coverage.

## Before live measurement

Freeze a short brief naming the owner, authorized repositories and client, permitted model disclosure, task sample, tuning/evaluation split, prompt version, model/settings, total work limits, measures and pass/stop thresholds. Missing scope or thresholds blocks measurement, not synthetic implementation. The first study is owner-led; its sample does not represent other users or agents.

Include existing-project explanation, cross-project analogy and unfamiliar-concept introduction, with a restart and explicit correction. Use fresh conversations, comparable tasks and controlled prior context. Compare no profile, a short manual summary and Fork Me Up context; vary order or use matched tasks to limit learning effects.

Record comprehension feedback, necessary follow-up questions, task detours, unsafe omissions, corrections, setup effort, elapsed work, requests/bytes scanned and actual interpretation/packet/response token usage when available. Unavailable tokenizer or billing data stays unavailable; bytes are not measured token savings.

Tune with the owner, version every prompt change and rerun affected cases. Do not overwrite failed trials or tune against a supposedly held-out result. Require owner acceptance of the frozen criteria before reporting the usable-MVP gate passed. A failure routes to the affected implementation slice; publication stays blocked.

## Evidence handling

Keep real profiles, repository identities, transcripts and raw responses outside the repository in an explicitly selected private location with agreed retention/deletion. Commit only an owner-approved, minimized result with opaque case IDs, versions, measured counts, failures and limits. Use synthetic fixtures for reproducible public regressions. No real private data enters tests, CI artifacts or snapshots.
