# Nested Subagent Plugin - Architecture

> Deep technical analysis of how the plugin bypasses Claude Code's subagent recursion limitation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [How Native TaskTool Works](#how-native-tasktool-works)
3. [The Nested-SubAgent Bypass](#the-nested-subagent-bypass)
4. [Plugin Architecture](#plugin-architecture)
5. [MCP Server Implementation](#mcp-server-implementation)
6. [Comparison Matrix](#comparison-matrix)
7. [Key Architectural Insight](#key-architectural-insight)

---

## Executive Summary

This plugin enables **nested sub-agents** in Claude Code. The key insight is that while native sub-agents cannot spawn other sub-agents (blocked by tool filtering), this plugin spawns fresh `claude -p` processes that bypass this limitation entirely.

---

## How Native TaskTool Works

### Source Location

```
src/tools/AgentTool/AgentTool.tsx
src/tools/AgentTool/prompt.ts
src/tools/AgentTool/constants.ts
```

### The Critical Recursion Blocker

**`src/tools/AgentTool/prompt.ts:11-18`**:

```typescript
export async function getAgentTools(
  dangerouslySkipPermissions: boolean,
): Promise<Tool[]> {
  // No recursive agents, yet..
  return (
    await (dangerouslySkipPermissions ? getTools() : getReadOnlyTools())
  ).filter(_ => _.name !== AgentTool.name)  // <-- THE BLOCKER
}
```

This single line **removes the Task tool from sub-agents**. When a sub-agent is spawned, it literally cannot see or use the Task tool - it's filtered out of their available tool list.

### Key Properties

- **In-process execution**: Sub-agents run in the same Node.js process
- **Shared context**: Inherits from parent (tools, permissions)
- **Read-only by default**: Unless `dangerouslySkipPermissions` is true
- **Single-level only**: Cannot spawn nested sub-agents

---

## The Nested-SubAgent Bypass

### Why Native Sub-Agents Cannot Nest

The tool filtering in `prompt.ts` only applies **within a single process**. Sub-agents are essentially in-process LLM loops with a filtered tool list.

```
Native TaskTool Architecture (BLOCKED):

  Main Agent
      │
      └── Task Tool call
              │
              └── Subagent (tools filtered, NO Task tool)
                      │
                      └── CANNOT spawn further agents
```

### Why `claude -p` Bypasses This

When you spawn a fresh Claude process via `claude -p` (headless mode):

```
Nested-SubAgent Plugin Architecture (BYPASSED):

  Main Agent
      │
      └── MCP Tool call (Task)
              │
              └── spawn "claude -p" subprocess
                      │
                      └── Fresh MAIN Agent (ALL tools available!)
                              │
                              ├── CAN use native Task tool
                              │
                              └── CAN spawn subagents
                                      │
                                      └── Unlimited nesting depth
```

The spawned `claude -p` process is a **completely new main agent**, not a sub-agent. It:

1. Starts fresh with full tool access (including Task)
2. Has its own separate 200k context window
3. Is completely isolated from parent context
4. Can spawn its own sub-agents via the native Task tool

### The Key Insight

> The native TaskTool's recursion blocker `.filter(_ => _.name !== AgentTool.name)` is **process-local**. By spawning a fresh `claude -p` process, we create a new **main agent** that has FULL tool access - the blocker simply doesn't apply to new processes.

---

## Plugin Architecture

### Directory Structure

```
nested-subagent/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest (name: "nested")
├── .mcp.json                    # MCP server configuration
├── mcp-server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   └── index.ts             # MCP server implementation
│   └── test/
│       ├── basic-nesting.integration.test.ts
│       └── marathon-workflow.integration.test.ts
├── ARCHITECTURE.md              # This file
└── README.md                    # User-friendly quick start
```

### MCP Server Configuration

```json
// .mcp.json
{
  "mcpServers": {
    "subagent": {
      "command": "npx",
      "args": ["tsx", "${CLAUDE_PLUGIN_ROOT}/mcp-server/src/index.ts"],
      "cwd": "${CLAUDE_PLUGIN_ROOT}"
    }
  }
}
```

---

## MCP Server Implementation

### How It Works

The MCP server (`mcp-server/src/index.ts`) works by:

1. **Spawning Claude CLI** with streaming JSON output:
   ```typescript
   const proc = spawn("claude", [
     "-p", prompt,
     "--output-format", "stream-json",
     "--verbose",
     "--model", model,
     // ... other options
   ]);
   ```

2. **Parsing streaming JSON** line by line for progress updates

3. **Emitting MCP progress notifications** for real-time visibility

4. **Handling abort** via SIGTERM/SIGKILL

### Tool Parameters

```typescript
{
  // Optional UI description
  description?: string,        // Short task summary (3-5 words)

  // Required
  prompt: string,              // The task for the agent to perform

  // Optional configuration
  model?: "sonnet" | "opus" | "haiku",  // Default: "sonnet"
  workingDir?: string,
  timeout?: number,            // Default: 600000 (10 min)
  allowWrite?: boolean,        // --dangerously-skip-permissions
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions" | "plan",
  systemPrompt?: string,       // --system-prompt
  appendSystemPrompt?: string, // --append-system-prompt
  allowedTools?: string[],     // --allowed-tools
  disallowedTools?: string[],  // --disallowed-tools
  maxBudgetUsd?: number,       // --max-budget-usd
  addDirs?: string[],          // --add-dir
}
```

### Critical Implementation Details

#### stdin Must Be Closed Immediately

```typescript
const proc = spawn("claude", args, { stdio: ["pipe", "pipe", "pipe"] });
proc.stdin?.end();  // CRITICAL: Close stdin immediately
```

**Why:** The `claude -p` command receives its prompt via CLI argument, not stdin. If stdin remains open, the process hangs.

#### Debug Logging

All operations are logged to `/tmp/nested-subagent-debug.log`:

```typescript
const LOG_FILE = "/tmp/nested-subagent-debug.log";
function log(message: string) {
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
}
```

---

## Comparison Matrix

### Native TaskTool vs Nested-SubAgent Plugin

| Feature | Native TaskTool | Nested-SubAgent Plugin |
|---------|----------------|----------------------|
| **Progress delivery** | Generator `yield` | MCP `notifications/progress` |
| **Can nest further** | NO (blocked) | YES (unlimited) |
| **Context window** | Shared/inherited | Fresh 200k per task |
| **Tool availability** | Filtered (no Task) | ALL tools available |
| **Process model** | In-process loop | Separate subprocess |
| **Permissions** | Inherited | Fully configurable |
| **System prompt** | Default inherited | Fully customizable |
| **Budget control** | None | Per-task limits |
| **Abort mechanism** | `abortController` | SIGTERM/SIGKILL |

### Advantages of Nested-SubAgent Plugin

1. **Unlimited nesting depth** - Fresh processes bypass the blocker
2. **Context isolation** - Each task gets a fresh 200k context window
3. **Configurable tool restrictions** - Allow/disallow specific tools
4. **Full system prompt control** - Custom or appended prompts
5. **Budget limits per subtask** - Prevent runaway costs
6. **Parallel execution** - Multiple subtasks can run concurrently

---

## Key Architectural Insight

### The Fundamental Difference

```
Native TaskTool:
  Main Agent → Task Tool → Subagent (tools filtered, NO Task tool)
                                    ↓
                              Cannot spawn further agents

Nested-SubAgent Plugin:
  Main Agent → mcp__plugin_nested_subagent__Task → spawn "claude -p" → Fresh Main Agent
                                                                              ↓
                                                                       CAN use Task tool
                                                                              ↓
                                                                       CAN spawn subagents
                                                                              ↓
                                                                       Unlimited depth
```

### Why This Is the Correct Approach

1. **Cannot modify Claude Code source** - We must work within the plugin system
2. **Plugins can define MCP servers** - Official extension point
3. **MCP tools can spawn processes** - Standard capability
4. **Fresh `claude -p` processes are main agents** - Full tool access
5. **MCP progress notifications** - Real-time visibility

This is not a hack or workaround - it's the **architecturally correct solution** within the constraints of the plugin system.

---

## References

### Source Files (Native TaskTool)

- `src/tools/AgentTool/AgentTool.tsx` - Main implementation
- `src/tools/AgentTool/prompt.ts` - Tool filtering (line 17 blocks recursion)
- `src/query.ts` - Query loop and tool execution

### Official Documentation

- https://docs.anthropic.com/en/docs/claude-code/sub-agents
- https://docs.anthropic.com/en/docs/claude-code/plugins
- https://docs.anthropic.com/en/docs/claude-code/headless
- https://docs.anthropic.com/en/docs/claude-code/mcp
