# Fork Me Up — Competitive Landscape and Differentiation Strategy

> Research date: September 3, 2026  
> Updated framing: September 4, 2026  
> Scope: public repositories and official project documentation related to developer-skill inference, repository intelligence, agent memory, and MCP delivery.  
> Role: point-in-time research and design rationale; not a normative product specification.

## 1. Executive summary

The market is fragmented across four categories:

1. **Developer assessment products** infer skills from repositories, CVs, self-assessment, or interviews, usually for recruiting or career planning.
2. **Repository intelligence products** understand a codebase, stack, architecture, and relevant files, but not what an individual developer has demonstrated.
3. **Agent memory products** preserve project facts and conversation history, but usually do not model developer proficiency or evidence quality.
4. **Agent-readiness products** evaluate how well a repository supports AI agents, not how the human understands its technologies.

No reviewed repository documented the complete client-neutral loop:

> Determine task demand, collect attributable evidence selected by the developer, express capability claims with uncertainty and provenance, compile a minimized portable packet, adapt an AI tool's behavior, and learn from explicit developer corrections.

That combination is the opportunity. Fork Me Up should be positioned as an **evidence-bounded developer-context layer**, not another skill score, résumé evaluator, repository digest, or generic memory server.

## 2. Comparison model

Fork Me Up is evaluated as five stages:

1. **Demand model:** capabilities required by the current project and task.
2. **Evidence model:** direct, attributable, adjacent, limited, and disputed developer evidence.
3. **Claim model:** explicit uncertainty, corrections, recency, confidence, and limitations.
4. **Portable delivery:** a task-scoped Developer Context Packet consumable through open contracts.
5. **Behavior policy:** guidance for explanation depth, analogies, questions, commands, risk, and rollback.

Superficial features such as a chat UI or dashboard are not primary comparison criteria.

## 3. Closest public projects

### 3.1 Skills Improver

[violabg/skills-improver](https://github.com/violabg/skills-improver) combines self-evaluation, AI-generated questions, GitHub and CV evidence, readiness scores, gap analysis, and learning roadmaps.

**Overlap:** skill inference, evidence, questions, and a persistent profile.  
**Gap:** career-goal output rather than task-level AI calibration; no documented portable context contract, adjacent-knowledge execution policy, or local client-neutral runtime.

### 3.2 GitHub Skill Analyzer

[Vikasjoshi008/github-skill-analyzer](https://github.com/Vikasjoshi008/github-skill-analyzer) analyzes GitHub profiles and produces skill scores and recruiter-oriented insights.

**Overlap:** repository-derived technical signals.  
**Gap:** numeric scoring and recruiter output without the evidence/provenance, uncertainty, portability, and runtime behavior model required by Fork Me Up.

### 3.3 Measuring AI Proficiency

[pskoett/measuring-ai-proficiency](https://github.com/pskoett/measuring-ai-proficiency) provides a CLI, MCP server, agent skills, and GitHub Action that score repository maturity for AI-agent use.

**Overlap:** deterministic scanning, structured output, MCP, skills, and low-cost local operation.  
**Gap:** the measured object is repository AI-context maturity, not the developer's technical evidence.

This is an architectural reference for combining local scanning, GitHub access, structured output, MCP, and skills without making a SaaS mandatory.

### 3.4 skillinfer

[kostadindev/skillinfer](https://github.com/kostadindev/skillinfer) predicts unobserved skills from partial observations with Bayesian methods and returns credible intervals.

**Overlap:** adjacent-skill inference, task matching, and explicit uncertainty.  
**Gap:** no repository evidence collection, authorship model, DCP, or behavioral response policy.

Its methodological value is avoiding false certainty. Statistical inference remains deferred until Fork Me Up has a suitable calibration dataset.

### 3.5 aiurda/devcontext

[aiurda/devcontext](https://github.com/aiurda/devcontext) is an MCP server for project context, code entities, conversation history, patterns, and milestones.

**Overlap:** MCP, continuous project context, relevance, and session lifecycle.  
**Gap:** project relevance rather than demonstrated individual capability; no documented pedagogical policy or cross-repository developer-evidence model.

## 4. Important adjacent infrastructure

### Agent memory

- [ai-memory](https://github.com/akitaonrails/ai-memory) preserves prompts, decisions, failed approaches, and cross-agent handoffs.
- [Basic Memory](https://github.com/basicmachines-co/basic-memory) provides local-first human-readable knowledge, search, MCP, and optional cloud sync.

Fork Me Up should interoperate with memory systems rather than rebuild generic conversation memory. A developer profile is a specialized evidence-backed artifact, not a transcript archive.

### Repository intelligence

- [Serena](https://github.com/oraios/serena) provides MCP-based semantic code navigation and project memories.
- [CodeDna](https://github.com/crafteraadarsh/codedna) detects stack, architecture, dependencies, infrastructure, and file statistics.
- [Gitingest](https://github.com/coderamp-labs/gitingest) creates prompt-friendly repository representations.
- [Aider](https://github.com/Aider-AI/aider) builds repository maps for its coding agent.

These products can inform or complement demand extraction. They do not by themselves establish attributable developer capability.

### Source access

[GitHub MCP Server](https://github.com/github/github-mcp-server) provides structured access to repositories, commits, issues, pull requests, and Actions.

This is enabling infrastructure. Fork Me Up should accept multiple evidence providers and retain a minimal local Git path so users are not forced into one source-access stack.

## 5. Capability matrix

Legend: **Yes** = documented primary capability; **Partial** = useful component or adjacent behavior; **No** = not documented as a primary capability.

| Project | Task demand | Repository evidence | Developer claims | Attribution | Task-scoped packet | Explicit uncertainty | Runtime delivery | Adaptive response policy |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Fork Me Up | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Skills Improver | Partial | Yes | Yes | Partial | Partial | Partial | No | No |
| GitHub Skill Analyzer | No | Yes | Yes | No | No | No | No | No |
| Measuring AI Proficiency | Partial | Yes | No | No | No | No | Yes | No |
| skillinfer | Partial | No | Yes | Input-dependent | Yes | Yes | Partial | No |
| aiurda/devcontext | Yes | Partial | No | No | Partial | No | Yes | No |
| ai-memory | Partial | Partial | No | No | Partial | No | Yes | No |
| Basic Memory | No | Input-dependent | No | No | Query-relative | No | Yes | No |
| Serena | Yes | Yes | No | No | Query-relative | No | Yes | No |
| CodeDna | Yes | Yes | No | No | No | No | Partial | No |
| GitHub MCP Server | No | Yes | No | Source-dependent | No | No | Yes | No |

“No” means the capability was not documented as a primary feature in the reviewed material; it does not prove that no private or experimental implementation exists.

## 6. The practical competitive threat

The main threat is not one repository. It is a developer assembling:

```text
Git/GitHub access
        +
repository intelligence
        +
agent memory
        +
custom persistent instructions
```

That stack can approximate data access, project analysis, persistence, and behavior. Its weakness is the absence of one evidence schema, attribution model, uncertainty contract, correction loop, disclosure policy, and portable task projection.

Fork Me Up must win through interoperability, evidence quality, controlled delivery, measurable calibration, and trust—not by bundling existing scanners under a new name.

## 7. Differentiation strategy

### 7.1 Own portable developer context

The product category is broader than a coding-plugin feature:

> A private, inspectable developer profile that can produce minimized context for different AI-assisted tasks.

The first adapter is a validation vehicle. Protocol and Core remain independent of every client and model.

### 7.2 Make every claim explainable

Material claims preserve:

- capability and claim state;
- observed depth and confidence as separate dimensions;
- direct versus adjacent status;
- source-relative evidence references;
- authorship assessment;
- inference reason and limitations;
- freshness and invalidation.

### 7.3 Treat absence as uncertainty

No public repository, private professional work, team contribution, pair work, generated code, or copied template can be interpreted reliably without context. The default is `insufficient-evidence`, never “beginner” or “does not know”.

### 7.4 Model adjacency explicitly

The valuable transfer is not merely “knows frontend”. It is the ability to tell a client:

> Angular component architecture is demonstrated; React is not. Use the known component model as a bridge and emphasize lifecycle and state differences.

Direct and adjacent evidence must never collapse into one score.

### 7.5 Ship a behavioral contract

The DCP guides the consumer to:

- stay concise for demonstrated capabilities;
- use bounded analogies for adjacent capabilities;
- avoid assuming either expertise or ignorance when evidence is insufficient;
- explain purpose, expected result, side effects, validation, and rollback for unfamiliar or risky commands;
- ask one high-information question only when it changes the path or risk.

### 7.6 Close the correction loop

Developer corrections outrank inference, remain versioned, and change future behavior without erasing the original evidence. Observations, inferences, declarations, disputes, and transient session signals remain distinct.

### 7.7 Keep Community useful and model-independent

Community uses deterministic scanners and does not require another LLM API. Independent or hosted providers may later use other inference mechanisms only if they disclose data flow, preserve protocol semantics, and pass the same evidence, uncertainty, and security evaluations.

### 7.8 Publish the DCP and conformance suite

The public moat is an adopted, well-tested Developer Context Protocol. Schemas, examples, SDKs, provider contracts, and conformance fixtures let different tools exchange the same minimized meaning without requiring the official hosted service.

### 7.9 Compete with evaluations

Public evaluation scenarios should include:

- direct expertise;
- adjacent expertise;
- insufficient evidence;
- a misleading fork or template;
- generated and vendored code;
- team code with uncertain authorship;
- stale evidence;
- explicit correction;
- malicious repository instructions;
- disclosure and token budgets;
- two different consumers.

Measure false `demonstrated` claims, unnecessary over-explanation, unsafe under-explanation, useful-question rate, explanation tokens, time to first correct action, command-purpose coverage, and recovery after correction.

## 8. Open and commercial boundary

### Community

- DCP, schemas, types, SDKs, and provider interface.
- Local CLI, profile store, corrections, export, and deletion.
- Basic deterministic selected-repository scanner.
- Local MCP and reference adapters.
- Fixtures, evaluations, conformance, and documentation.

### Cloud/Pro

- Managed selected public/private repository connectivity.
- Stronger attribution and multi-repository evidence fusion.
- Continuous incremental refresh and profile history.
- Secure credential operations and tenant isolation.
- Owner review, audit, grants, and revocation.
- Authenticated remote MCP, quotas, support, and service levels.

The paid product sells compilation quality, freshness, convenience, governance, and operations. It does not sell access to a closed version of the developer's own profile.

## 9. Lowest-cost Community MVP

The research supports a narrow local-first path:

1. Client-neutral TypeScript Protocol and Core.
2. Local CLI and MCP `stdio` server.
3. Selected local repositories first; bounded public history later.
4. Deterministic extraction without executing repository code.
5. Versioned local evidence/profile storage with atomic writes.
6. One compact `get_task_context` operation and bounded owner evidence lookup.
7. Thin adapters using lifecycle hooks only where supported.
8. A small capability taxonomy expanded only with fixtures and evaluations.
9. No hosted dependency, private connector, vector database, or second LLM in Community.

Do not rebuild generic agent memory, semantic code editing, or a complete repository digest. Integrate through open provider and consumer boundaries.

## 10. Naming decision and residual risk

The original working name was rejected because it collided with existing repositories and products, including [aiurda/devcontext](https://github.com/aiurda/devcontext), [astraedus/devcontext](https://github.com/astraedus/devcontext), a similarly named [Visual Studio Marketplace extension](https://marketplace.visualstudio.com/items?itemName=devcontext.devcontext), [devcontext.xyz](https://www.devcontext.xyz/), and [devcontext.com.br](https://www.devcontext.com.br/).

The project name is now **Fork Me Up**. Adoption in planning documents is not legal clearance. Before public packages, domains, branding, or commercial launch, the owner must check relevant source registries, package registries, domains, social handles, and trademark databases and record the decision.

## 11. Strategic conclusion

```text
Task and project demand
          ↓
Attributable developer evidence
          ↓
Claims + confidence + adjacency + uncertainty
          ↓
Private profile
          ↓
Purpose-bound task context packet
          ↓
AI behavior
          ↓
Developer correction and profile update
```

Memory tools remember what happened. Repository tools understand code. Career tools score developers. Fork Me Up should help different AI tools communicate and act at the right level for this developer, on this task, with evidence and humility.

## 12. Primary sources

- [Skills Improver](https://github.com/violabg/skills-improver)
- [GitHub Skill Analyzer](https://github.com/Vikasjoshi008/github-skill-analyzer)
- [Measuring AI Proficiency](https://github.com/pskoett/measuring-ai-proficiency)
- [skillinfer](https://github.com/kostadindev/skillinfer)
- [aiurda/devcontext](https://github.com/aiurda/devcontext)
- [ai-memory](https://github.com/akitaonrails/ai-memory)
- [Basic Memory](https://github.com/basicmachines-co/basic-memory)
- [Serena](https://github.com/oraios/serena)
- [CodeDna](https://github.com/crafteraadarsh/codedna)
- [Gitingest](https://github.com/coderamp-labs/gitingest)
- [Aider](https://github.com/Aider-AI/aider)
- [GitHub MCP Server](https://github.com/github/github-mcp-server)

This is a non-exhaustive point-in-time scan. Product decisions are maintained in [PROJECT_SPEC.md](PROJECT_SPEC.md), not in this research document.
