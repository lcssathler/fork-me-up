# Selected GitHub sources

This owner-only checkout command reads an explicit list of public/private GitHub repositories. It is separate from the [offline Community workflow](LOCAL_COMMUNITY.md) and the existing public-history fallback. It does not change the profile or expose source access through MCP.

Use an existing GitHub CLI login. Prefer a credential restricted to the selected repositories with read-only Metadata and Contents permissions; Fork Me Up cannot reduce a broader login's permissions. Never paste a token into this configuration or chat. The `gh` credential store retains ownership of the login. Fork Me Up obtains a transient token through `gh auth token`, sends it only to GitHub's fixed HTTPS API, and rejects redirects. See [ADR-0043](adr/0043-selected-github-source-access.md).

## Select and read

Save this synthetic example outside source repositories and version control, with access limited to your OS account. Replace the account/repository and issue/expiry timestamps explicitly. Consent may last at most 24 hours. Use the actual visibility; a mismatch denies the read. The opaque references are local identifiers, not GitHub account names.

```json
{
  "version": "0.1.0",
  "account": "example-owner",
  "subjectRef": "subject_local",
  "issuedAt": "2026-09-21T12:00:00.000Z",
  "expiresAt": "2026-09-21T13:00:00.000Z",
  "repositories": [
    {
      "repositoryRef": "repo_selected",
      "owner": "example-owner",
      "name": "example-source",
      "visibility": "private",
      "metadata": true,
      "content": true,
      "history": true
    }
  ],
  "limits": {
    "repositories": 8,
    "requests": 64,
    "responseBytes": 1048576,
    "totalBytes": 8388608,
    "durationMs": 60000,
    "treeEntries": 4096,
    "files": 16,
    "fileBytes": 131072,
    "commits": 8
  }
}
```

From the checkout, using the [pinned toolchain](ENGINEERING.md#4-reproducible-environment):

```text
node scripts/github-source.mjs --config <private-config.json> --operation discover
node scripts/github-source.mjs --config <private-config.json> --operation collect
```

`discover` reads only authenticated-account and selected-repository metadata. It never enumerates your account. `collect` additionally reads the permitted content/history: content includes current revision/tree metadata; history adds bounded ancestor commit metadata. Both scopes are separate from permission to share anything with a model. No issue/PR, dependency installation, repository execution, clone, checkout, remote write or model call occurs.

The receipt contains status and aggregate request/byte/repository/file/commit counts only. A successful collection says `bounded-sample`: it examines at most the configured files/commits per repository, not all your work. Supported source extensions are TypeScript, JavaScript, Java, Python, C#, Go, Rust, PowerShell, PHP and Ruby. Links/submodules, hidden paths, vendor/build/generated/test-data directories, configuration/settings and obvious secret paths are excluded. Other binary or invalid UTF-8 blobs are discarded. These filters are not a proof that a source contains no secret; no source text leaves this boundary regardless.

## Failures, disconnect and retention

Missing/failed authentication, account or visibility changes, redirects, malformed objects and exhausted budgets produce a content-free failure with no observations. Reduce the selection or correct authorization; do not bypass a rejected boundary. Truncated/oversized trees fail rather than silently claiming coverage. The existing local workflow remains available.

The command rereads the configuration before/after requests and after credential acquisition. Changing/removing it or letting it expire stops subsequent requests; an already in-flight read cannot be retracted. There are no background refreshes. Each invocation starts from fresh authority with no source cache.

Raw responses, source text and identities exist only transiently in memory. The private in-process result retains only opaque file references, language/byte/hash observations and identity digests for the caller's lifetime. They are not capability Claims and do not establish authorship or expertise. Exiting the command releases them; no persistent source/derived data, export or backup is created by this command. Your existing Store and owner declarations remain unchanged. For separately authorized persistent reuse, use the [catalog owner workflow](SOURCE_CATALOG.md). Profile interpretation remains separate [roadmap work](ROADMAP.md#15-current-m3-execution-queue).

Real private-source collection requires the [local security gate](SECURITY_PRIVACY.md#before-authenticated-private-source-collection-in-the-local-mvp), including synthetic checks, a second security review and explicit owner selection. This guide itself grants no access or model disclosure.
