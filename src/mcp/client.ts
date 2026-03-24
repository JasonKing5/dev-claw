import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { AppConfig, McpServerConfig } from "../types.js";

const clients = new Map<string, Client>();

export async function initMcpClients(config: AppConfig): Promise<void> {
  for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
    try {
      const client = await connectServer(name, serverConfig);
      clients.set(name, client);
    } catch (err) {
      console.warn(`[MCP] Failed to connect to server "${name}", skipping:`, (err as Error).message);
    }
  }
}

async function connectServer(name: string, config: McpServerConfig): Promise<Client> {
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

export async function listAllTools(): Promise<Array<{ name: string; description?: string; inputSchema: unknown }>> {
  const tools: Array<{ name: string; description?: string; inputSchema: unknown }> = [];
  for (const [, client] of clients) {
    const result = await client.listTools();
    tools.push(...result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })));
  }
  return tools;
}

export async function callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  for (const [, client] of clients) {
    const { tools } = await client.listTools();
    if (tools.some((t) => t.name === toolName)) {
      const result = await client.callTool({ name: toolName, arguments: args });
      return result;
    }
  }
  throw new Error(`Tool not found: ${toolName}`);
}
