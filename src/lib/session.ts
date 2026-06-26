import { getRedis, isRedisConfigured } from "@/lib/redis";

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

export { isRedisConfigured as isSessionStoreConfigured };
