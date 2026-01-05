/**
 * Integration tests for the fallback-agent plugin
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
    });
  });

  describe("Level 2: Native Task Tool Subagent", () => {
    it("should spawn a subagent that executes node CLI when plugin is present", async () => {
      const result = await runClaude({
        // Prompt should be written just like this
        prompt: 'Print numbers 1-10 using node CLI via a subagent. Run this exact command: node -e "for(let i=1; i<=10; i++) console.log(i)"',
        ...TEST_CONFIG,
        dangerouslySkipPermissions: true,
        // plugin must be loaded
        pluginDir: PLUGIN_DIR,
      });

      // Show text responses
      const textResponses = result.messages
        .filter(m => m.type === "assistant" && m.message?.content)
        .flatMap(m => m.message!.content.filter(c => c.type === "text").map(c => c.text));

      // Debug: show what tools were actually used
      console.log("Tools used:", result.toolUses.map(tu => tu.name));
      console.log("Text responses:", result.messages
        .filter(m => m.type === "assistant" && m.message?.content)
        .flatMap(m => m.message!.content.filter(c => c.type === "text").map(c => c.text)));

      expect(result.exitCode).toBe(0);
      expect(wasToolUsed(result, "Task")).toBe(true);

      // The Task tool should have been called
      const taskCalls = result.toolUses.filter((tu) => tu.name === "Task");
      expect(taskCalls.length).toBeGreaterThan(0);
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
          tu.name === "mcp__plugin_fallback_agent__Task" ||
          tu.name.includes("nested") ||
          tu.name.includes("subagent")
      );

      expect(nestedCalls.length).toBeGreaterThan(0);
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
      results.level2 = await runClaude({
        prompt: 'Print numbers 1-10 using node CLI via a subagent. Run this exact command: node -e "for(let i=1; i<=10; i++) console.log(i)"',
        ...TEST_CONFIG,
        dangerouslySkipPermissions: true,
        // Explicitly load the MCP tool to ensure native Task is used even when it is present
        pluginDir: PLUGIN_DIR,
      });
      expect(results.level2.exitCode).toBe(0);
      expect(wasToolUsed(results.level2, "Task")).toBe(true);

      // Level 3: Nested subagent
      results.level3 = await runClaude({
        prompt: 'Print numbers 1-10 using node CLI via a nested subagent. Run this exact command: node -e "for(let i=1; i<=10; i++) console.log(i)"',
        ...TEST_CONFIG,
        dangerouslySkipPermissions: true,
        pluginDir: PLUGIN_DIR,
        timeout: 180000,
      });
      expect(results.level3.exitCode).toBe(0);
    });
  });
});
