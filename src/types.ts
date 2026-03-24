/** Supported IM platforms */
export type Platform = "telegram" | "feishu";

/** Unified message from any IM gateway */
export interface Message {
  platform: Platform;
  userId: string;
  chatId: string;
  text: string;
  /** Send a reply back to the original chat */
  reply: (text: string) => Promise<void>;
}

/** A single chat message stored in SQLite */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** MCP server definition from .devclaw/mcp_config.json */
export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/** Top-level app configuration */
export interface AppConfig {
  // Telegram
  tgBotToken?: string;
  tgProxyUrl?: string;
  // Feishu
  feishuAppId?: string;
  feishuAppSecret?: string;
  // Auth
  allowedUsers: Set<string>;
  // AI
  aiProvider: "anthropic" | "openai";
  aiApiKey: string;
  aiBaseUrl?: string;
  claudeModel: string;
  claudeDeepModel: string;
  // Database
  dbPath: string;
  contextWindow: number;
  // MCP
  mcpServers: Record<string, McpServerConfig>;
}
