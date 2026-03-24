# DevClaw

Lightweight AI agent daemon for local dev machines, controlled remotely via Telegram or Feishu (Lark).

> Zero inbound connections. Zero custom plugins. 100% MCP native.

## Features

- **Zero Inbound Network** — Uses long-polling (Telegram) and WebSocket (Feishu) only. No webhooks, no ngrok, no public IP required. Just `pnpm dev` and go.
- **MCP Native** — All local actions (file editing, DB queries, Git operations) are delegated to standard [MCP Servers](https://modelcontextprotocol.io). Reuse the same servers you already run with Claude Code or Cursor.
- **Low Token Footprint** — SQLite sliding-window memory replaces megaprompts. Only the last N messages are sent to the model.
- **Dual Model Routing** — Claude Sonnet 4.5 for daily fast responses, Claude Opus 4.6 for deep reasoning (triggered via `/opus` command).
- **User Whitelist** — Only allowed user IDs can interact with the bot. Your local machine stays safe.

## Architecture

```
  Telegram / Feishu App (mobile)
             |
    (outbound long connection)
             |
  +----------v-----------+
  |   Gateway Layer       |  grammY (TG) / Lark WS Client (Feishu)
  +----------+-----------+
             | unified Message
  +----------v-----------+
  |   Core Engine         |  Auth Guard + SQLite Session Manager
  +----------+-----------+
             |
  +----------v-----------+
  |   AI Routing Layer    |  @anthropic-ai/sdk (Claude)
  +----------+-----------+
             |
  +----------v-----------+
  |   MCP Execution Layer |  @modelcontextprotocol/sdk Client
  +----+------------+----+
       |            |
  [FS MCP]    [Postgres MCP]   ... (any MCP server)
```

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** (recommended) — `npm install -g pnpm`

## Quick Start

### 1. Install

```bash
git clone https://github.com/your-username/dev-claw.git
cd dev-claw
pnpm install
```

### 2. Configure

Copy the example env file:

```bash
cp .env.example .env
```

You only need to fill in **3 fields** to get started. Pick your IM platform:

<details>
<summary><b>Option A: Telegram only</b></summary>

```env
# Get a token from @BotFather on Telegram
TG_BOT_TOKEN=123456:ABC-DEF...

# Your Telegram numeric user ID (send /start to @userinfobot to find it)
ALLOWED_USERS=123456789

# Anthropic API key (https://console.anthropic.com)
ANTHROPIC_API_KEY=sk-ant-...
```

</details>

<details>
<summary><b>Option B: Feishu (Lark) only</b></summary>

```env
# Create an app at https://open.feishu.cn and enable "Receive events via WebSocket"
FEISHU_APP_ID=cli_xxxxx
FEISHU_APP_SECRET=xxxxx

# Your Feishu open_id
ALLOWED_USERS=ou_xxxxx

# Anthropic API key (https://console.anthropic.com)
ANTHROPIC_API_KEY=sk-ant-...
```

</details>

### 3. Run

```bash
pnpm dev
```

That's it. Send a message to your bot and get a response from Claude.

## Full Configuration

All configuration is done via environment variables in `.env`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `TG_BOT_TOKEN` | No* | — | Telegram bot token from @BotFather |
| `TG_PROXY_URL` | No | — | HTTP proxy for Telegram API (e.g. `http://127.0.0.1:7890`) |
| `FEISHU_APP_ID` | No* | — | Feishu app ID |
| `FEISHU_APP_SECRET` | No* | — | Feishu app secret |
| `ALLOWED_USERS` | Yes | — | Comma-separated list of allowed user IDs |
| `AI_PROVIDER` | No | `anthropic` | SDK format: `anthropic` (native) or `openai` (LiteLLM, OpenRouter, etc.) |
| `ANTHROPIC_API_KEY` | Yes | — | API key (works for both providers) |
| `ANTHROPIC_BASE_URL` | No | — | API base URL for third-party proxies |
| `CLAUDE_MODEL` | No | `claude-sonnet-4-5-20250514` | Default model for daily use |
| `CLAUDE_DEEP_MODEL` | No | `claude-opus-4-6-20250925` | Deep reasoning model (used with `/opus`) |
| `DB_PATH` | No | `.devclaw/memory.db` | SQLite database file path |
| `CONTEXT_WINDOW` | No | `10` | Number of recent messages to include in context |

> \* At least one IM platform (Telegram or Feishu) must be configured.

### Using a Third-Party API Proxy

If you're using an OpenAI-compatible proxy (LiteLLM, OpenRouter, etc.), set `AI_PROVIDER=openai` and point `ANTHROPIC_BASE_URL` to your proxy:

```env
AI_PROVIDER=openai
ANTHROPIC_BASE_URL=http://localhost:4000/v1
ANTHROPIC_API_KEY=your-proxy-key
```

For Anthropic-compatible proxies, keep the default `AI_PROVIDER=anthropic` and just set `ANTHROPIC_BASE_URL`.

## MCP Configuration

DevClaw reads MCP server definitions from `.devclaw/mcp_config.json`. This file maps server names to the commands used to launch them:

```json
{
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/projects"]
  },
  "postgres": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-postgres"],
    "env": {
      "DATABASE_URL": "postgresql://localhost:5432/mydb"
    }
  }
}
```

Each server is connected via stdio at startup. You can use any MCP-compatible server — the same ones that work with Claude Code, Cursor, or any MCP client.

## Bot Commands

| Command | Description |
|---|---|
| `/clear` | Clear conversation history for the current user |
| `/opus <message>` | Send a message using the deep reasoning model (Opus) |

Any other text is sent to the default model (Sonnet).

## Production Deployment

### Build and run with Node.js

```bash
pnpm build
pnpm start
```

### Run as a background daemon (pm2)

```bash
# Install pm2 globally if you haven't
npm install -g pm2

# Start the daemon
pnpm daemon

# View logs
pnpm daemon:logs

# Stop
pnpm daemon:stop
```

## Project Structure

```
src/
  index.ts              # Entry point — boots all layers, wires message flow
  config.ts             # Reads .env + .devclaw/mcp_config.json
  types.ts              # Shared interfaces (Message, ChatMessage, AppConfig)
  gateway/
    telegram.ts         # grammY long-polling adapter
    feishu.ts           # Feishu/Lark WebSocket adapter
  core/
    auth.ts             # User whitelist guard
    session.ts          # SQLite session manager (sliding window)
  ai/
    claude.ts           # Anthropic SDK client with model routing
  mcp/
    client.ts           # MCP client manager (stdio transport)
```

## License

[MIT](LICENSE)
