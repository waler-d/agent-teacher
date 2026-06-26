import { Redis } from "@upstash/redis";

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redis = null;
    return redis;
  }

  redis = new Redis({ url, token });
  return redis;
}

const AGENT_KEY_PREFIX = "agent-teacher:feishu:";
const EVENT_KEY_PREFIX = "agent-teacher:event:";
const EVENT_TTL_SECONDS = 60 * 60;

export async function getAgentIdForUser(openId: string): Promise<string | null> {
  const store = getRedis();
  if (!store) return null;
  return store.get<string>(`${AGENT_KEY_PREFIX}${openId}`);
}

export async function saveAgentIdForUser(openId: string, agentId: string): Promise<void> {
  const store = getRedis();
  if (!store) return;
  await store.set(`${AGENT_KEY_PREFIX}${openId}`, agentId);
}

export async function markEventProcessed(eventId: string): Promise<boolean> {
  const store = getRedis();
  if (!store) return true;

  const key = `${EVENT_KEY_PREFIX}${eventId}`;
  const inserted = await store.set(key, "1", { nx: true, ex: EVENT_TTL_SECONDS });
  return inserted === "OK";
}

export function isSessionStoreConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}
