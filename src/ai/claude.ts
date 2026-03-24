import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { AppConfig, ChatMessage, ToolCall } from "../types.js";

let anthropicClient: Anthropic | undefined;
let openaiClient: OpenAI | undefined;
let provider: "anthropic" | "openai";

const MAX_ITERATIONS = 20;

export function initClaude(config: AppConfig): void {
  provider = config.aiProvider;

  if (provider === "anthropic") {
    anthropicClient = new Anthropic({
      apiKey: config.aiApiKey,
      baseURL: config.aiBaseUrl,
    });
  } else {
    openaiClient = new OpenAI({
      apiKey: config.aiApiKey,
      baseURL: config.aiBaseUrl,
    });
  }
}

export interface AgenticLoopOptions {
  history: ChatMessage[];
  model: string;
  tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>;
  /** System prompt describing agent capabilities and available tools */
  systemPrompt?: string;
  /** Called for each tool_use block. Returns the text result or throws on error. */
  executeTool: (tool: ToolCall) => Promise<string>;
  /** Called to send intermediate status messages to the user */
  onStatus?: (text: string) => Promise<void>;
}

/**
 * Core agentic loop: calls Claude, executes tools, feeds results back, repeats.
 * Returns the final text response when Claude stops calling tools.
 */
export async function agenticLoop(opts: AgenticLoopOptions): Promise<string> {
  if (provider === "anthropic") {
    return anthropicAgenticLoop(opts);
  }
  return openaiAgenticLoop(opts);
}

async function anthropicAgenticLoop(opts: AgenticLoopOptions): Promise<string> {
  const { model, tools, systemPrompt, executeTool, onStatus } = opts;

  // Build messages array from history
  const messages: Anthropic.MessageParam[] = opts.history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await anthropicClient!.messages.create({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages,
      tools: tools.length > 0 ? tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool.InputSchema,
      })) : undefined,
    });

    // If no tool_use, extract final text and return
    if (response.stop_reason !== "tool_use") {
      const textBlocks = response.content.filter((b) => b.type === "text");
      return textBlocks.map((b) => (b as Anthropic.TextBlock).text).join("\n");
    }

    // Extract tool_use blocks
    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use") as Anthropic.ToolUseBlock[];

    // Append assistant message with full content (text + tool_use blocks)
    messages.push({ role: "assistant", content: response.content });

    // Execute each tool and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      const toolCall: ToolCall = {
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
      };

      await onStatus?.(`Executing tool: \`${block.name}\``);

      try {
        const result = await executeTool(toolCall);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Error: ${errorMsg}`,
          is_error: true,
        });
      }
    }

    // Append tool results as user message
    messages.push({ role: "user", content: toolResults });
  }

  return "Reached maximum iteration limit. The task may be incomplete.";
}

async function openaiAgenticLoop(opts: AgenticLoopOptions): Promise<string> {
  const { model, tools, systemPrompt, executeTool, onStatus } = opts;

  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push(...opts.history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  })));

  const openaiTools: OpenAI.ChatCompletionTool[] | undefined = tools.length > 0
    ? tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }))
    : undefined;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await openaiClient!.chat.completions.create({
      model,
      max_tokens: 8192,
      messages,
      tools: openaiTools,
    });

    const choice = response.choices[0];
    if (!choice) return "";

    const msg = choice.message;
    messages.push(msg);

    if (choice.finish_reason !== "tool_calls" || !msg.tool_calls?.length) {
      return msg.content ?? "";
    }

    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;
      const fn = tc.function;
      const toolCall: ToolCall = {
        id: tc.id,
        name: fn.name,
        input: JSON.parse(fn.arguments || "{}"),
      };

      await onStatus?.(`Executing tool: \`${fn.name}\``);

      let result: string;
      try {
        result = await executeTool(toolCall);
      } catch (err) {
        result = `Error: ${err instanceof Error ? err.message : String(err)}`;
      }

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }
  }

  return "Reached maximum iteration limit. The task may be incomplete.";
}
