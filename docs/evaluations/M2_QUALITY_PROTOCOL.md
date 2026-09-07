# M2 frozen evidence-quality protocol

Version: `m2-quality-0.2.0`. Decision date: September 7, 2026. Status: frozen before measurement. Decision owner: repository owner; technical selection delegated explicitly to the implementing agent after research. [ADR-0031](../adr/0031-evidence-method-and-frozen-quality-protocol.md) records authority and scope. [Evidence method](../EVIDENCE_METHOD.md) records the research rationale and interpretation limits.

## Question and decision

Does the real bounded filesystem/Git/authorship/risk/derivation pipeline conform to the specified project-evidence rules, preserve human participation in assisted workflows, and retain owner control? This experiment does not estimate a person's understanding, detect AI, or measure population accuracy. No private repository, real identity, training dataset, human participant or model API is involved.

The exact sample is [m2-quality-sample.json](m2-quality-sample.json): 48 cases, 24 scenario families in TypeScript and Python, 52 expected primary source Evidence records and ten paired invariance checks. The sample size is a coverage decision, not a statistical power calculation. Repeated language variants are related cases, not independent people. Labels derive from the documented normative rules and are reviewed before measurement; this tests implementation fidelity, not independent validity of those rules as knowledge measures.

The [freeze record](m2-quality-freeze.json) contains raw-byte SHA-256 hashes for the sample, this protocol, research method, decision ADR and existing security-control files/helpers. Raw bytes include UTF-8 whitespace and final newlines. Its integrated M2-S14 commit must precede the first measurement; the report records that commit and the measured implementation revision separately. No pipeline has run on this sample in M2-S14.

## Scenarios and oracle

Every row runs once per language. Exact contents, identities, roles, committer, messages, annotations, source state and expected Evidence count are in the manifest.

| Scenario | Required state | Depth/confidence ceilings | Evidence authorship |
|---|---|---|---|
| direct-single | demonstrated | exposure / medium | attributed |
| direct-repeated | demonstrated | practical-use / medium | attributed |
| coauthor, pair-work | demonstrated | exposure / low | coauthored |
| squash | demonstrated | exposure / low | attributed |
| bot | insufficient-evidence | none / low | bot |
| shared, unknown, uncommitted | insufficient-evidence | none / low | unknown |
| fork, template, generated, vendored, tutorial, duplicated, uncertain | demonstrated | exposure / low | attributed |
| ai-assisted-single, human-claimed-single | demonstrated | exposure / medium | attributed |
| ai-assisted-repeated | demonstrated | practical-use / medium | attributed |
| ai-claimed-unknown, committer-only | insufficient-evidence | none / low | unknown |
| bot-with-human, human-with-bot | demonstrated | exposure / low | coauthored |
| human-bot-committer | demonstrated | exposure / medium | attributed |

Assistance/handwritten text is deliberately untrusted source commentary, not evidence that assistance or understanding actually occurred. These cases test that narrative alone cannot change claim support. `generated` tests a path indicator on a hand-constructed fixture, not a detector's accuracy about origin. Ordinary paths do not prove human origin. The same observable inputs would require the same output if an evaluator described their creation differently.

Require exactly one Claim per selected project/capability, with exact assessment state. Depth/confidence are ceilings: schema-valid conservative levels below them pass and are reported, with missing Claims always failing. No high-confidence or demonstrated-depth output passes. Each primary file must have exactly one Evidence record with expected authorship and subject association (`subject_quality` for attributed/coauthored, null for bot/unknown). Missing, extra, duplicate or mismatched primary records fail the case; empty output cannot improve accuracy. README is not capability Evidence.

Duplicate scenarios collect both repositories together before risk classification. The peer's one same-capability Claim and corresponding Evidence are legitimate auxiliary output, excluded from the 48-primary-case/52-record denominator. Unexpected capabilities or projects outside this recipe are rejected. Peer records must not enter a primary-project DCP. Ten `invariances` pairs compare primary state, depth, confidence, scope and authorship multisets, not content-derived IDs or Git hashes. In particular, changing commentary and adding a bot committer must preserve those fields. Collaboration involving coauthor trailers is separately assessed under the ordinary collaboration limits.

## Exact repository recipe

For each case create a new temporary authorized directory, one primary repository and a peer only when `duplicatePeer` is true. Use only literal manifest relative paths; validate them before writes. Initialize Git with empty template/hooks, SHA-1 objects, branch main, autocrlf false, commit signing false, verbatim commit cleanup and no external Git config. Clear inherited Git environment controls; use argument-array subprocesses with bounded time/output and hidden Windows windows. Pin author/committer identity and both UTC dates from the manifest. Preserve exact LF source bytes.

Commit only `initialReadme` first, with `fixed.initialCommitMessage`. Then write all `files`; commit them together using `commitMessage` unless `sourceCommitted` is false, in which case leave them untracked. Identity annotations `pair-work`/`squash` refer to the resulting source commit object ID and repository, not paths or prose. Repository risk flags refer to the selected repository. A duplicate peer is independently initialized with the same files, README, identity, dates and history recipe, fixed peer IDs and no annotations/risk flags. No clone or remote is used.

Resolve the exact authorized-root limits, explicit identity mapping and risk configuration through the production boundaries. Collect real filesystem/Git snapshots, assess identity, classify the complete selected set, then derive with initial `sourceObservedAt` and `derivedAt` both equal to `fixed.observedAt`, and `staleBefore` equal to the manifest threshold, plus complete project mapping. Do not substitute mock collector results. Source collection time is not a provenance label; inject all derivation/Store/Provider times. Any setup, collection, schema, projection or cleanup failure is reported as failure, not skipped or omitted. Delete only this run's verified temporary root; never operate on the real adapter cache.

## Scoring and gates

| Metric | Denominator/report | Gate |
|---|---|---|
| False demonstrated | Count, fraction of actual demonstrated primary outputs, fraction of oracle-insufficient cases and all 48 cases | 0 |
| Correction-needed | Cases missing expected output or needing state, ceiling, scope or attribution correction; includes rejected cases; denominator 48 | 0 |
| Rejected | False demonstrated or spurious capability/project output; denominator 48 | 0 |
| Attribution correctness | Complete matching cases / 48 and matching expected primary records / 52; report missing/extra records explicitly | 48/48 cases, 52/52 records |
| Unknown attribution | Unknown actual primary Evidence / actual primary Evidence; expected versus unexpected unknown separately | Report; any unexpected/missing authorship fails correctness |
| Ceiling violations | All selected output Claims checked against scenario ceilings | 0 |
| Invariance | Passing frozen primary-output pairs / 10 | 10/10 |
| Security controls and owner exercises | Separate individual check results, never mixed into quality case denominators | All pass; no skips |

Accepted, corrected and rejected are exclusive case outcomes; correction-needed includes corrected plus rejected. These are oracle-based dispositions, not observed human approval rates. Dispute/rejection operations are reported separately below. A zero denominator produces null/unavailable, not a fabricated zero. A stage error retains its case with a fixed failure reason and fails the overall gate. No fallback to a smaller sample. Report per-language and per-scenario outcomes and all numerators/denominators. Do not attach binomial confidence intervals or extrapolate population accuracy to this constructed sample.

The zero tolerances are deliberate project decisions under the owner's delegation, not values prescribed by a paper. In a deterministic controlled experiment every discrepancy is actionable. All previously discussed 32-case sample and 10% correction/5% rejection/95% authorship proposals are superseded before measurement.

## Owner, disclosure and authority controls

Use exactly `typescript-direct-single` and `python-direct-single`. Persist initial derivation at `2026-09-07T12:00:00Z`, correct the primary Claim with summary `Synthetic owner correction.` at `12:01:00Z`, reload, derive/refresh unchanged sources and persist at `12:02:00Z`, reload, reject the effective Claim with summary `Synthetic owner rejection.` at `12:03:00Z`, refresh/persist at `12:04:00Z`, reload. Use full canonical UTC timestamps and current observed Store generation. `correct` has no depth/confidence inputs: verify disputed/low state with original depth retained, correction history and original Evidence preserved. Rejected knowledge must not appear as demonstrated or as archived original Claims in primary task context; an effective disputed warning is permitted. Missing initial Claims or failed writes fail; do not select replacement cases. These intentional operations do not enter correction-needed rates.

For each owner refresh, rederive from the same authentic initially collected risk snapshot with its unchanged `sourceObservedAt` (`12:00:00Z`) and `staleBefore`, using `derivedAt` equal to that refresh's `12:02:00Z` or `12:04:00Z` save time and the preceding authentic derivation as prior. This exercises correction composition without pretending the unchanged source was recollected or renewing its observation age.

For every case persist into its isolated Store and compile primary-project task context through the real Store-backed Provider with explicit capability and sufficient fixed bounds. Invoke owner doctor/evidence diagnostics. Scan serialized public Provider/DCP/normal diagnostic output and captured stdout/stderr for manifest source canaries, names/emails, commit prose and actual absolute temporary paths. Authorized private source snapshots/Store records are outside that public-output scan. Published reports contain only safe case IDs, enumerated states/counts and fixed failure codes; no raw source, paths, identities or native error text.

Use Provider schema `0.1.0`, kind `profile-provider-request`, request ID `request_quality`, operation `get-task-context`, and input `{task: "Explain this project language.", purpose: "coding-assistance", maxTokens: 8192, requestedCapabilities: [case.capability]}`. Provider options bind the fixed primary repository/project, no source callback (explicit capabilities support the restart path), `maxObservationAgeMs: 86400000`, and IDs `demand_quality`/`packet_quality`. Clock is `2026-09-07T12:00:01Z` initially and one second after each persisted owner-exercise step when checking its packet. The existing Provider fixes its output ceiling at 32768 bytes. Doctor uses version `0.1.0`, the same clock timestamp, the returned packet, `maxContextBytes: 32768`, and `maxContextTokens: 8192`; evidence lookup uses version `0.1.0`, the case capability and `limit: 8`. Use default diagnostic options so these case checks do not probe a real adapter cache; installation/cache controls are covered by the separately frozen isolated CLI tests. All case Store IDs are `store_quality`, isolated by distinct directories and the fixed subject.

Run every assertion of the five manifest `controls` at baseline `0c882e73d282c35bd70b7faec57612be1069463d`, with their fixture/helper recipes pinned by the freeze record. These cover ignored/outside-path canaries, actual link rejection, hostile Git execution sentinels, secret-like private limitations and CLI/MCP output. Controls run against the measured runtime, without weakening their frozen inputs/assertions. No skip passes the gate. They are bounded regression evidence, not universal proof about disclosure or execution. Additional current tests may strengthen this coverage but cannot replace frozen failed controls.

Reject both formal test skips and diagnostic messages indicating a skipped assertion (the Git link control can return after such a diagnostic while the test itself reports pass). A green test count alone is insufficient evidence for this control gate.

The frozen existing controls retain their original isolated fixture/mocked dependency arrangements where present. The no-mock source pipeline requirement applies to all 48 quality cases; it does not misrepresent every older regression control as an end-to-end source measurement.

## Reproduction and failure retention

M2-S15 adds a documented command to produce a minimized machine-readable report with experiment version, sample/freeze hashes, freeze commit, implementation revision, toolchain/platform, actual counts, case outcomes, invariances, owner/security checks and overall pass/fail. Runtime errors are content-free. Validate the evaluator with deliberately faulty synthetic outputs so constant-pass scoring cannot close the gate. Reproduce the same minimized case results on a second run; do not claim deterministic Git hashes across unspecified toolchains.

Retain the first failed report before any implementation correction. Fix an actual defect in an isolated commit, rerun the same frozen sample and retain both revisions' results. Do not change labels, thresholds, denominators or input recipes after observing outcomes. An invalid experimental definition requires a separately documented new version/decision with the prior result retained; it cannot be called an implementation fix. M2-S16 audits every other milestone gate separately.
