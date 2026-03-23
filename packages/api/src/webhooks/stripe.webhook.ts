import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "node:crypto";
import type { PipeAIEvent } from "@pipeai/shared";
import { handleEvent } from "../orchestration/event-router.js";
import { logger } from "../lib/logger.js";

export async function registerStripeWebhook(app: FastifyInstance): Promise<void> {
  app.post("/", {
    config: {
      rawBody: true,
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const payload = request.body as Record<string, unknown>;

      // TODO: Verify Stripe signature using stripe.webhooks.constructEvent()
      // Will need raw body access for signature verification

      const eventType = payload.type as string;
      logger.info({ stripeEventType: eventType }, "Stripe webhook received");

      if (eventType === "payment_intent.succeeded") {
        const data = payload.data as Record<string, unknown>;
        const object = data.object as Record<string, unknown>;
        const metadata = object.metadata as Record<string, string>;

        const event: PipeAIEvent = {
          id: randomUUID(),
          type: "payment_received",
          businessId: metadata.businessId ?? "",
          payload: { stripeEvent: payload },
          source: "stripe",
          timestamp: new Date().toISOString(),
        };

        handleEvent(event).catch((err) => {
          logger.error({ err, eventId: event.id }, "Failed to process Stripe event");
        });
      }

      return reply.status(200).send({ received: true });
    },
  });
}
