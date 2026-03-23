# DevClaw 技术架构文档 (2026 Edition)

## 1. 设计哲学 (Design Philosophy)
DevClaw 旨在为全栈开发者提供一个**无感知的本地后台守护进程 (CLI Daemon)**。
- **Zero Inbound**: 零入站网络要求。彻底抛弃 Webhook，无需公网 IP 和内网穿透工具。
- **MCP Native**: 不造轮子，无私有插件。所有针对本地宿主机（Mac/PC）的操作指令，全部通过官方标准 `@modelcontextprotocol/sdk` 路由给本地独立的 MCP Servers。
- **Low Token Footprint**: 告别巨型提示词（Megaprompt）。采用按需加载（Lazy Load）与 SQLite 滑动窗口记忆流，极致压降 Claude 4.5/4.6 的 API 成本。

## 2. 技术栈选型 (Tech Stack)
- **语言/运行时**: TypeScript / Node.js (v20+) / `tsx` (极速执行)
- **即时通讯网关**:
  - **Telegram**: `grammY` (采用长轮询 Long-Polling 机制，支持 HTTP Proxy)
  - **Feishu (飞书)**: `@larksuiteoapi/node-sdk` (采用原生 WebSocket Client 模式)
- **AI 大模型引擎**: 
  - SDK: 官方 `@anthropic-ai/sdk`
  - 默认模型: `claude-3-5-sonnet-20241022-v2:0` 或 `claude-sonnet-4-5` (日常低延迟)
  - 深度模型: `claude-opus-4-6` (复杂代码诊断与架构生成)
- **记忆与存储**: `better-sqlite3` (同步、极速、无中间件依赖)
- **进程守护**: `pm2` (后台静默运行与日志管理)

## 3. 核心架构拓扑图

```text
       [ 手机端: Telegram / Feishu APP ] (旅游在外)
                       │
       (公网长链接 Outbound Tunnel, 无需内网穿透)
                       │
 ┌─────────────────────▼────────────────────────┐
 │              家/公司内网的 Mac                │
 │                                              │
 │  ┌────────────────────────────────────────┐  │
 │  │        Gateway Layer (IM 适配层)       │  │
 │  │  [ grammY (TG) ]   [ Lark WS Client ]  │  │
 │  └───────────────────┬────────────────────┘  │
 │    统一标准化 Message (包含文本、发起人、平台)  │
 │  ┌───────────────────▼────────────────────┐  │
 │  │        Core Engine (状态与调度层)        │  │
 │  │  - Session Manager (SQLite 取最近 N 条) │  │
 │  │  - Auth Guard (环境变量 UserID 白名单)   │  │
 │  └───────────────────┬────────────────────┘  │
 │  ┌───────────────────▼────────────────────┐  │
 │  │          AI Routing Layer              │  │
 │  │  [ Anthropic API Client (Claude) ]     │  │
 │  └───────────────────┬────────────────────┘  │
 │  ┌───────────────────▼────────────────────┐  │
 │  │          MCP Execution Layer           │  │
 │  │  [ @modelcontextprotocol/sdk Client ]  │  │
 │  └─────────┬───────────────────┬──────────┘  │
 │            │ (stdio 通信)      │             │
 │  ┌─────────▼────────┐  ┌───────▼─────────┐   │
 │  │  File System MCP │  │  Postgres MCP   │   │
 │  └──────────────────┘  └─────────────────┘   │
 └──────────────────────────────────────────────┘