/**
 * Level 0: Verify the fallback-agent MCP server is installed and available
 */
import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runClaude, wasToolUsed } from "./helpers/claude-cli.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = resolve(__dirname, "../..");

describe("Level 0: MCP Server Installation", () => {
  it("should have the fallback-agent MCP tool available", async () => {
    const result = await runClaude({
      prompt:
        "List your available tools. Do you have a tool called mcp__plugin_fallback_agent__Task or similar? Just answer yes or no.",
      model: "haiku",
      maxTurns: 1,
      timeout: 30000,
      pluginDir: PLUGIN_DIR,
    });

    expect(result.exitCode).toBe(0);

    // Check the response mentions the tool is available
    const textResponses = result.messages
      .filter((m) => m.type === "assistant" && m.message?.content)
      .flatMap((m) =>
        m.message!.content.filter((c) => c.type === "text").map((c) => c.text)
      );

    const responseText = textResponses.join(" ").toLowerCase();
    expect(responseText).toMatch(/yes/i);
  });
});
