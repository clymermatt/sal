import type { PipeAIEvent, TriggerEvent } from "@pipeai/shared";
import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";

let eventQueue: import("bullmq").Queue | null = null;

export function setEventQueue(queue: import("bullmq").Queue) {
  eventQueue = queue;
}

/**
 * Publish a downstream event. If BullMQ is available, enqueue it.
 * Otherwise (dev mode), process it inline via handleEvent.
 */
export async function publishEvent(
  trigger: TriggerEvent,
  businessId: string,
): Promise<void> {
  const event: PipeAIEvent = {
    id: randomUUID(),
    type: trigger.type as PipeAIEvent["type"],
    businessId,
    payload: trigger.payload,
    source: "downstream",
    timestamp: new Date().toISOString(),
  };

  if (eventQueue) {
    await eventQueue.add("event", event, {
      delay: trigger.delay ?? 0,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    });
    logger.info(
      { eventId: event.id, type: event.type, delay: trigger.delay ?? 0 },
      "Event queued to BullMQ",
    );
  } else {
    // Dev fallback: process inline (no Redis required)
    logger.info(
      { eventId: event.id, type: event.type },
      "No Redis — processing downstream event inline",
    );
    // Dynamic import to avoid circular dependency at module load
    const { handleEvent } = await import("../orchestration/event-router.js");
    await handleEvent(event);
  }
}
