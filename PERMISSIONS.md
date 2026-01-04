# Recommended Permissions

Add these to your project's `.claude/settings.local.json` to use the nested-subagent plugin effectively.

## How to Use

Create or edit `.claude/settings.local.json` in your project and add permissions under the `permissions.allow` array:

```json
{
  "permissions": {
    "allow": [
      // Add permissions from sections below
    ]
  }
}
```

## Nested Subagent Plugin

Allow the MCP tool to spawn nested subagents:

```json
"mcp__plugin_nested_subagent__Task"
```

## Development Commands

Common npm commands for the MCP server:

```json
"Bash(npm install:*)",
"Bash(npm test:*)",
"Bash(npm run:*)",
"Bash(npx tsc:*)",
"Bash(npx tsx:*)"
```

## Utility Commands

File and directory utilities:

```json
"Bash(node:*)",
"Bash(chmod:*)",
"Bash(tree:*)"
```

## Integration Testing

For running the integration tests (spawns real Claude processes):

```json
"Bash(npm run test\\:integration:*)"
```

## Example Complete Configuration

Minimal setup for using the nested-subagent plugin:

```json
{
  "permissions": {
    "allow": [
      "mcp__plugin_nested_subagent__Task",
      "Bash(node:*)"
    ]
  }
}
```

## Full Development Setup

For contributors developing the plugin:

```json
{
  "permissions": {
    "allow": [
      "mcp__plugin_nested_subagent__Task",
      "Bash(npm install:*)",
      "Bash(npm test:*)",
      "Bash(npm run:*)",
      "Bash(npx tsc:*)",
      "Bash(npx tsx:*)",
      "Bash(node:*)"
    ]
  }
}
```
