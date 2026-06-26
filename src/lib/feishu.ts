import * as lark from "@larksuiteoapi/node-sdk";

let client: lark.Client | null = null;

function getClient(): lark.Client {
  if (client) return client;

  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET");
  }

  client = new lark.Client({
    appId,
    appSecret,
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });

  return client;
}

export function parseTextContent(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { text?: string };
    return parsed.text?.trim() ?? "";
  } catch {
    return raw.trim();
  }
}

export async function replyText(messageId: string, text: string): Promise<void> {
  const feishu = getClient();
  await feishu.im.v1.message.reply({
    path: { message_id: messageId },
    data: {
      msg_type: "text",
      content: JSON.stringify({ text }),
    },
  });
}

export async function sendTextToChat(chatId: string, text: string): Promise<void> {
  const feishu = getClient();
  await feishu.im.v1.message.create({
    params: { receive_id_type: "chat_id" },
    data: {
      receive_id: chatId,
      msg_type: "text",
      content: JSON.stringify({ text }),
    },
  });
}

export type FeishuIncomingMessage = {
  messageId: string;
  chatId: string;
  openId: string;
  text: string;
  chatType: string;
};

export function extractIncomingMessage(event: Record<string, unknown>): FeishuIncomingMessage | null {
  const message = event.message as Record<string, unknown> | undefined;
  const sender = event.sender as Record<string, unknown> | undefined;
  if (!message || !sender) return null;

  if (message.message_type !== "text") return null;

  const senderId = sender.sender_id as Record<string, string> | undefined;
  const openId = senderId?.open_id;
  const messageId = message.message_id as string | undefined;
  const chatId = message.chat_id as string | undefined;
  const chatType = message.chat_type as string | undefined;
  const content = message.content as string | undefined;

  if (!openId || !messageId || !chatId || !content) return null;

  const text = parseTextContent(content);
  if (!text) return null;

  return {
    messageId,
    chatId,
    openId,
    text,
    chatType: chatType ?? "p2p",
  };
}

export function verifyFeishuToken(token: string | null): boolean {
  const expected = process.env.FEISHU_VERIFICATION_TOKEN;
  if (!expected) return true;
  return token === expected;
}
