import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { AppConfig, McpServerConfig } from "../types.js";

const clients = new Map<string, Client>();

/** Maps tool name → server name for fast lookup */
const toolServerMap = new Map<string, string>();

/** Cached tools in Anthropic API format */
let cachedTools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }> = [];

export async function initMcpClients(config: AppConfig): Promise<void> {
  for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
    try {
      const client = await connectServer(name, serverConfig);
      clients.set(name, client);
    } catch (err) {
      console.warn(`[MCP] Failed to connect to server "${name}", skipping:`, (err as Error).message);
    }
  }
  // Cache all tools after connecting
  await refreshToolCache();
}

async function connectServer(name: string, config: McpServerConfig): Promise<Client> {
  if (!config.command) {
    throw new Error(`No command field (only stdio servers are supported)`);
  }

  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: config.env,
  });

  const client = new Client({ name: `devclaw-${name}`, version: "0.1.0" });
  await client.connect(transport);
  console.log(`[MCP] Connected to server: ${name}`);
  return client;
}

async function refreshToolCache(): Promise<void> {
  cachedTools = [];
  toolServerMap.clear();

  for (const [serverName, client] of clients) {
    try {
      const result = await client.listTools();
      for (const t of result.tools) {
        toolServerMap.set(t.name, serverName);
        cachedTools.push({
          name: t.name,
          description: t.description ?? "",
          input_schema: t.inputSchema as Record<string, unknown>,
        });
      }
    } catch (err) {
      console.warn(`[MCP] Failed to list tools from "${serverName}":`, (err as Error).message);
    }
  }

  console.log(`[MCP] Cached ${cachedTools.length} tools from ${clients.size} servers`);
}

/** Returns tools in Anthropic API format for passing to messages.create() */
export function getToolsForApi(): Array<{ name: string; description: string; input_schema: Record<string, unknown> }> {
  return cachedTools;
}

/** Generate a system prompt that tells Claude about its available tools and capabilities */
export function getSystemPrompt(): string {
  const toolNames = cachedTools.map((t) => t.name);
  if (toolNames.length === 0) {
    return "You are DevClaw, an AI assistant. No tools are currently available.";
  }
  return [
    "You are DevClaw, an autonomous development agent running on the user's local machine.",
    "You have direct access to the local filesystem and development tools via MCP servers.",
    `Available tools (${toolNames.length}): ${toolNames.join(", ")}`,
    "",
    "When the user asks you to create files, read code, run commands, or perform any local operation,",
    "use the appropriate tool. Do NOT tell the user you cannot access their filesystem — you CAN.",
  ].join("\n");
}

/** Execute a tool by name, routing to the correct MCP server */
export async function callTool(toolName: string, args: Record<string, unknown>): Promise<string> {
  const serverName = toolServerMap.get(toolName);
  if (!serverName) {
    throw new Error(`Tool not found: ${toolName}`);
  }

  const client = clients.get(serverName);
  if (!client) {
    throw new Error(`Server not found for tool: ${toolName}`);
  }

  const result = await client.callTool({ name: toolName, arguments: args });

  // Extract text content from MCP result
  if (Array.isArray(result.content)) {
    return result.content
      .map((block) => {
        if (typeof block === "object" && block !== null && "text" in block) {
          return (block as { text: string }).text;
        }
        return JSON.stringify(block);
      })
      .join("\n");
  }

  return typeof result.content === "string" ? result.content : JSON.stringify(result.content);
}
