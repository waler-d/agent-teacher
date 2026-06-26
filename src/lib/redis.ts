import { Redis } from "@upstash/redis";

let redis: Redis | null | undefined;

function resolveRedisCredentials(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

export function getRedis(): Redis | null {
  if (redis !== undefined) return redis;

  const creds = resolveRedisCredentials();
  if (!creds) {
    redis = null;
    return redis;
  }

  redis = new Redis(creds);
  return redis;
}

export function isRedisConfigured(): boolean {
  return resolveRedisCredentials() !== null;
}
