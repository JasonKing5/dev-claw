import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadConfig } from "./config.js";
import { initDatabase, addMessage, getRecentMessages, clearHistory } from "./core/session.js";
import { isAllowed } from "./core/auth.js";
import { initClaude, chat } from "./ai/claude.js";
import { initMcpClients } from "./mcp/client.js";
import { createTelegramBot } from "./gateway/telegram.js";
import { startFeishuClient } from "./gateway/feishu.js";
import type { Message } from "./types.js";

async function main() {
  const config = loadConfig();

  // Ensure database directory exists
  mkdirSync(dirname(config.dbPath), { recursive: true });
  initDatabase(config.dbPath);
  initClaude(config);
  await initMcpClients(config);

  console.log("[DevClaw] Core engine initialized");

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

      const reply = await chat(history, model);
      addMessage(msg.userId, "assistant", reply);
      await msg.reply(reply);
    } catch (err) {
      console.error(`[Error] handleMessage failed:`, err);
      await msg.reply("Something went wrong. Check the server logs for details.").catch(() => {});
    }
  }

  // Start gateways
  if (config.tgBotToken) {
    const bot = createTelegramBot(config, handleMessage);
    bot.catch((err) => {
      console.error("[Gateway] Telegram bot error:", err);
    });
    bot.start({
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
