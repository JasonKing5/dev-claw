import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadConfig } from "./config.js";
import { initDatabase, addMessage, getRecentMessages, clearHistory } from "./core/session.js";
import { isAllowed } from "./core/auth.js";
import { isHighRisk, requestApproval } from "./core/approval.js";
import { initClaude, agenticLoop } from "./ai/claude.js";
import { initMcpClients, getToolsForApi, getSystemPrompt, callTool } from "./mcp/client.js";
import { createTelegramBot, sendTelegramApprovalCard } from "./gateway/telegram.js";
import { startFeishuClient, sendFeishuApprovalCard } from "./gateway/feishu.js";
import type { Bot } from "grammy";
import type { Message, ToolCall } from "./types.js";

async function main() {
  const config = loadConfig();

  // Ensure database directory exists
  mkdirSync(dirname(config.dbPath), { recursive: true });
  initDatabase(config.dbPath);
  initClaude(config);
  await initMcpClients(config);

  console.log("[DevClaw] Core engine initialized");

  // Keep reference to TG bot for sending approval cards
  let tgBot: Bot | undefined;

  // Unified message handler
  async function handleMessage(msg: Message) {
    if (!isAllowed(config, msg.userId)) {
      console.log(`[Auth] Rejected: ${msg.platform}/${msg.userId}`);
      return;
    }

    // Handle commands
    if (msg.text === "/clear") {
      clearHistory(msg.userId);
      await msg.reply("History cleared.");
      return;
    }

    try {
      // Select model (/opus for deep mode)
      const model = msg.text.startsWith("/opus")
        ? config.claudeDeepModel
        : config.claudeModel;
      const text = msg.text.replace(/^\/opus\s*/, "");

      addMessage(msg.userId, "user", text);
      const history = getRecentMessages(msg.userId, config.contextWindow);
      const tools = getToolsForApi();

      // Build tool executor with approval gate
      const executeTool = async (tool: ToolCall): Promise<string> => {
        if (isHighRisk(tool.name, config.approvalRules)) {
          const sendCard = async (chatId: string, approvalId: string, toolName: string, toolInput: Record<string, unknown>) => {
            if (msg.platform === "telegram" && tgBot) {
              await sendTelegramApprovalCard(tgBot, chatId, approvalId, toolName, toolInput);
            } else if (msg.platform === "feishu") {
              await sendFeishuApprovalCard(chatId, approvalId, toolName, toolInput);
            }
          };

          const approved = await requestApproval(msg.userId, msg.chatId, tool.name, tool.input, sendCard);
          if (!approved) {
            return "Tool execution was rejected by the user.";
          }
        }

        return callTool(tool.name, tool.input);
      };

      const reply = await agenticLoop({
        history,
        model,
        tools,
        systemPrompt: getSystemPrompt(),
        executeTool,
        onStatus: async (status) => {
          await msg.reply(status).catch(() => {});
        },
      });

      addMessage(msg.userId, "assistant", reply);
      await msg.reply(reply);
    } catch (err) {
      console.error(`[Error] handleMessage failed:`, err);
      await msg.reply("Something went wrong. Check the server logs for details.").catch(() => {});
    }
  }

  // Start gateways
  if (config.tgBotToken) {
    tgBot = createTelegramBot(config, handleMessage);
    tgBot.catch((err) => {
      console.error("[Gateway] Telegram bot error:", err);
    });
    tgBot.start({
      onStart: () => console.log("[Gateway] Telegram bot started (long-polling)"),
    });
  }

  if (config.feishuAppId && config.feishuAppSecret) {
    await startFeishuClient(config, handleMessage);
    console.log("[Gateway] Feishu client started (WebSocket)");
  }
}

main().catch((err) => {
  console.error("[DevClaw] Fatal error:", err);
  process.exit(1);
});
