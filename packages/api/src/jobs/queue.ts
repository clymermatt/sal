import { Queue } from "bullmq";
import type { Env } from "../config.js";

let eventQueue: Queue;
let scheduledQueue: Queue;
let redisUrl: string;

export function initQueues(config: Env) {
  redisUrl = config.REDIS_URL!;
  const connection = { url: redisUrl };

  eventQueue = new Queue("events", { connection });
  scheduledQueue = new Queue("scheduled", { connection });

  return { eventQueue, scheduledQueue };
}

export function getEventQueue(): Queue {
  if (!eventQueue) throw new Error("Event queue not initialized");
  return eventQueue;
}

export function getScheduledQueue(): Queue {
  if (!scheduledQueue) throw new Error("Scheduled queue not initialized");
  return scheduledQueue;
}
