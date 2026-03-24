import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createHmac, randomUUID } from "node:crypto";
import type { PipeAIEvent } from "@pipeai/shared";
import { handleEvent } from "../orchestration/event-router.js";
import { logger } from "../lib/logger.js";

export async function registerVapiWebhook(app: FastifyInstance): Promise<void> {
  app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.body as Record<string, unknown>;
    const messageType = payload.message as Record<string, unknown> | undefined;

    logger.info({ type: messageType?.type }, "Vapi webhook received");

    // Verify Vapi webhook signature
    const secret = process.env.VAPI_WEBHOOK_SECRET;
    if (secret) {
      const signature = request.headers["x-vapi-signature"] as string;
      const rawBody = JSON.stringify(request.body);
      const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

      if (signature !== expected) {
        logger.warn("Invalid Vapi webhook signature");
        return reply.status(403).send({ error: "Invalid signature" });
      }
    }

    // Normalize to PipeAIEvent
    const event: PipeAIEvent = {
      id: randomUUID(),
      type: "inbound_call",
      businessId: extractBusinessId(payload),
      payload,
      source: "vapi",
      timestamp: new Date().toISOString(),
    };

    // Process async — don't block the webhook response
    handleEvent(event).catch((err) => {
      logger.error({ err, eventId: event.id }, "Failed to process Vapi event");
    });

    return reply.status(200).send({ ok: true });
  });
}

function extractBusinessId(payload: Record<string, unknown>): string {
  // Vapi sends assistant metadata which includes businessId
  const assistant = payload.assistant as Record<string, unknown> | undefined;
  const metadata = assistant?.metadata as Record<string, unknown> | undefined;
  return (metadata?.businessId as string) ?? "";
}
