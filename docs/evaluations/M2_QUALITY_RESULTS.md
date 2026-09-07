# Reproducing the M2 evidence-quality measurement

The [protocol](M2_QUALITY_PROTOCOL.md), [sample](m2-quality-sample.json) and [freeze record](m2-quality-freeze.json) were integrated in PR34 at `3bf29ea6c8ba5671ed673c128acb8d2f8b855db0` before measurement. [ADR-0032](../adr/0032-reproducible-local-quality-measurement.md) defines the evaluator boundary. The [evidence method](../EVIDENCE_METHOD.md) explains the meaning and limits of the results.

## Command

From a checkout with Git history containing that freeze revision, use the pinned Node.js 24.20.0/npm 11.19.0 toolchain:

```text
npm ci --ignore-scripts
npm run measure:m2 -- --output <new-report-path.json>
```

The destination must not exist. The command verifies the frozen bytes and ancestry, creates only new synthetic temporary repositories/Stores, runs all cases and fixed controls, then writes an exclusive bounded report. It returns nonzero on failure. Existing reports are never overwritten. A setup/freeze failure retains only a fixed unavailable status where a new report can be written. No real owner profile, repository selection or adapter cache is used.

Git history is required to establish the freeze-before-measurement boundary; CI checks out full history for that purpose. The report records the actual implementation revision, dirty-worktree status and evaluator hashes. Published baseline reports must come from a clean committed evaluator revision. Dirty local development runs remain useful diagnostics but are identified as such.

## Interpretation

Cases have independent oracle comparisons for schema, source-record completeness, identity association, project scope, expected state and ceilings. Corrupt output tests verify that the evaluator fails rather than merely trusting production validators. Paired checks compare typed observations, and owner exercises require persisted corrections/rejections plus preserved historical provenance. Frozen controls reject both formal skips and diagnostic early returns.

Accepted/corrected/rejected counts are synthetic oracle dispositions. They are not human acceptance rates, measured competence or population accuracy. Unknown attribution is an expected outcome in several cases. Deliberate owner correction operations are reported separately from correction-needed cases.

## Measurement record

The first three standalone runs passed the frozen protocol. The initial run used clean revision `03b21e0469458e811c95c0598a6108dc2f4a8016`; the hardened evaluator ran twice from clean revision `ced1bdfd9002afe10c839705a02a2d49a24b299b`. Those repeated reports were byte-identical, SHA-256 `dbd543ee82173e0c8b80703dc4ea6db75ea0a24aa4a3caccbf5a12ddb49c9c0f`. Exact raw reports are preserved without formatter rewrites:

- [Initial measurement](results/m2-quality-initial.json).
- [Verified repeated measurement](results/m2-quality-verified.json); one artifact represents the two identical standalone outputs before the subprocess-context fix below.
- [Failed nested-control measurement](results/m2-quality-nested-control-failure.json), retained from the full integration suite.
- [Final clean measurement](results/m2-quality-final.json), from revision `747ad89e5a2491332b6a413813108af99590918f` after subprocess isolation. It passed every gate with the outcomes below; SHA-256 `493be6ca4440520a9f954f19201469b5fa30053e8de564bd94b58a82847f1c20`. Behavioral results match the earlier passing reports; revision and evaluator provenance appropriately differ.

| Frozen measure                                                   | Observed outcome                                                      |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| Accepted / corrected / rejected primary cases                    | 48 / 0 / 0                                                            |
| False demonstrated                                               | 0/48 cases; 0/36 demonstrated outputs; 0/12 oracle-insufficient cases |
| Complete matching attribution                                    | 48/48 cases and 52/52 primary Evidence records                        |
| Missing / extra Evidence                                         | 0 / 0                                                                 |
| Unknown attribution                                              | 10/52 records, all expected; 0 unexpected                             |
| Ceiling violations                                               | 0                                                                     |
| Assistance/committer invariances                                 | 10/10                                                                 |
| Owner correction/rejection with refresh and preserved provenance | 2/2                                                                   |
| Frozen security regression controls                              | 23/23 tests; no formal or diagnostic skips                            |
| Per language                                                     | TypeScript 24/24; Python 24/24                                        |

No measured source-rule failure occurred and no frozen input, oracle, threshold, control recipe or production algorithm changed. Independent review improved evaluator failure retention and exception handling after the initial run; the final report includes new evaluator hashes. The first full aggregate also identified two stale policy-test inventories for the newly added command and pinned artifact action. Updating those exact inventories and checking the artifact path/retention fixed the delivery tests without weakening measurement criteria. These were evaluator/delivery corrections, not omitted quality cases.

The next full aggregate exposed an inherited Node `NODE_TEST_CONTEXT` marker: Node skipped the nested frozen-control runner. The evaluator correctly failed, retaining unavailable control counts (`-1`) and a diagnostic-skip flag even though all 48 primary cases passed. Commit `798ef42` isolates the control subprocess environment and adds a regression. The subsequent complete aggregate passed: 250 unit tests, all schema corpora, 59 integration tests (including the full measurement) and 19 behavioral evaluations. The failed report remains part of the record; neither the frozen controls nor their pass criteria changed.

Reproduction used Windows x64, Node.js 24.20.0, npm 11.19.0 and Git 2.55.0.windows.5, with an offline lockfile-enforced clean install. Point-in-time dependency audit reported zero vulnerabilities. CI evidence and integration status are recorded in the roadmap and the [machine handoff](../handoffs/M2_NEXT_MACHINE.md).

The passing rates describe only these constructed cases. No real developer study, independent comprehension labels or population confidence interval is claimed. M2-S16 remains responsible for the complete milestone exit audit.
