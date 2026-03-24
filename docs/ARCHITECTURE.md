# DevClaw 技术架构文档 (2026 Edition)

## 1. 技术栈选型
- **语言/运行时**: TypeScript / Node.js (v20+) / `tsx` (免编译极速启动)
- **IM Gateway**:
  - `grammY` (Telegram Long-Polling, 支持通过 `https-proxy-agent` 解决大陆网络连通性)
  - `@larksuiteoapi/node-sdk` (飞书原生 WebSocket Client)
- **AI Engine**: `@anthropic-ai/sdk` (深度适配 Claude 4.5/4.6 的 Tool Calling)
- **MCP Client**: `@modelcontextprotocol/sdk` (通过 stdio 跨进程通信)
- **Local DB**: `better-sqlite3` (本地化极速会话存储)
- **Remote Preview**: `cloudflared` (可选项，供 AI 调用生成外网临时访问链接)

## 2. 系统核心拓扑架构

```text
       [ 手机端: TG / Feishu ] (点击按钮审批 / 发送语音需求)
               │ ▲ (Webhook 交互事件 / 文本消息推拉)
(Outbound 长链接, 无视 NAT/防火墙)
               ▼ │
 ┌────────────────────────────────────────────────────────┐
 │                   DevClaw Node Daemon                  │
 │                                                        │
 │ ┌───────────────────┐    ┌──────────────────────────┐  │
 │ │ 1. Gateway Layer  │    │ 2. Approval Queue        │  │
 │ │ (统一 Message 格式)├────▶│ (Promise Pending 挂起机制)│  │
 │ └─────────┬─────────┘    └──────────┬───────────────┘  │
 │           │                         │                  │
 │ ┌─────────▼─────────────────────────▼───────────────┐  │
 │ │ 3. Agentic Loop Engine (自治特工循环引擎)           │  │
 │ │   while (true) {                                  │  │
 │ │     LLM Res = Anthropic.create(...)               │  │
 │ │     if (Res == tool_use) {                        │  │
 │ │       if (isHighRisk) await waitApproval();       │  │
 │ │       exec MCP Tool()                             │  │
 │ │     } else return final_text;                     │  │
 │ │   }                                               │  │
 │ └─────────┬─────────────────────────┬───────────────┘  │
 │           │                         │                  │
 │ ┌─────────▼─────────┐    ┌──────────▼───────────────┐  │
 │ │ 4. Config Parser  │    │ 5. MCP Execution Layer   │  │
 │ │ 读取 ~/.claude.json│───▶│ StdioClientTransport     │  │
 │ └───────────────────┘    └──────────┬───────────────┘  │
 └─────────────────────────────────────┼──────────────────┘
                                       ▼
                     [ 本地现有的各类 MCP Servers 子进程 ]
                     (FileSystem, Postgres, Playwright...)