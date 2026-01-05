# Testing the Fallback Agent Plugin

This directory contains tests for the fallback-agent MCP plugin.

## Test Types

### Unit Tests

Free to run, no API costs. Tests helper utilities and pure functions.

```bash
bun run test
```

### Integration Tests

**WARNING: These tests spawn real Claude processes and incur API costs.**

Integration tests verify the full nested subagent functionality:

1. **Level 1 - Direct**: Claude runs a node command directly
2. **Level 2 - Subagent**: Claude spawns a subagent via native Task tool
3. **Level 3 - Nested**: Claude uses the plugin's MCP tool to spawn an outer agent, which spawns an inner agent

```bash
bun run test:integration
```

## Important: Use `bun run test`, not `bun test`

⚠️ **Do not use `bun test`** - that invokes bun's native test runner which has 5-second timeouts and won't work with our vitest configuration.

Always use `bun run test` to run vitest with proper timeouts.

## Test Configuration

Tests use these settings to minimize costs:

- **Model**: `haiku` (fastest/cheapest)
- **Max Turns**: 5 (limits runaway costs)
- **Timeout**: 120-180 seconds (allows completion without excess waiting)

## Running Specific Tests

```bash
# Run only unit tests
bun run test

# Run only integration tests
bun run test:integration

# Run a specific test file
bun run test -- test/helpers.test.ts

# Run tests matching a pattern
bun run test -- --grep "extractText"

# Watch mode (unit tests only)
bun run test:watch

# Alternative: use bunx directly
bunx vitest run test/helpers.test.ts
```

## Test Structure

```
test/
├── helpers/
│   └── claude-cli.ts          # Claude CLI spawning utilities
├── helpers.test.ts            # Unit tests for helpers (free)
├── basic-nesting.integration.test.ts    # Full integration tests (costs $)
└── README.md
```

## Writing New Tests

### For Unit Tests

Test pure functions without spawning Claude:

```typescript
import { describe, it, expect } from "vitest";

describe("MyFeature", () => {
  it("should do something", () => {
    // No Claude spawning here
    expect(true).toBe(true);
  });
});
```

### For Integration Tests

Use the `runClaude` helper and set cost-conscious limits:

```typescript
import { runClaude, wasToolUsed } from "./helpers/claude-cli.js";

it("should complete task", async () => {
  const result = await runClaude({
    prompt: "Your prompt here",
    model: "haiku",           // Use cheapest model
    maxTurns: 3,              // Limit turns
    timeout: 60000,           // 1 minute timeout
    dangerouslySkipPermissions: true,
  });

  expect(result.exitCode).toBe(0);
  expect(wasToolUsed(result, "Bash")).toBe(true);
});
```

## CI/CD Considerations

For CI pipelines, consider:

1. **Skip integration tests by default** - Run only on manual trigger or specific branches
2. **Use mocking** - Create fixtures of Claude responses for deterministic tests
3. **Budget limits** - Set `--max-budget-usd` flag in the Claude CLI
4. **Caching** - Cache successful test responses for replay

Example CI workflow:

```yaml
# Run unit tests always
- run: bun run test

# Run integration tests only on main branch or manual trigger
- run: bun run test:integration
  if: github.ref == 'refs/heads/main' || github.event_name == 'workflow_dispatch'
```
