# Security policy

This policy covers vulnerability reporting for Fork Me Up repository content and its development tooling. Product security and privacy requirements remain in [docs/SECURITY_PRIVACY.md](docs/SECURITY_PRIVACY.md); delivery and release gates remain in the [engineering process](docs/ENGINEERING.md) and [roadmap](docs/ROADMAP.md).

## Supported versions

The project is in M0 private preparation and has no released runtime or supported release line. The root package version `0.0.0` and unreleased DCP, Evidence, and Claim schemas `0.1.0` do not represent supported product releases. Reports about the current development revision are welcome through the process below. There is no security-support duration or response-time SLA at this stage.

Before a product release, maintainers must update this policy with the supported versions and upgrade path actually provided. A future Cloud/Pro service needs its own operational and incident-response policy before handling real private data.

## Reporting a vulnerability

Do not put vulnerability details, exploit instructions, credentials, private source, profiles, or sensitive logs in issues, pull requests, commits, CI output, or public discussions. A private repository's content and history may later become public; repository privacy is not a safe reporting channel by itself.

1. If the repository offers **Report a vulnerability**, use that private reporting flow. See [GitHub's reporting instructions](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/report-privately). This option requires repository configuration and availability; this policy does not claim it is enabled during private preparation.
2. If that option is unavailable, ask the repository owner for a private security contact using an existing direct communication channel. If you have no direct channel but can open a repository issue, post only a request for a private security contact, with no affected component, reproduction, logs, or vulnerability details.
3. Wait until you and the owner agree on a private channel before sending sensitive details. If neither route is accessible, retain the details privately until contact is available. No security email address or reporting service is currently designated by this policy.

The owner must verify a usable private route and keep these instructions accurate before accepting external contributions. Enabling a reporting service or changing repository settings is a separately authorized external action.

Once a private channel is established, provide a minimized report with:

- the affected revision or released version and relevant component;
- expected and observed behavior, impact, and required access or preconditions;
- minimal reproduction steps using synthetic data in an environment you control;
- relevant operating system and tool versions;
- suggested mitigation, if known, and a way to continue the private conversation.

Replace secrets with clearly synthetic placeholders and remove personal paths and identifiers. Do not send a complete repository, real profile, conversation, environment dump, or raw production log. If an exposed credential is involved, identify its type and location without sending its value; its owner should revoke or rotate it through the provider's secure controls.

## Handling and disclosure

The repository owner coordinates triage, reproduces the issue with synthetic data, assesses impact, and communicates the next step privately. Response and remediation timing depend on the finding and maintainer availability; this policy promises no deadline, bounty, or legal safe harbor and grants no access or testing permission on third-party systems.

Maintainers keep sensitive reports out of tracked history and ordinary build artifacts. They agree on a private repair and review path before preparing a change that could disclose an unresolved vulnerability. Tests should prove the failure with synthetic or canary data and verify the fix without retaining protected inputs. Relevant project and security checks must pass, and public summaries, changelog entries, and advisories must be reviewed for disclosure.

Coordinate public disclosure with the reporter after mitigation and review. Credit the reporter only with consent. A public advisory should identify affected and fixed versions or revisions, impact, mitigation, and upgrade instructions without disclosing protected data. Publication, credential rotation, remote cleanup, and other external or destructive actions still require authorization from the responsible owner. No release or milestone advancement may proceed with a confirmed, unresolved, unmitigated critical or high-severity finding.
