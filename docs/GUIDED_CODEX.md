# Try Fork Me Up in Codex

This development pilot uses a local profile and the real read-only MCP. It is not a public plugin or general assessment of your knowledge. Automatic evidence currently describes languages within the selected project.

## Start

Open this checkout in Codex and ask: **“Use $fork-me-up to set up my local profile.”** The skill is in [.agents/skills/fork-me-up](../.agents/skills/fork-me-up/SKILL.md). If it is not discovered, restart Codex or explicitly point to that file. See [Codex skill discovery](https://learn.chatgpt.com/docs/build-skills).

Confirm selected repositories, exact Git identity, private storage, permitted profile writes and sharing with your client/model. The agent reuses permissions you already supplied. Keep configuration and Store outside source repositories. Review the resulting overview and state any correction explicitly. No questionnaire or separate model API is required.

The agent follows [local setup](LOCAL_COMMUNITY.md#configure-explicitly), then [owner collection](LOCAL_COMMUNITY.md#collect-and-control-the-profile). Failed collection stops profile preparation; it does not establish missing knowledge or justify broader access. Setup may execute the trusted product's installation commands; source collection never executes analyzed code.

## Connect the profile

After authorizing disclosure, add the following to your trusted project's private `.codex/config.toml`, substituting the pinned Node executable, trusted checkout and private configuration paths. Preserve existing settings and exclude this machine-specific file from Git before creating it.

```toml
[mcp_servers.fork_me_up]
command = "C:/Program Files/nodejs/node.exe"
args = ["C:/Checkout/fork-me-up/scripts/community.mjs", "--config", "C:/PrivatePilot/community.json", "--mode", "mcp"]
required = false
enabled_tools = ["get_task_context", "get_profile_metadata"]
```

Reload the client if the tools are not available. Configuration alone is not proof of connection: ask Codex to call `get_task_context` for a short concrete task, purpose `technical-learning` or `coding-assistance`, budget at most 8192, and explicit capabilities such as `language.typescript`. Check the actual tool call. See [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

The packet is advisory. Unknown evidence must not become “you do not know this.” If the optional tool fails, keep working without personalized context. The current fixture hooks do not supply your saved profile.

## Correct and reuse

Tell the agent what is inaccurate or explicitly declare relevant experience. Within your approved write scope, it uses the [owner commands](OWNER_WORKFLOW.md), verifies the result and asks for fresh MCP context. Notes and the full profile stay private. A saved correction should remain effective after server restart; the source cache itself is not persistent. Withdrawal is not currently implemented.

For the pilot, review a real assessment, supply a real declaration/correction, and repeat a task-context call after restarting. Synthetic tests and a custom MCP harness cannot replace this client check. This pilot verifies delivery and reuse; the later usefulness study compares explanation quality and total cost.

Disable or remove the `fork_me_up` configuration to stop future delivery. This neither retracts previously sent packets nor deletes saved data. Use [explicit owner deletion](OWNER_WORKFLOW.md#delete-managed-local-data) if desired; configuration, independent backups and retained trial records are managed separately.
