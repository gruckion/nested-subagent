# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Claude Code plugin that enables **unlimited nested subagents**. The native Task tool blocks subagents from spawning other subagents (via tool filtering in `AgentTool`). This plugin bypasses that limitation by spawning fresh `claude -p` processes, which are full main agents with complete tool access.

## Commands

### Build & Development

```bash
cd mcp-server && bun run build      # Build MCP server (uses tsdown)
cd mcp-server && bun run dev        # Run MCP server in development mode (tsx)
cd mcp-server && bun run typecheck  # TypeScript type checking
```

### Testing

```bash
cd mcp-server && bun run test           # Run unit tests
cd mcp-server && bun run test:watch # Watch mode
cd mcp-server && bun run test:integration  # Integration tests (*.integration.test.ts files)
```

### Plugin Installation

```bash
claude --plugin-dir ./       # Per-session usage
```

## Architecture

### Key Insight

The native Task tool's recursion blocker (`.filter(_ => _.name !== AgentTool.name)`) is **process-local**. By spawning a fresh `claude -p` process via MCP, we create a new main agent that has full tool access including the Task tool.

```markdown
Native:  Main → Subagent → BLOCKED (Task tool filtered out)
Plugin:  Main → MCP Tool → spawn "claude -p" → Fresh Main Agent → CAN use Task → Unlimited nesting
```

### Directory Structure

```markdown
fallback-agent/
├── .claude-plugin/
│   └── marketplace.json     # Plugin manifest for marketplace distribution
├── .mcp.json               # MCP server configuration
├── mcp-server/
│   ├── src/index.ts        # MCP server implementation (core logic)
│   ├── dist/               # Built output (bundled with tsdown)
│   └── test/               # Unit and integration tests
└── src/                    # Reference Claude Code source (for understanding internals)
```

### MCP Server (`mcp-server/src/index.ts`)

The MCP server exposes a single tool named `Task` that:

1. Spawns `claude -p --output-format stream-json --verbose` subprocess
2. Parses streaming JSON output line-by-line for real-time progress
3. Emits MCP `notifications/progress` for each tool use
4. Passes `--plugin-dir` to spawned process to enable recursive nesting
5. Handles abort via SIGTERM/SIGKILL

**Critical implementation detail:** `proc.stdin?.end()` must be called immediately after spawn - the prompt is passed via CLI argument, not stdin.

### Debug Logging

All MCP server operations log to `/tmp/fallback-agent-debug.log` for troubleshooting.

## Tool Parameters

The `mcp__plugin_fallback_agent__Task` tool accepts:

| Parameter                          | Type        | Description                                                                                       |
|------------------------------------|-------------|---------------------------------------------------------------------------------------------------|
| `prompt`                           | string      | **Required.** Task for the agent                                                                  |
| `model`                            | string      | Model to use: `sonnet`, `opus`, or `haiku`. *(Default: `sonnet`)*                                 |
| `timeout`                          | number      | Timeout in milliseconds. *(Default: `600000`)*                                                    |
| `allowWrite`                       | boolean     | Enable `--dangerously-skip-permissions` to allow file writes/tools that modify the filesystem     |
| `permissionMode`                   | string      | Permission mode: one of `default`, `acceptEdits`, `bypassPermissions`, or `plan`                  |
| `systemPrompt`                     | string      | Custom system prompt                                                                              |
| `allowedTools`                     | string[]    | List of tools explicitly allowed for this agent (overrides default tool access)                   |
| `disallowedTools`                  | string[]    | List of tools to disallow for this agent (overrides default tool access)                          |
| `maxBudgetUsd`                     | number      | Optional cost limit (in USD) for this task                                                        |
