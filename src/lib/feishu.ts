import * as lark from "@larksuiteoapi/node-sdk";
import {
  extractPptxText,
  isLegacyPptFileName,
  isPptxFileName,
  truncatePptText,
} from "@/lib/ppt-extract";

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
  fileName?: string;
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

async function downloadMessageFile(messageId: string, fileKey: string): Promise<Buffer> {
  const feishu = getClient();
  const response = await feishu.im.v1.messageResource.get({
    path: { message_id: messageId, file_key: fileKey },
    params: { type: "file" },
  });

  const stream = response.getReadableStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function buildPptIngestPrompt(
  fileName: string,
  messageId: string,
  fileKey: string,
): Promise<string> {
  if (isLegacyPptFileName(fileName)) {
    return `[用户上传 PPT：${fileName}（旧版 .ppt）]
飞书暂无法自动解析旧版格式。请让用户另存为 .pptx 后重传，或粘贴目录/重点页文字。
收到文字后按页/块原子化入库，source=ppt，sourceDetail 含文件名与页码。`;
  }

  if (!isPptxFileName(fileName)) {
    return `[用户上传文件：${fileName}]
若是学习材料请引导说明要点；推荐 PPT 使用 .pptx 格式直接上传。`;
  }

  try {
    const buffer = await downloadMessageFile(messageId, fileKey);
    const rawText = await extractPptxText(buffer);
    if (!rawText.trim()) {
      return `[用户上传 PPT：${fileName}]
已接收但未能提取文字（可能为纯图片页）。请用户粘贴该 PPT 目录或重点页文字后再入库。`;
    }

    const body = truncatePptText(rawText);
    return `[用户上传 PPT：${fileName}]
以下是从 PPT 自动提取的正文，请按页/块**原子化**拆成知识点写入 knowledge_add（source=ppt，sourceDetail=文件名+页码，含 cue 与 线索→要点）。

--- PPT 正文开始 ---
${body}
--- PPT 正文结束 ---

拆分完成后告知用户：共入库多少点、首次复习约 1 小时后开始。用户若说「只学第 X-Y 页」则只处理对应范围。`;
  } catch (error) {
    const hint = error instanceof Error ? error.message : "未知错误";
    return `[用户上传 PPT：${fileName}]
文件已收到但下载/解析失败（${hint}）。请确认机器人有 im:resource 权限；或请用户粘贴 PPT 文字后入库。`;
  }
}

export async function extractIncomingMessage(
  event: Record<string, unknown>,
): Promise<FeishuIncomingMessage | null> {
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

  if (messageType === "text") {
    const text = parseTextContent(content);
    if (!text) return null;
    return {
      messageId,
      chatId,
      openId,
      text,
      chatType: chatType ?? "p2p",
      hasAttachment: false,
    };
  }

  const file = parseFileContent(content);
  if (!file) return null;

  const text = await buildPptIngestPrompt(file.fileName, messageId, file.fileKey);

  return {
    messageId,
    chatId,
    openId,
    text,
    chatType: chatType ?? "p2p",
    hasAttachment: true,
    fileName: file.fileName,
  };
}

export function verifyFeishuToken(token: string | null): boolean {
  const expected = process.env.FEISHU_VERIFICATION_TOKEN;
  if (!expected) return true;
  return token === expected;
}
