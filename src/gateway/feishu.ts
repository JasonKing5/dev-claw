import * as lark from "@larksuiteoapi/node-sdk";
import { resolveApproval } from "../core/approval.js";
import type { AppConfig, Message } from "../types.js";

let larkClient: lark.Client;

export async function startFeishuClient(
  config: AppConfig,
  onMessage: (msg: Message) => void
): Promise<void> {
  larkClient = new lark.Client({
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
          await larkClient.im.message.create({
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

  // Handle card action callbacks for approval buttons
  const cardActionHandler = (data: unknown) => {
    const event = data as {
      action?: { value?: { approval_id?: string; approved?: boolean } };
    };
    const { approval_id, approved } = event.action?.value ?? {};
    if (approval_id != null && approved != null) {
      resolveApproval(approval_id, approved);
    }
  };

  const wsClient = new lark.WSClient({
    appId: config.feishuAppId!,
    appSecret: config.feishuAppSecret!,
  });

  // WSClient.start() accepts { eventDispatcher } at runtime (missing from type defs)
  await (wsClient as any).start({ eventDispatcher, cardActionHandler });
}

/** Send an interactive approval card in Feishu */
export async function sendFeishuApprovalCard(
  chatId: string,
  approvalId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<void> {
  const inputPreview = JSON.stringify(toolInput, null, 2).slice(0, 500);

  const card = {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: "plain_text", content: "Approval Required" },
      template: "orange",
    },
    elements: [
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**Tool:** \`${toolName}\`\n**Args:**\n\`\`\`\n${inputPreview}\n\`\`\``,
        },
      },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { tag: "plain_text", content: "Allow" },
            type: "primary",
            value: { approval_id: approvalId, approved: true },
          },
          {
            tag: "button",
            text: { tag: "plain_text", content: "Reject" },
            type: "danger",
            value: { approval_id: approvalId, approved: false },
          },
        ],
      },
    ],
  };

  await larkClient.im.message.create({
    params: { receive_id_type: "chat_id" },
    data: {
      receive_id: chatId,
      msg_type: "interactive",
      content: JSON.stringify(card),
    },
  });
}
