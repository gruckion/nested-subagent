/**
 * Marathon-Ralph Workflow Integration Test
 *
 * Tests the full nested subagent architecture where:
 * - Main agent spawns a nested subagent (fresh Claude process)
 * - Nested subagent uses native Task tool to spawn its own subagents
 * - Each task goes through verify → plan → code phases
 *
 * This validates the workaround for Claude Code's "subagents cannot spawn subagents" limitation.
 *
 * IMPORTANT: This test spawns real Claude processes and incurs API costs.
 *
 * Run with: npm run test:integration
 */
import { describe, it, expect, beforeAll } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { runClaude } from "./helpers/claude-cli.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = resolve(__dirname, "../..");

describe("Marathon-Ralph Workflow (Nested + Sub-Sub-Agents)", () => {
  beforeAll(() => {
    console.log(`Plugin directory: ${PLUGIN_DIR}`);
    console.log("NOTE: This test spawns real Claude processes and incurs API costs.");
  });

  it("should complete multi-task workflow with verify/plan/code subagents", async () => {
    const testFile = "/tmp/nested-test-math-utils.ts";

    // Clean up any existing test file
    try {
      unlinkSync(testFile);
    } catch {
      // File might not exist
    }

    const result = await runClaude({
      prompt: `Build a TypeScript math utility via a nested subagent. The nested subagent should complete two tasks using its own subagents:
Task 1: add(a, b) function - use subagents for verify, plan, code
Task 2: multiply(a, b) function - use subagents for verify, plan, code
Write the final module to ${testFile}. Return a summary of completed tasks.`,
      model: "haiku",
      maxTurns: 15,
      dangerouslySkipPermissions: true,
      pluginDir: PLUGIN_DIR,
      timeout: 300000, // 5 minutes for full workflow
    });

    expect(result.exitCode).toBe(0);

    // Check that nested subagent was used
    const nestedCalls = result.toolUses.filter(
      (tu) =>
        tu.name === "mcp__plugin_nested_subagent__Task" ||
        tu.name.includes("nested") ||
        tu.name.includes("subagent")
    );
    expect(nestedCalls.length).toBeGreaterThan(0);

    // Verify the file was created with both functions
    const fileExists = existsSync(testFile);
    expect(fileExists).toBe(true);

    if (fileExists) {
      const content = readFileSync(testFile, "utf-8");
      expect(content).toContain("add");
      expect(content).toContain("multiply");
      console.log(`Generated file content:\n${content}`);
    }

    console.log(`Marathon workflow completed in ${result.duration}ms`);
    console.log(`Nested subagent calls: ${nestedCalls.length}`);
    console.log(`Total tool uses: ${result.toolUses.length}`);
  });
});
