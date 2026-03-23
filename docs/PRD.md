# DevClaw 产品需求文档 (PRD)

## 1. 项目背景与定位
**DevClaw** 是一款专为 Web 全栈开发者量身定制的极简、轻量级本地 AI Agent 接入网关。
面对开源社区日益臃肿的 OpenClaw 等衍生项目，本项目旨在剥离一切非必要功能（如复杂的跨平台路由、私有化黑盒插件系统），专注于构建一个**低 Token 消耗、零内网穿透成本、100% 拥抱原生 MCP (Model Context Protocol) 生态**的极客级私人助理。

核心驱动引擎将全面适配 2026 年最新一代大模型（如 `Claude Sonnet 4.5` 作为日常极速引擎，`Claude Opus 4.6` 作为深度逻辑引擎），并通过即时通讯工具（Telegram/飞书）为开发者提供全天候的移动端与桌面端支持。

## 2. 核心痛点与重构方案

### 痛点一：传统框架 Token 消耗过大（冗余上下文）
- **问题描述**：传统的 Claw 框架采用 "Megaprompt" 和文件堆砌记忆，每次请求强行灌入所有 Agent Skills 声明和全局历史，导致在 Claude 4.5/4.6 等拥有复杂 System Prompt 的模型上 Token 消耗极快，响应延迟高。
- **DevClaw 方案**：
  1. **滑动窗口记忆流**：引入 SQLite 替代 Markdown 文件作为记忆载体，基于 Token 估算自动提取最近 N 轮对话。
  2. **动态 MCP 挂载 (Lazy Tool Loading)**：废除全局工具挂载。利用轻量级模型（如 `Claude Haiku 4.5`）前置进行意图识别，仅在涉及本地文件、数据库查询等极客操作时，动态透传对应的 MCP Servers Schema。

### 痛点二：IM 接入配置极其繁琐（环境门槛高）
- **问题描述**：为兼容 Webhook，传统方案强制要求配置 ngrok / Tailscale Funnel 等内网穿透工具，且飞书等企业应用鉴权链路极长，导致本地开发和日常启停极其痛苦。
- **DevClaw 方案**：
  1. **彻底废除 Webhook**。
  2. **Telegram**：采用 `grammY` 长轮询（Long-Polling）机制。
  3. **飞书 (Feishu)**：全面采用官方支持的 **WebSocket** 长链接模式。
  - **结果**：实现真正的“开箱即用”，在任何无公网 IP 的 Mac/PC 上，只需 `npm start` 即可秒连。

### 痛点三：功能过度臃肿与黑盒插件安全隐患
- **问题描述**：内置了大量开发者根本不需要的泛娱乐功能（如语音、画图），且自定义的 Skill 系统难以维护，甚至存在任意代码执行的风险。
- **DevClaw 方案**：
  1. **100% MCP 原生**：干掉所有的私有插件库。所有的工具能力（操作 Git、查询 DB、读取本地 Log、甚至触发构建脚本）完全复用开发者为 `claude-code` 或 `Cursor` 编写的标准本地 MCP Servers。
  2. **边界清晰**：DevClaw 仅承担“消息管道”、“状态机”和“LLM 调度”职责，底层动作一律交给 MCP Client 执行。

## 3. 核心功能点 (P0)

| 模块 | 功能项 | 详细描述 |
| :--- | :--- | :--- |
| **消息网关** | Telegram 接入 | 支持接收与回复文本、Markdown 格式消息，支持基础命令 `/start`, `/clear` (清空记忆)。 |
| **消息网关** | 飞书 接入 | 基于 WebSocket 接收特定群聊或单聊消息，支持回复富文本卡片或 Markdown。 |
| **会话管理** | 本地状态持久化 | 基于 `better-sqlite3` 记录 `user_id`, `role`, `content`, `timestamp`。 |
| **LLM 调度** | 动态模型切换 | 支持环境变量级配置，常规聊天路由至 `claude-sonnet-4-5`，复杂代码诊断可通过 `/opus` 指令触发 `claude-opus-4-6`。 |
| **MCP 引擎** | MCP Client 连接 | 启动时自动读取本地 `.devclaw/mcp_config.json`，与本地已有的各种 MCP 进程（如 `@modelcontextprotocol/server-postgres`）建立标准 stdio/sse 连接。 |
| **MCP 引擎** | Tool Call 拦截 | 解析大模型返回的 `tool_use` 节点，转发至对应的 MCP Server，将 `tool_result` 喂回给大模型。 |

## 4. 非功能性与安全需求
1. **轻量化**：核心代码库控制在 1000 行以内，极简的依赖树。
2. **极速启动**：Node.js 环境下启动时间 < 2 秒。
3. **权限沙箱**：通过读取 `.env` 中定义的 `ALLOWED_USERS` (TG/Feishu ID 列表) 进行白名单鉴权，拒绝任何陌生人的调用，防止本地环境被破坏。
4. **日志脱敏**：控制台日志仅打印请求耗时、Token 使用量及 Tool Call 名称，禁止在日志中明文打印私钥及数据库查询结果。

## 5. 预期用户场景 (User Story)
- **场景 A (查库)**：晚上在外就餐，收到监控报警。通过 TG 发送：“*用 DB MCP 查一下刚刚 orders 表里报错的堆栈*”。DevClaw 调用 `claude-sonnet-4.5` 和本地 DB MCP 查出结果并脱敏发回 TG。
- **场景 B (改代码)**：在地铁上，通过飞书向 DevClaw 发送：“*将 src/utils/auth.ts 里的 JWT 过期时间从 7 天改为 30 天*”。DevClaw 调动本地 FileSystem MCP 完成修改，并可联动 Git MCP 提交 PR。