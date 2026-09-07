# What repository evidence can tell Fork Me Up

> Core method and research decision, September 7, 2026. Audience: owners, contributors and consumers. Read with [ADR-0031](adr/0031-evidence-method-and-frozen-quality-protocol.md) and the [frozen quality protocol](evaluations/M2_QUALITY_PROTOCOL.md).

Fork Me Up records bounded evidence for task calibration. It does not measure a person's knowledge or determine who typed their code. AI-assisted development is compatible with useful participation evidence. The Community implementation uses explicit deterministic rules, not KNN, a trained classifier, a language model or an AI-code detector.

This distinction is central to the product: a contribution associated with a developer, the process that produced an artifact, and the developer's understanding are three different questions. None automatically answers the others. The owner can inspect and correct the resulting claims; consumers receive only a limited task projection.

## The observable inputs and their limits

| Input | Current operation | Permitted interpretation | What it does not establish |
|---|---|---|---|
| Source-language metadata | Normalize supported source extensions | A selected project contains source associated with that language | Correctness, meaningful complexity, framework knowledge or comprehension |
| Git author and explicit identity mapping | Match normalized configured identity digests | A bounded change record is associated with that identity | Independent identity verification, who typed each line, review quality or unaided ability |
| Coauthor/pair annotation | Preserve recognized collaboration | Recorded participation, with limited individual attribution | Percentage of effort or understanding |
| Bot author/committer | Preserve explicit roles separately | Bot-only activity is not attributed to the person; recognized human participation survives bot involvement | That every bot was identified or that AI assistance implies incompetence |
| Generated/vendor/tutorial path or explicit annotation | Reduce support and preserve limitations | A possible artifact/provenance risk under a fixed indicator | AI detection, proven machine origin, plagiarism or a judgment of the developer |
| Equal content digest | Detect exact duplication among selected files | Those selected contents match | Direction of copying, intent, author, or AI use |
| Repeated eligible observations | Aggregate within the same project and language | Repeated selected source evidence under a documented heuristic | Independent mastery observations or a statistically calibrated level of skill |

The actual rules are in [authorship assessment](../packages/community-provider/src/git-authorship-assessment.ts), [source-risk classification](../packages/community-provider/src/evidence-source-risk-classifier.ts) and [claim derivation](../packages/community-provider/src/evidence-claim-derivation.ts). They are explained in ADR-0021/0022/0024. Collection does not execute project code, so it also cannot verify that its tests pass or that a claimed design decision was understood.

## How modern assisted development is treated

`generated` identifies a conservative artifact indicator, such as a build/minified/generated-style path or an owner annotation. A person can write a file under such a path; a model can produce a file under an ordinary path. The indicator may therefore be useful while its implication about actual origin is wrong. Path-derived cases retain `path-indicator-only`; unflagged cases retain `origin-unverified`. Neither is a human-versus-AI verdict. These limitations belong to the interpretation of every derived claim even when output budgets omit some individual limitation strings.

AI assistance alone neither removes recognized participation nor supplies missing participation. An attributed human author with a bot committer remains attributed. Explicit coauthors, including bots, follow the same collaboration ceiling; the ceiling limits individual evidential support, not personal ability. A bot author with a recognized developer coauthor retains coauthored participation. An unknown author is not promoted just because a comment says a human reviewed the code. Source comments and arbitrary commit prose do not declare capability or set policy.

The wire label `demonstrated` must be read together with scope, depth, confidence and limitations. At exposure it means selected attributable evidence supports only a limited observation; it does not assert mastery. Two distinct moderate attributable observations whose upstream limits permit practical use may reach `practical-use`/`medium`. **The two-observation threshold is an operational heuristic, not a research-validated expertise threshold.** All automated Community claims stay project-scoped, never exceed medium confidence and never produce `demonstrated-depth`. Categorical confidence is not a probability.

## Research findings and decision evidence

The following claim-to-source ledger separates source findings from their application here. Sources were accessed September 7, 2026; live documentation is identified as such. Research papers were consulted as evidence, not installed or used as datasets.

| Source, publisher and date | Supported finding and scope | Consequence for this design |
|---|---|---|
| [Git: git-commit](https://git-scm.com/docs/git-commit), Git project, live documentation | Author and committer metadata can be supplied through configuration/environment and author overrides. | Treat matching as a configured metadata association, not authentication or comprehension evidence. |
| [Creating a commit with multiple authors](https://docs.github.com/en/pull-requests/how-tos/commit-changes/creating-a-commit-with-multiple-authors), GitHub, live documentation | Coauthor trailers supply name/email attribution for contributions. They do not quantify effort. | Preserve collaboration without deriving an individual's share or expertise. |
| [Linguist overrides](https://github.com/github-linguist/linguist/blob/main/docs/overrides.md), GitHub Linguist, live documentation | Generated/vendored classifications affect repository statistics and presentation; explicit overrides exist. | Artifact classification is a different task from detecting AI or assessing a person. We do not claim to implement Linguist or its overrides. |
| [Towards a Theory of Software Development Expertise](https://arxiv.org/abs/1807.06087), Baltes and Diehl, ESEC/FSE 2018 | A mixed-method study of 335 developers treats expertise as contextual and distinguishes experience from expertise. | Repository activity alone is an inadequate basis for a general knowledge scale. The paper does not validate our specific rules. |
| [Is this Snippet Written by ChatGPT?](https://arxiv.org/abs/2307.09381), Nguyen et al., 2023 preprint | GPTSniffer detects generated snippets in studied conditions; similarity to training data and paired context help. | Detection is not universally impossible, but success on a narrow task does not establish provenance in mixed human/agent repositories. |
| [How Far Are We?](https://arxiv.org/html/2411.04299v1), Suh et al., November 6, 2024 preprint / ICSE 2025 | Tested detectors have generalization problems across languages, tasks and generators; the proposed best model reports F1 82.55 in its experiment. | Do not reuse that score as our accuracy or introduce a detector without target-specific evidence. It does not prove every future detector fails. |
| [CodeMirage](https://arxiv.org/html/2506.11059v1), Guo et al., 2025 preprint | Detection is sensitive to distribution shift and paraphrasing; the benchmark's fully generated files leave mixed human/AI completions outside its validated scope. | Current detector evidence does not justify a binary provenance verdict for everyday assisted work. |
| [How AI assistance impacts the formation of coding skills](https://www.anthropic.com/research/AI-assistance-coding-skills), Shen and Tamkin, Anthropic, January 29, 2026 | A small randomized study learning Trio found lower immediate quiz scores in the assisted group; some observed interaction patterns accompanied good understanding. | AI use alone does not determine individual understanding. The task, population and immediate quiz limit generalization; qualitative interaction patterns are not separate causal findings. |
| [Beyond Accuracy: Behavioral Testing with CheckList](https://aclanthology.org/2020.acl-main.442/), Ribeiro et al., ACL, July 2020 | Behavioral testing combines minimum-functionality, invariance and directional checks to expose errors missed by aggregate accuracy. | We adapt the testing pattern to deterministic evidence rules; the paper does not validate Fork Me Up's taxonomy or thresholds. |
| [AI RMF 1.0](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf), NIST, January 2023, Sections 3.1 and MEASURE 2 | Evaluation should document its test sets, metrics, operating conditions and limits of generalization. | Publish exact sample, oracle, failure counts and limits. This is methodological guidance, not a certification of compliance. |
| [Testing a proportion of defectives](https://www.itl.nist.gov/div898/handbook/prc/section2/prc24.htm), NIST/SEMATECH handbook, live reference | Population proportion tests assume a sampling model, including random sampling and distribution conditions. | Our deliberately constructed, related cases do not justify a population confidence interval or a claim of real-world 100% accuracy. |

The project decision is an inference from these sources and existing product constraints: retain inspectable rules for contextual evidence; do not add KNN, stylometry, embeddings, a hosted model or an AI-use penalty. A supervised classifier would first need a defensible target and representative labels. Similarity between code fragments is not a validated distance between people's understanding. Deterministic rules are chosen for transparency, reproducibility and the current bounded task, not because rules inherently establish truth better than statistical methods.

## Evaluation layers and limits

The [M2 protocol](evaluations/M2_QUALITY_PROTOCOL.md) uses 48 synthetic repository cases to cover 24 scenario families in TypeScript and Python. Ten paired checks test invariance under irrelevant source narratives and bot committer involvement. We require every frozen assertion to pass. Allowing a few known deterministic rule violations under a percentage budget would hide actionable defects; the earlier unmeasured 10%/5%/95% proposals are therefore replaced.

This is a conformance experiment with normative labels, not a training set, independent knowledge benchmark, representative sample of developers or human acceptance study. Passing shows only that this implementation satisfies these selected expectations. The design and implementation share conceptual assumptions; independent review reduces but cannot remove that oracle bias. Related language variants do not count as statistically independent observations.

Real-world usefulness remains a separate question. Before claiming calibrated knowledge or productivity benefits, a future explicitly authorized study would need representative consenting users/tasks, an independent rubric and adjudication, recorded AI-workflow context, held-out evaluation, uncertainty reporting and correction/usefulness outcomes. It must not turn into employee surveillance or hiring scores. No such study or claim is part of M2.

## Research scope and stopping decision

Discovery covered Git/provenance semantics, generated-code classification, positive and negative detector evidence, developer expertise, assisted skill formation and evaluation validity. Follow-up inspected detector distribution shifts, collaboration/bot handling and the distinction between deterministic coverage and population estimates. The decisive sources above were checked against the current implementation. No source establishes our two-file heuristic as a measure of knowledge, and none supplies an empirical basis for the prior numeric tolerances.

Research stopped when each consequential design claim had primary support or an explicit limitation, positive detector evidence was reconciled with generalization failures, and another broad search was unlikely to alter the narrow M2 decision. This is a focused research synthesis, not an exhaustive systematic literature review. New evidence, owner corrections or reproducible failures may justify a versioned future change; they cannot retroactively tune the frozen M2 experiment.
