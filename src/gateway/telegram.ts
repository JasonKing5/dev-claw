import { Bot, InlineKeyboard } from "grammy";
import { HttpsProxyAgent } from "https-proxy-agent";
import { resolveApproval } from "../core/approval.js";
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
        await ctx.reply(text, { parse_mode: "Markdown" });
      },
    };
    await onMessage(msg);
  });

  // Handle approval button callbacks
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (!data.startsWith("approve:") && !data.startsWith("reject:")) return;

    const [action, approvalId] = data.split(":");
    const approved = action === "approve";
    const resolved = resolveApproval(approvalId, approved);

    if (resolved) {
      await ctx.editMessageText(
        approved
          ? `Approved tool execution (${approvalId})`
          : `Rejected tool execution (${approvalId})`,
      );
    }
    await ctx.answerCallbackQuery(resolved ? (approved ? "Approved" : "Rejected") : "Request expired");
  });

  return bot;
}

/** Send an approval card with Approve/Reject inline buttons */
export async function sendTelegramApprovalCard(
  bot: Bot,
  chatId: string,
  approvalId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<void> {
  const inputPreview = JSON.stringify(toolInput, null, 2).slice(0, 500);
  const text = `*Approval Required*\n\nTool: \`${toolName}\`\nArgs:\n\`\`\`\n${inputPreview}\n\`\`\``;

  const keyboard = new InlineKeyboard()
    .text("Allow", `approve:${approvalId}`)
    .text("Reject", `reject:${approvalId}`);

  await bot.api.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}
