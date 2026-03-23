import Redis from "ioredis";
import type { Env } from "../config.js";

let redis: Redis.Redis;

export function initRedis(config: Env): Redis.Redis {
  redis = new Redis.default(config.REDIS_URL!, {
    maxRetriesPerRequest: null, // required by BullMQ
  });
  return redis;
}

export function getRedis(): Redis.Redis {
  if (!redis) {
    throw new Error("Redis client not initialized. Call initRedis first.");
  }
  return redis;
}
