# Nested Subagent Plugin

![Claude Code](https://img.shields.io/badge/Claude%20Code-Plugin-blue?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

Enable **unlimited nested subagents** in Claude Code. Subagents can spawn their own subagents.

## Quick Start

### Option 1: Install from Marketplace (Recommended)

1. Run `/plugin` in Claude Code
2. Go to **Marketplaces** tab
3. Select **+ Add Marketplace**
4. Enter `gruckion/nested-subagent`
5. Go to **Discover** tab and install the plugin

### Option 2: Install Locally

```bash
git clone https://github.com/gruckion/nested-subagent.git
cd nested-subagent/mcp-server && npm install
claude /plugin install ./nested-subagent
```

### Option 3: Per-Session (CLI)

```bash
claude --plugin-dir /path/to/nested-subagent
```

## What's Included

| Component | Name | Description |
|-----------|------|-------------|
| MCP Tool | `Task` | Spawns isolated Claude processes with full tool access |
| Agent | `nested-task` | Orchestrates nested subagent workflows |
| Skill | `nested-subagent` | Model-invoked capability for multi-level nesting |

## Usage

Just add "via a nested subagent" to your prompts:

```
Print numbers 1-10 using node CLI via a nested subagent.
```

```
Build a math utility via a nested subagent. Use subagents for verify, plan, code steps.
```

```
Process these 3 tasks via a nested subagent that delegates to its own subagents.
```

## Why Use This?

Claude Code's native Task tool **blocks subagents from spawning other subagents**. This plugin bypasses that limitation by spawning fresh `claude -p` processes - each one is a new main agent with full tool access.

```
Native Task:     Main → Subagent → BLOCKED
This Plugin:     Main → Nested → Fresh Main → Subagent → Works!
```

## Tool Reference

The `mcp__plugin_nested_subagent__Task` tool accepts:

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | string | **Required.** The task for the agent |
| `description` | string | Short summary for UI display (3-5 words) |
| `model` | string | `sonnet`, `opus`, or `haiku` (default: sonnet) |
| `allowWrite` | boolean | Enable write permissions |
| `timeout` | number | Timeout in ms (default: 600000) |
| `systemPrompt` | string | Custom system prompt |
| `allowedTools` | string[] | Restrict to specific tools |
| `maxBudgetUsd` | number | Cost limit for the task |

## Architecture

For deep technical details on how this works, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## License

MIT
