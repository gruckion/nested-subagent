/**
 * Integration tests for the nested-subagent plugin
 *
 * These tests verify that:
 * 1. Direct CLI execution works (baseline)
 * 2. Native Task tool subagent works
 * 3. Nested subagent (via plugin MCP tool) works - subagent spawns its own subagent
 *
 * IMPORTANT: These tests spawn real Claude processes and incur API costs.
 * Use sparingly and set appropriate max-turns limits.
 *
 * Run with: npm run test:integration
 */
import { describe, it, expect, beforeAll } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  runClaude,
  wasToolUsed,
  stdoutContains,
  type ClaudeResult,
} from "./helpers/claude-cli.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = resolve(__dirname, "../..");

// Test configuration
const TEST_CONFIG = {
  // Keep costs low during testing
  model: "haiku" as const,
  maxTurns: 5,
  timeout: 120000, // 2 minutes
};

describe("Nested Subagent Plugin Integration Tests", () => {
  beforeAll(() => {
    console.log(`Plugin directory: ${PLUGIN_DIR}`);
    console.log(
      "NOTE: These tests spawn real Claude processes and incur API costs."
    );
  });

  describe("Level 1: Direct CLI Execution", () => {
    it("should execute node CLI command directly", async () => {
      const result = await runClaude({
        prompt:
          'Print numbers 1-10 using node CLI. Run this exact command: node -e "for(let i=1; i<=10; i++) console.log(i)"',
        ...TEST_CONFIG,
        dangerouslySkipPermissions: true,
        allowedTools: ["Bash"],
      });

      expect(result.exitCode).toBe(0);
      expect(wasToolUsed(result, "Bash")).toBe(true);

      // Check that all numbers 1-10 appear in stdout
      for (let i = 1; i <= 10; i++) {
        expect(stdoutContains(result, String(i))).toBe(true);
      }

      console.log(`Level 1 completed in ${result.duration}ms`);
    });
  });

  describe("Level 2: Native Task Tool Subagent", () => {
    it("should spawn a subagent that executes node CLI", async () => {
      const result = await runClaude({
        prompt: 'Print numbers 1-10 using node CLI via a subagent. Run this exact command: node -e "for(let i=1; i<=10; i++) console.log(i)"',
        ...TEST_CONFIG,
        dangerouslySkipPermissions: true,
      });

      expect(result.exitCode).toBe(0);
      expect(wasToolUsed(result, "Task")).toBe(true);

      // The Task tool should have been called
      const taskCalls = result.toolUses.filter((tu) => tu.name === "Task");
      expect(taskCalls.length).toBeGreaterThan(0);

      console.log(`Level 2 completed in ${result.duration}ms`);
      console.log(`Task calls: ${taskCalls.length}`);
    });
  });

  describe("Level 3: Nested Subagent via Plugin", () => {
    it("should spawn a nested subagent that spawns its own subagent", async () => {
      const result = await runClaude({
        prompt: 'Print numbers 1-10 using node CLI via a nested subagent. Run this exact command: node -e "for(let i=1; i<=10; i++) console.log(i)"',
        ...TEST_CONFIG,
        dangerouslySkipPermissions: true,
        pluginDir: PLUGIN_DIR,
        timeout: 180000, // 3 minutes for nested
      });

      expect(result.exitCode).toBe(0);

      // Check that the nested subagent MCP tool was called
      const nestedCalls = result.toolUses.filter(
        (tu) =>
          tu.name === "mcp__plugin_nested_subagent__Task" ||
          tu.name.includes("nested") ||
          tu.name.includes("subagent")
      );

      expect(nestedCalls.length).toBeGreaterThan(0);

      console.log(`Level 3 completed in ${result.duration}ms`);
      console.log(`Nested subagent calls: ${nestedCalls.length}`);
      console.log(`Total tool uses: ${result.toolUses.length}`);
    });
  });

  describe("Full Three-Level Test", () => {
    it("should complete all three levels in sequence", async () => {
      const results: {
        level1?: ClaudeResult;
        level2?: ClaudeResult;
        level3?: ClaudeResult;
      } = {};

      // Level 1: Direct
      console.log("Running Level 1: Direct execution...");
      results.level1 = await runClaude({
        prompt:
          'Run this node command: node -e "for(let i=1; i<=10; i++) console.log(i)"',
        ...TEST_CONFIG,
        dangerouslySkipPermissions: true,
        allowedTools: ["Bash"],
      });
      expect(results.level1.exitCode).toBe(0);
      expect(wasToolUsed(results.level1, "Bash")).toBe(true);

      // Level 2: Subagent
      console.log("Running Level 2: Subagent...");
      results.level2 = await runClaude({
        prompt: 'Print numbers 1-10 using node CLI via a subagent. Run this exact command: node -e "for(let i=1; i<=10; i++) console.log(i)"',
        ...TEST_CONFIG,
        dangerouslySkipPermissions: true,
      });
      expect(results.level2.exitCode).toBe(0);
      expect(wasToolUsed(results.level2, "Task")).toBe(true);

      // Level 3: Nested subagent
      console.log("Running Level 3: Nested subagent...");
      results.level3 = await runClaude({
        prompt: 'Print numbers 1-10 using node CLI via a nested subagent. Run this exact command: node -e "for(let i=1; i<=10; i++) console.log(i)"',
        ...TEST_CONFIG,
        dangerouslySkipPermissions: true,
        pluginDir: PLUGIN_DIR,
        timeout: 180000,
      });
      expect(results.level3.exitCode).toBe(0);

      // Summary
      console.log("\n=== Test Summary ===");
      console.log(`Level 1 (Direct): ${results.level1.duration}ms`);
      console.log(`Level 2 (Subagent): ${results.level2.duration}ms`);
      console.log(`Level 3 (Nested): ${results.level3.duration}ms`);
      console.log(
        `Total time: ${results.level1.duration +
        results.level2.duration +
        results.level3.duration
        }ms`
      );
    });
  });
});
