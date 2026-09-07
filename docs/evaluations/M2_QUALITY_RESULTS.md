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

Results are recorded after executing the committed evaluator. No pass result is asserted by the evaluator implementation itself.
