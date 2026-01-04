/**
 * Helper utilities for testing Claude CLI integration
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";

export interface StreamMessage {
  type: "system" | "assistant" | "user" | "result";
  subtype?: string;
  session_id?: string;
  message?: {
    content: Array<{
      type: "text" | "tool_use" | "tool_result";
      text?: string;
      name?: string;
      input?: Record<string, unknown>;
      content?: string;
    }>;
  };
  result?: string;
  total_cost_usd?: number;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  tool_use_result?: {
    stdout?: string;
    stderr?: string;
  };
}

export interface ClaudeResult {
  messages: StreamMessage[];
  result: StreamMessage | null;
  toolUses: Array<{ name: string; input: Record<string, unknown> }>;
  toolResults: Array<{ stdout?: string; stderr?: string }>;
  exitCode: number | null;
  duration: number;
}

export interface ClaudeOptions {
  prompt: string;
  model?: "sonnet" | "opus" | "haiku";
  maxTurns?: number;
  timeout?: number;
  workingDir?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  dangerouslySkipPermissions?: boolean;
  pluginDir?: string;
}

/**
 * Spawn a Claude CLI process with streaming JSON output and collect results
 */
export async function runClaude(options: ClaudeOptions): Promise<ClaudeResult> {
  const {
    prompt,
    model = "sonnet",
    maxTurns = 5,
    timeout = 60000,
    workingDir = process.cwd(),
    allowedTools,
    disallowedTools,
    dangerouslySkipPermissions = false,
    pluginDir,
  } = options;

  const args = [
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    model,
    "--max-turns",
    String(maxTurns),
  ];

  if (dangerouslySkipPermissions) {
    args.push("--dangerously-skip-permissions");
  }

  if (allowedTools?.length) {
    args.push("--allowed-tools", allowedTools.join(","));
  }

  if (disallowedTools?.length) {
    args.push("--disallowed-tools", disallowedTools.join(","));
  }

  if (pluginDir) {
    args.push("--plugin-dir", pluginDir);
  }

  const startTime = Date.now();
  const messages: StreamMessage[] = [];
  const toolUses: ClaudeResult["toolUses"] = [];
  const toolResults: ClaudeResult["toolResults"] = [];
  let result: StreamMessage | null = null;

  return new Promise((resolve, reject) => {
    const proc: ChildProcess = spawn("claude", args, {
      cwd: workingDir,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Close stdin immediately - claude -p doesn't need it
    proc.stdin?.end();

    const timeoutId = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`Claude process timed out after ${timeout}ms`));
    }, timeout);

    const rl = createInterface({ input: proc.stdout! });

    rl.on("line", (line) => {
      if (!line.trim()) return;

      try {
        const msg: StreamMessage = JSON.parse(line);
        messages.push(msg);

        // Extract tool uses
        if (msg.type === "assistant" && msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === "tool_use" && block.name) {
              toolUses.push({
                name: block.name,
                input: block.input || {},
              });
            }
          }
        }

        // Extract tool results
        if (msg.type === "user" && msg.tool_use_result) {
          toolResults.push(msg.tool_use_result);
        }

        // Capture final result
        if (msg.type === "result") {
          result = msg;
        }
      } catch {
        // Ignore non-JSON lines (e.g., stderr leaking to stdout)
      }
    });

    let stderrOutput = "";
    proc.stderr?.on("data", (data) => {
      stderrOutput += data.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      resolve({
        messages,
        result,
        toolUses,
        toolResults,
        exitCode: code,
        duration,
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

/**
 * Extract text responses from Claude messages
 */
export function extractTextResponses(messages: StreamMessage[]): string[] {
  const texts: string[] = [];

  for (const msg of messages) {
    if (msg.type === "assistant" && msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === "text" && block.text) {
          texts.push(block.text);
        }
      }
    }
  }

  return texts;
}

/**
 * Check if a specific tool was used
 */
export function wasToolUsed(
  result: ClaudeResult,
  toolName: string
): boolean {
  return result.toolUses.some((tu) => tu.name === toolName);
}

/**
 * Get all uses of a specific tool
 */
export function getToolUses(
  result: ClaudeResult,
  toolName: string
): Array<Record<string, unknown>> {
  return result.toolUses
    .filter((tu) => tu.name === toolName)
    .map((tu) => tu.input);
}

/**
 * Check if stdout contains expected content
 */
export function stdoutContains(result: ClaudeResult, expected: string): boolean {
  return result.toolResults.some(
    (tr) => tr.stdout?.includes(expected) ?? false
  );
}
