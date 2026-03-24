# DevClaw Project Guidelines

Hello! You are an expert Node.js/TypeScript architect helping me build **DevClaw**.
DevClaw is an autonomous, headless coding agent daemon that runs on my local Mac, controlled remotely via Telegram/Feishu, and driven by Claude 4.5/4.6 + MCP ecosystem.

**CRITICAL DOCS TO READ FIRST:**
- Requirements: `cat docs/PRD.md`
- Architecture & The Loop: `cat docs/ARCHITECTURE.md`

## ⛔ Strict Anti-Patterns (DO NOT DO THIS)
1. **NO Webhooks**: Do NOT write Express/Koa servers for IM. Use `grammY` long-polling for Telegram and `@larksuiteoapi/node-sdk` WSClient for Feishu. We must bypass NAT entirely using outbound connections.
2. **NO Custom Plugin Systems**: Do NOT write custom code to execute shell commands or read files. DevClaw is an MCP Client. We MUST parse the user's existing `~/.claude.json` config and connect to those existing MCP servers via `StdioClientTransport`.
3. **NO Single-Turn Logic**: Do NOT treat this as a simple Chatbot. The core engine MUST be an `Agentic Loop` (a `while` loop that keeps feeding `tool_result` back to Claude until `stop_reason` is not `tool_use`).

## 🛠️ Key Architectural Patterns
1. **Human-in-the-Loop (Interactive Approval)**: 
   When writing the Tool Executor, implement a Promise-based suspension mechanism. If a high-risk MCP tool (like executing a bash command) is called, the loop must PAUSE, send a button-card to Telegram/Feishu, and WAIT for the user's callback query to resolve or reject the Promise before executing the tool.
2. **Token Economy**:
   Use `better-sqlite3` to store message history. The `SessionManager` should only fetch the last N messages (Sliding Window) to feed into the Anthropic API to avoid context bloat.

## 🚀 Recommended Tech Stack
- Typescript (ESM), `tsx` for execution.
- `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, `grammY`, `better-sqlite3`.
- For TG in mainland China, ensure `https-proxy-agent` support is configurable via `.env`.

When implementing a feature, think about the "Asynchronous Co-worker" mindset. The code should be robust, handle errors gracefully within the Agentic Loop (feed errors back to Claude so it can self-correct), and minimize blocking the main thread.

## MCP Server Configuration

DevClaw gains its capabilities (file operations, shell access, browser control, etc.) by connecting to **stdio MCP servers** — the same ones used by Claude Code and Cursor.

### Config Priority
1. **Project-local**: `.devclaw/mcp_config.json` (highest priority)
2. **Global**: `~/.claude.json` → `mcpServers` section (auto-inherited from Claude Code)

If neither exists, DevClaw starts with no tools (pure chat mode).

> **Note**: Only `stdio` transport servers are supported. HTTP/SSE servers in `~/.claude.json` are automatically skipped with a warning.

### Example `.devclaw/mcp_config.json`
```json
{
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/you/projects"]
  },
  "playwright": {
    "command": "npx",
    "args": ["-y", "@playwright/mcp@latest"]
  }
}
```

### Recommended MCP Servers

| Capability | Package | Description |
| :--- | :--- | :--- |
| File System | `@modelcontextprotocol/server-filesystem` | Read/write/search local files |
| Browser | `@playwright/mcp` | Automate browser interactions |
| PostgreSQL | `@modelcontextprotocol/server-postgres` | Query databases |
| GitHub | `@modelcontextprotocol/server-github` | Manage repos, PRs, issues |