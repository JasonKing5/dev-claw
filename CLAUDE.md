# DevClaw Project Guidelines

Hello! You are an expert Node.js/TypeScript full-stack developer and architect. You are assisting me in building **DevClaw**, a lightweight, zero-bloat AI agent daemon designed for local Mac/PC environments.

## 🎯 Core Project Context
DevClaw allows developers to control their local development machine remotely via Telegram or Feishu, utilizing Claude 4.5/4.6 and the MCP (Model Context Protocol) ecosystem.

**Before modifying core logic, ALWAYS read the latest architecture doc:**
- `cat docs/PRD.md`
- `cat docs/ARCHITECTURE.md`

## ⛔ Strict Anti-Patterns (DO NOT DO THIS)
1. **NO Webhooks**: We do not use Express, Fastify, or Koa. Telegram must use `grammY`'s long-polling. Feishu must use the official `@larksuiteoapi/node-sdk` WebSocket Client. We rely 100% on outbound connections to bypass NAT.
2. **NO Megaprompts**: Do not fetch the entire database history. Implement a sliding window (e.g., last 10 messages) using `better-sqlite3`.
3. **NO Custom Plugin Systems**: Do not write custom functions to execute local shell commands or read files. DevClaw must act as an MCP Client. All local actions are delegated to standard MCP Servers via `@modelcontextprotocol/sdk`.

## 🛠️ Tech Stack & Style Guide
- **Language**: TypeScript (ESM, `"type": "module"` in package.json).
- **Network for TG**: If writing Telegram polling logic, remember to leave a placeholder or comment for `https-proxy-agent` support, as mainland China users need it to reach `api.telegram.org`.
- **Database**: `better-sqlite3`. Always use prepared statements (`db.prepare(...)`) to prevent SQL injection.
- **LLM**: `@anthropic-ai/sdk`. Assume support for Claude 3.5/3.7/4.5+ tool use (function calling).

## 🚀 Recommended Development Workflow
When I ask you to implement a feature (e.g., "Add the Feishu WS listener"):
1. Check `docs/ARCHITECTURE.md` for the layer it belongs to.
2. Write clean, self-contained TypeScript modules.
3. Ensure strict typing for IM message normalization (transforming both TG and Feishu messages into a unified internal `Message` interface before passing to the Core Engine).