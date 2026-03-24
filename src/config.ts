import { readFileSync, existsSync } from "node:fs";
import type { AppConfig, McpServerConfig } from "./types.js";

function loadMcpConfig(path: string): Record<string, McpServerConfig> {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as Record<string, McpServerConfig>;
}

export function loadConfig(): AppConfig {
  const env = process.env;

  const aiApiKey = env.ANTHROPIC_API_KEY;
  if (!aiApiKey) {
    throw new Error("ANTHROPIC_API_KEY is required");
  }

  const aiProvider = (env.AI_PROVIDER || "anthropic") as "anthropic" | "openai";
  if (aiProvider !== "anthropic" && aiProvider !== "openai") {
    throw new Error(`AI_PROVIDER must be "anthropic" or "openai", got "${aiProvider}"`);
  }

  return {
    tgBotToken: env.TG_BOT_TOKEN || undefined,
    tgProxyUrl: env.TG_PROXY_URL || undefined,
    feishuAppId: env.FEISHU_APP_ID || undefined,
    feishuAppSecret: env.FEISHU_APP_SECRET || undefined,
    allowedUsers: new Set(
      (env.ALLOWED_USERS || "").split(",").map((s) => s.trim()).filter(Boolean)
    ),
    aiProvider,
    aiApiKey,
    aiBaseUrl: env.ANTHROPIC_BASE_URL || undefined,
    claudeModel: env.CLAUDE_MODEL || "claude-sonnet-4-5-20250514",
    claudeDeepModel: env.CLAUDE_DEEP_MODEL || "claude-opus-4-6-20250925",
    dbPath: env.DB_PATH || ".devclaw/memory.db",
    contextWindow: Number.parseInt(env.CONTEXT_WINDOW || "10", 10),
    mcpServers: loadMcpConfig(".devclaw/mcp_config.json"),
  };
}
