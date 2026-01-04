---
name: nested-subagent
description: Spawn isolated Claude processes that can use the full Task tool, including spawning their own subagents. Use when you need multi-level agent orchestration, context isolation, or to bypass the native Task tool's recursion limit.
---

# Nested Subagent Skill

This skill enables spawning fresh Claude processes that bypass the native Task tool's recursion limitation.

## The Problem

The native Task tool (`dispatch_agent`) explicitly filters out recursive agent spawning:

```typescript
// From AgentTool/prompt.ts
.filter(_ => _.name !== AgentTool.name)  // "No recursive agents, yet.."
```

## The Solution

Use the `mcp__nested-subagent__spawn_subagent` MCP tool to spawn a **fresh main Claude process** via `claude -p`. Since it's a new main agent (not a subagent), it has full Task tool access.

## Tool Usage

```typescript
mcp__nested-subagent__spawn_subagent({
  // Required
  prompt: string,           // Detailed task description

  // Optional
  model: "sonnet" | "opus" | "haiku",  // Default: sonnet
  workingDir: string,       // Default: current directory
  timeout: number,          // Default: 600000 (10 min)
  allowWrite: boolean,      // Default: false
  permissionMode: "default" | "acceptEdits" | "bypassPermissions" | "plan",
  systemPrompt: string,     // Replace default system prompt
  appendSystemPrompt: string,  // Add to system prompt
  allowedTools: string[],   // Restrict to specific tools
  disallowedTools: string[], // Block specific tools
  maxBudgetUsd: number,     // Cost limit
  addDirs: string[]         // Additional allowed directories
})
```

## When to Use

1. **Multi-level orchestration**: Tasks needing agents that spawn agents
2. **Context isolation**: Heavy operations that shouldn't pollute main context
3. **Parallel complex tasks**: Multiple independent complex operations
4. **Recursive workflows**: Verify -> Plan -> Code -> Test -> QA chains

## Example: Nested Task Orchestration

```
Spawn a subagent to implement feature X. The subagent should:
1. Use its own Task tool to spawn a planning agent
2. Spawn an implementation agent based on the plan
3. Spawn a testing agent to verify the implementation
4. Return a summary of all work completed
```

## Architecture

```mermaid
graph TD
    A[Main Session (your context)]
    A --> B[mcp__nested-subagent__spawn_subagent(prompt)]
    B --> C[Fresh Claude Process (200k context)]

    C --> D[Can use native Task tool]
    C --> E[Can spawn its own subagents]
    C --> F[Returns result to parent]
```

## Key Differences from Native Task Tool

| Aspect    | Native Task           | spawn_subagent      |
|:----------|:----------------------|:--------------------|
| Recursion | Blocked               | Allowed             |
| Context   | Shared pool           | Isolated 200k       |
| Process   | Same process          | New `claude -p`     |
| Tools     | Read-only by default  | Configurable        |
| Progress  | Internal              | MCP notifications   |
