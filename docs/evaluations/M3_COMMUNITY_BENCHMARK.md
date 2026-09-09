# M3 public Community benchmark

This benchmark is a reproducible synthetic conformance report for the public Community boundaries. It operationalizes a limited part of hypotheses H-02 through H-04 and H-06; it is not a study of developers or generated answers. [ADR-0040](../adr/0040-reproducible-public-community-benchmark.md) owns the measurement decision, while the [M2 frozen protocol](M2_QUALITY_PROTOCOL.md) continues to own its evidence cases and oracle.

## Reproduce

Use a full-history checkout with Node.js 24.20.0 and npm 11.19.0:

```text
npm ci --ignore-scripts
npm run measure:m3 -- --output <new-report-path.json>
```

The destination must not exist. The command uses no account, network, private profile, model or live repository. It verifies and reruns the integrated `m2-quality-0.2.0` freeze, then executes current Core, Codex and generic-consumer code over existing public synthetic fixtures. A report records the current revision and whether the worktree was dirty; a published baseline must come from a clean committed implementation revision.

## Frozen meaning and measured scenarios

The benchmark adds no learned threshold. Its consumer oracles are the previously accepted Claim-state and Response Policy behavior:

| Scenario | Evaluation trace | Required Claim | Required policy |
|---|---|---|---|
| Demonstrated Java | `FMU-E-001`, `FMU-E-016` | `language.java`, `demonstrated`, `practical-use` | `concise` |
| Adjacent React | `FMU-E-003`, `FMU-E-016` | `framework.react`, `adjacent`, unobserved; Angular remains only the analogy | `analogy` with `framework.angular` |
| Insufficient CI | `FMU-E-002`, `FMU-E-004`, `FMU-E-016` | `delivery.ci.github-actions`, `insufficient-evidence`, unobserved | `teach-while-doing` with all safety guidance and one-question budget |

Each compiled DCP is projected three times through both consumers. A scenario passes only when every consumer independently matches the scenario oracle, both structured projections retain the same meaning, all repetitions are stable, the Codex fixed rendering retains its required policy/permission boundary, the generic result grants no authority and neither consumer reveals profile/source identifiers or free-text rationale.

## Cost and disclosure accounting

The report measures exact compact UTF-8 bytes for the complete portable-profile fixture, DCP, Codex guidance and generic structured result. `dcpTokenUpperBound` repeats the compiler's portable conservative accounting of one token per DCP byte; it is not a model tokenizer measurement. It also reports complete-profile versus DCP Claim counts, complete Evidence records versus the required zero disclosed Evidence records, and opaque Evidence-reference counts.

Repeated cost is simple multiplication across the three fixed repetitions. It is not an estimate of turns, latency, typing, comprehension, usefulness or money saved. Every scenario remains visible because a small insufficient-evidence profile may be smaller than its valid task DCP even when the aggregate benchmark is smaller.

## False Claims and attribution

The command reruns all 48 constructed M2 cases rather than copying a prior summary. It reports accepted/corrected/rejected outcomes, false `demonstrated` denominators, exact frozen-oracle attribution, expected unknown attribution and ceiling violations. Expected unknown authorship is retained as a limit, not converted into negative evidence. The M2 protocol still forbids using these cases as population accuracy, proof of knowledge or proof of unaided authorship.

## What a pass means

A pass establishes only that these checked-in synthetic inputs reproduce the accepted evidence rules, disclosure accounting and structured behavior for the tested Codex and generic consumers without a Core fork or hosted dependency. It does not establish human accuracy, model-response quality, population calibration, real-world usefulness, time saved, seniority, employability, rankings, support for other clients or released package compatibility.

## Measurement record

The [clean result](results/m3-community-benchmark.json) was produced from committed implementation revision `ad1159f474b7fde98de0ac240d8dbd3047189583`; it records `worktreeDirty: false` and passed. Its exact SHA-256 is `44c8b31302ef88f5bb8578b386d61d00e8c27e3616424c8342eeb7cdea874dda`.

| Measure | Observed result |
|---|---:|
| Repeated consumer pairs stable | 9/9 |
| Policy-adherent consumer runs | 18/18 |
| Cross-consumer structured meaning | 9/9 |
| Portable-profile Export bytes, one pass | 5,145 |
| DCP bytes/token upper bound, one pass | 3,676 |
| Aggregate DCP/export ratio | 71.45% |
| Three-repeat portable-profile Export / DCP bytes | 15,435 / 11,028 |
| Frozen evidence cases accepted | 48/48 |
| False `demonstrated` outcomes | 0/48; 0/36 demonstrated outputs; 0/12 insufficient-evidence oracles |
| Exact frozen-oracle attribution | 52/52 Evidence records |
| Expected unknown attribution retained | 10/52 Evidence records |

The per-scenario report is material to interpretation. Demonstrated Java measured 1,729 Export bytes versus 1,097 DCP bytes; adjacent React measured 2,342 versus 1,353; insufficient CI measured 1,074 versus 1,226. The last case is a counterexample to any claim that a DCP is always smaller than a minimal profile fixture. Across all three constructed cases the task projection was smaller, and every DCP disclosed zero complete Evidence records.
