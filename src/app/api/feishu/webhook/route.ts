import { waitUntil } from "@vercel/functions";
import { askTeacher } from "@/lib/agent";
import {
  extractIncomingMessage,
  replyText,
  verifyFeishuToken,
} from "@/lib/feishu";
import { markEventProcessed } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 300;

type FeishuWebhookBody = {
  challenge?: string;
  type?: string;
  token?: string;
  schema?: string;
  header?: {
    event_id?: string;
    event_type?: string;
    token?: string;
  };
  event?: Record<string, unknown>;
};

async function handleIncomingMessage(event: Record<string, unknown>): Promise<void> {
  const incoming = await extractIncomingMessage(event);
  if (!incoming) return;

  try {
    const answer = await askTeacher(incoming.openId, incoming.text);
    await replyText(incoming.messageId, answer);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "处理消息时出现未知错误，请稍后再试。";
    await replyText(incoming.messageId, `出错了：${message}`);
  }
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as FeishuWebhookBody;

  if (body.type === "url_verification" && body.challenge) {
    return Response.json({ challenge: body.challenge });
  }

  const token = body.token ?? body.header?.token ?? null;
  if (!verifyFeishuToken(token)) {
    return Response.json({ error: "invalid token" }, { status: 403 });
  }

  const eventType = body.header?.event_type;
  const eventId = body.header?.event_id;

  if (eventType === "im.message.receive_v1" && body.event) {
    if (eventId) {
      const isNew = await markEventProcessed(eventId);
      if (!isNew) {
        return Response.json({ ok: true, deduped: true });
      }
    }

    waitUntil(handleIncomingMessage(body.event));
    return Response.json({ ok: true });
  }

  return Response.json({ ok: true, ignored: eventType ?? body.type ?? "unknown" });
}

export async function GET(): Promise<Response> {
  return Response.json({
    service: "agent-teacher",
    platform: "feishu",
    status: "ready",
  });
}
