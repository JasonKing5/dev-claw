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

/** A tool_use block extracted from Claude's response */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** Result of executing a tool, fed back to Claude */
export interface ToolResult {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

/** Approval rule configuration */
export interface ApprovalRules {
  /** blacklist = listed patterns need approval; whitelist = only listed patterns are auto-approved */
  mode: "blacklist" | "whitelist";
  /** Tool name patterns (supports simple glob: * matches any chars) */
  patterns: string[];
}

/** Pending approval request in the queue */
export interface ApprovalRequest {
  id: string;
  userId: string;
  chatId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  resolve: (approved: boolean) => void;
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
  // Approval
  approvalRules: ApprovalRules;
}
