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

export type FeishuIncomingMessage = {
  messageId: string;
  chatId: string;
  openId: string;
  text: string;
  chatType: string;
  hasAttachment: boolean;
};

function parseFileContent(raw: string): { fileName: string; fileKey: string } | null {
  try {
    const parsed = JSON.parse(raw) as { file_name?: string; file_key?: string };
    if (parsed.file_name && parsed.file_key) {
      return { fileName: parsed.file_name, fileKey: parsed.file_key };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function extractIncomingMessage(event: Record<string, unknown>): FeishuIncomingMessage | null {
  const message = event.message as Record<string, unknown> | undefined;
  const sender = event.sender as Record<string, unknown> | undefined;
  if (!message || !sender) return null;

  const messageType = message.message_type as string | undefined;
  if (messageType !== "text" && messageType !== "file") return null;

  const senderId = sender.sender_id as Record<string, string> | undefined;
  const openId = senderId?.open_id;
  const messageId = message.message_id as string | undefined;
  const chatId = message.chat_id as string | undefined;
  const chatType = message.chat_type as string | undefined;
  const content = message.content as string | undefined;

  if (!openId || !messageId || !chatId || !content) return null;

  let text = "";
  let hasAttachment = false;

  if (messageType === "text") {
    text = parseTextContent(content);
    if (!text) return null;
  } else {
    const file = parseFileContent(content);
    if (!file) return null;
    hasAttachment = true;
    const lower = file.fileName.toLowerCase();
    const isPpt = lower.endsWith(".ppt") || lower.endsWith(".pptx");
    text = isPpt
      ? `[用户上传 PPT：${file.fileName}]\n请引导用户说明本次要学的章节/页码，或请用户粘贴目录与重点页文字；收到内容后按页/块拆成知识点入库（source=ppt）。若用户随后提问，结合 PPT 主题作答并入库。`
      : `[用户上传文件：${file.fileName}]\n若是学习材料，请引导用户说明内容要点以便拆成知识点；非学习文件请礼貌说明主要支持 PPT 与问答学习。`;
  }

  return {
    messageId,
    chatId,
    openId,
    text,
    chatType: chatType ?? "p2p",
    hasAttachment,
  };
}

export function verifyFeishuToken(token: string | null): boolean {
  const expected = process.env.FEISHU_VERIFICATION_TOKEN;
  if (!expected) return true;
  return token === expected;
}
