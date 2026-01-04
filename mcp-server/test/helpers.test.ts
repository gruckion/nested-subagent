/**
 * Unit tests for test helper utilities
 * These tests don't spawn Claude processes - they're free to run
 */
import { describe, it, expect } from "vitest";
import {
  extractTextResponses,
  wasToolUsed,
  getToolUses,
  stdoutContains,
  type ClaudeResult,
  type StreamMessage,
} from "./helpers/claude-cli.js";

describe("Test Helpers", () => {
  describe("extractTextResponses", () => {
    it("should extract text from assistant messages", () => {
      const messages: StreamMessage[] = [
        {
          type: "assistant",
          message: {
            content: [{ type: "text", text: "Hello world" }],
          },
        },
        {
          type: "assistant",
          message: {
            content: [
              { type: "text", text: "Second message" },
              { type: "tool_use", name: "Bash", input: {} },
            ],
          },
        },
      ];

      const texts = extractTextResponses(messages);
      expect(texts).toEqual(["Hello world", "Second message"]);
    });

    it("should return empty array for no text content", () => {
      const messages: StreamMessage[] = [
        {
          type: "assistant",
          message: {
            content: [{ type: "tool_use", name: "Bash", input: {} }],
          },
        },
      ];

      const texts = extractTextResponses(messages);
      expect(texts).toEqual([]);
    });
  });

  describe("wasToolUsed", () => {
    it("should detect when a tool was used", () => {
      const result: ClaudeResult = {
        messages: [],
        result: null,
        toolUses: [
          { name: "Bash", input: { command: "ls" } },
          { name: "Read", input: { path: "/tmp/test" } },
        ],
        toolResults: [],
        exitCode: 0,
        duration: 1000,
      };

      expect(wasToolUsed(result, "Bash")).toBe(true);
      expect(wasToolUsed(result, "Read")).toBe(true);
      expect(wasToolUsed(result, "Write")).toBe(false);
    });
  });

  describe("getToolUses", () => {
    it("should return all uses of a specific tool", () => {
      const result: ClaudeResult = {
        messages: [],
        result: null,
        toolUses: [
          { name: "Bash", input: { command: "ls" } },
          { name: "Bash", input: { command: "pwd" } },
          { name: "Read", input: { path: "/tmp/test" } },
        ],
        toolResults: [],
        exitCode: 0,
        duration: 1000,
      };

      const bashUses = getToolUses(result, "Bash");
      expect(bashUses).toHaveLength(2);
      expect(bashUses[0]).toEqual({ command: "ls" });
      expect(bashUses[1]).toEqual({ command: "pwd" });
    });
  });

  describe("stdoutContains", () => {
    it("should find content in stdout", () => {
      const result: ClaudeResult = {
        messages: [],
        result: null,
        toolUses: [],
        toolResults: [
          { stdout: "1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n" },
        ],
        exitCode: 0,
        duration: 1000,
      };

      expect(stdoutContains(result, "1")).toBe(true);
      expect(stdoutContains(result, "10")).toBe(true);
      expect(stdoutContains(result, "11")).toBe(false);
    });

    it("should handle multiple tool results", () => {
      const result: ClaudeResult = {
        messages: [],
        result: null,
        toolUses: [],
        toolResults: [
          { stdout: "first output" },
          { stdout: "second output" },
        ],
        exitCode: 0,
        duration: 1000,
      };

      expect(stdoutContains(result, "first")).toBe(true);
      expect(stdoutContains(result, "second")).toBe(true);
    });
  });
});
