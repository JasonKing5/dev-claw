import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { AppConfig, McpServerConfig, ApprovalRules } from "./types.js";

/** Built-in defaults: filesystem server for local file access */
const BUILTIN_SERVERS: Record<string, McpServerConfig> = {
  "devclaw-filesystem": {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/"],
  },
};

function loadStdioServersFromClaudeJson(): Record<string, McpServerConfig> {
  const claudeJsonPath = join(homedir(), ".claude.json");
  if (!existsSync(claudeJsonPath)) return {};

  try {
    const raw = readFileSync(claudeJsonPath, "utf-8");
    const claudeConfig = JSON.parse(raw) as {
      mcpServers?: Record<string, McpServerConfig & { type?: string }>;
    };
    if (!claudeConfig.mcpServers) return {};

    const stdioServers: Record<string, McpServerConfig> = {};
    for (const [name, cfg] of Object.entries(claudeConfig.mcpServers)) {
      if (cfg.type && cfg.type !== "stdio") {
        console.warn(`[Config] Skipping non-stdio server "${name}" (type: ${cfg.type})`);
        continue;
      }
      if (!cfg.command) {
        console.warn(`[Config] Skipping server "${name}" (no command field)`);
        continue;
      }
      stdioServers[name] = { command: cfg.command, args: cfg.args, env: cfg.env };
    }
    console.log(`[Config] Loaded ${Object.keys(stdioServers).length} stdio MCP servers from ${claudeJsonPath}`);
    return stdioServers;
  } catch {
    console.warn(`[Config] Failed to parse ${claudeJsonPath}, skipping`);
    return {};
  }
}

function loadLocalMcpConfig(): Record<string, McpServerConfig> {
  const localPath = ".devclaw/mcp_config.json";
  if (!existsSync(localPath)) return {};
  try {
    const raw = readFileSync(localPath, "utf-8");
    return JSON.parse(raw) as Record<string, McpServerConfig>;
  } catch {
    return {};
  }
}

function loadMcpServers(): Record<string, McpServerConfig> {
  // Merge all sources: defaults < global (~/.claude.json) < local (.devclaw/)
  const merged: Record<string, McpServerConfig> = {
    ...BUILTIN_SERVERS,
    ...loadStdioServersFromClaudeJson(),
    ...loadLocalMcpConfig(),
  };

  // Remove entries with empty/missing command (allows local config to disable a server)
  for (const [name, cfg] of Object.entries(merged)) {
    if (!cfg.command) {
      delete merged[name];
    }
  }

  console.log(`[Config] Final MCP servers: ${Object.keys(merged).join(", ") || "(none)"}`);
  return merged;
}

const DEFAULT_BLACKLIST_PATTERNS = [
  "bash*", "shell*", "exec*", "run_command*",
  "*delete*", "*remove*", "*rm_*",
  "*push*", "*deploy*", "*install*",
];

function loadApprovalRules(env: NodeJS.ProcessEnv): ApprovalRules {
  const mode = (env.APPROVAL_MODE || "blacklist") as "blacklist" | "whitelist";
  if (mode !== "blacklist" && mode !== "whitelist") {
    throw new Error(`APPROVAL_MODE must be "blacklist" or "whitelist", got "${mode}"`);
  }
  const patterns = env.APPROVAL_PATTERNS
    ? env.APPROVAL_PATTERNS.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_BLACKLIST_PATTERNS;
  return { mode, patterns };
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
    mcpServers: loadMcpServers(),
    approvalRules: loadApprovalRules(env),
  };
}
