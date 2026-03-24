import * as lark from "@larksuiteoapi/node-sdk";
import type { AppConfig, Message } from "../types.js";

export async function startFeishuClient(
  config: AppConfig,
  onMessage: (msg: Message) => void
): Promise<void> {
  const client = new lark.Client({
    appId: config.feishuAppId!,
    appSecret: config.feishuAppSecret!,
  });

  const eventDispatcher = new lark.EventDispatcher({}).register({
    "im.message.receive_v1": (data) => {
      const event = data as {
        sender: { sender_id: { open_id: string } };
        message: { chat_id: string; content: string; message_type: string };
      };

      if (event.message.message_type !== "text") return;

      const content = JSON.parse(event.message.content) as { text: string };
      const msg: Message = {
        platform: "feishu",
        userId: event.sender.sender_id.open_id,
        chatId: event.message.chat_id,
        text: content.text,
        reply: async (text: string) => {
          await client.im.message.create({
            params: { receive_id_type: "chat_id" },
            data: {
              receive_id: event.message.chat_id,
              msg_type: "text",
              content: JSON.stringify({ text }),
            },
          });
        },
      };
      onMessage(msg);
    },
  });

  const wsClient = new lark.WSClient({
    appId: config.feishuAppId!,
    appSecret: config.feishuAppSecret!,
  });

  // WSClient.start() accepts { eventDispatcher } at runtime (missing from type defs)
  await (wsClient as any).start({ eventDispatcher });
}
