import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { AppConfig, ChatMessage } from "../types.js";

let anthropicClient: Anthropic | undefined;
let openaiClient: OpenAI | undefined;
let provider: "anthropic" | "openai";

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

export async function chat(
  history: ChatMessage[],
  model: string,
  _mcpTools?: unknown[]
): Promise<string> {
  if (provider === "anthropic") {
    const response = await anthropicClient!.messages.create({
      model,
      max_tokens: 4096,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    });
    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock ? textBlock.text : "";
  } else {
    const response = await openaiClient!.chat.completions.create({
      model,
      max_tokens: 4096,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    });
    return response.choices[0]?.message?.content ?? "";
  }
}
