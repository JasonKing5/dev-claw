import { Bot } from "grammy";
import { HttpsProxyAgent } from "https-proxy-agent";
import type { AppConfig, Message } from "../types.js";

export function createTelegramBot(config: AppConfig, onMessage: (msg: Message) => Promise<void>): Bot {
  const baseFetchConfig: Record<string, unknown> = {};
  if (config.tgProxyUrl) {
    baseFetchConfig.agent = new HttpsProxyAgent(config.tgProxyUrl, { keepAlive: true });
    baseFetchConfig.compress = true;
  }

  const bot = new Bot(config.tgBotToken!, {
    client: { baseFetchConfig },
  });

  bot.on("message:text", async (ctx) => {
    const msg: Message = {
      platform: "telegram",
      userId: String(ctx.from.id),
      chatId: String(ctx.chat.id),
      text: ctx.message.text,
      reply: async (text: string) => {
        await ctx.reply(text);
      },
    };
    await onMessage(msg);
  });

  return bot;
}
