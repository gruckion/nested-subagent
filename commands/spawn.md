---
name: spawn
description: Spawn a nested subagent that can use the full Task tool including spawning its own subagents
---

# Spawn Nested Subagent

Use the `mcp__nested-subagent__spawn_subagent` MCP tool to spawn a fresh Claude process with the following prompt:

$ARGUMENTS

This spawned process:
- Has its own 200k context window
- Can use the native Task tool to spawn its own subagents
- Runs in complete isolation from this session
- Returns its final response when complete

If no arguments provided, ask the user what task they want to delegate to a nested subagent.
