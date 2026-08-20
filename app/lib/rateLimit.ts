import type { Redis } from "@upstash/redis";

export async function incrementRateLimit(
  redis: Redis,
  key: string,
  ttlSeconds: number
) {
  const initialized =
    await redis.set(
      key,
      1,
      {
        nx: true,
        ex: ttlSeconds,
      }
    );

  if (initialized === "OK") {
    return 1;
  }

  return redis.incr(key);
}
