import { Worker } from "bullmq";
import type { PipeAIEvent } from "@pipeai/shared";
import { handleEvent } from "../../orchestration/event-router.js";
import { logger } from "../../lib/logger.js";

let worker: Worker | null = null;

export function startEventWorker(redisUrl: string): Worker {
  worker = new Worker(
    "events",
    async (job) => {
      const event = job.data as PipeAIEvent;
      logger.info(
        { eventId: event.id, type: event.type, attempt: job.attemptsMade + 1 },
        "Processing queued event",
      );
      await handleEvent(event);
    },
    {
      connection: { url: redisUrl },
      concurrency: 5,
    },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job?.id }, "Queued event processed successfully");
  });

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, err: err.message, attempt: job?.attemptsMade },
      "Queued event processing failed",
    );
  });

  logger.info("Event worker started");
  return worker;
}

export function getEventWorker(): Worker | null {
  return worker;
}
