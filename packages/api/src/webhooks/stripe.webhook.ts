import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import type { PipeAIEvent } from "@pipeai/shared";
import { handleEvent } from "../orchestration/event-router.js";
import { logger } from "../lib/logger.js";

let stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not set");
    stripe = new Stripe(key);
  }
  return stripe;
}

export async function registerStripeWebhook(app: FastifyInstance): Promise<void> {
  // Stripe needs the raw body for signature verification
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      done(null, body);
    },
  );

  app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const rawBody = request.body as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    if (webhookSecret) {
      const signature = request.headers["stripe-signature"] as string;
      try {
        event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        logger.warn({ err: msg }, "Invalid Stripe webhook signature");
        return reply.status(400).send({ error: `Webhook signature verification failed: ${msg}` });
      }
    } else {
      // Dev mode — no signature verification
      event = JSON.parse(rawBody) as Stripe.Event;
    }

    logger.info({ stripeEventType: event.type }, "Stripe webhook received");

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const metadata = paymentIntent.metadata;

      const pipeEvent: PipeAIEvent = {
        id: randomUUID(),
        type: "payment_received",
        businessId: metadata.businessId ?? "",
        payload: {
          stripeEventId: event.id,
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          invoiceId: metadata.invoiceId,
          customerId: metadata.customerId,
        },
        source: "stripe",
        timestamp: new Date().toISOString(),
      };

      handleEvent(pipeEvent).catch((err) => {
        logger.error({ err, eventId: pipeEvent.id }, "Failed to process Stripe event");
      });
    }

    return reply.status(200).send({ received: true });
  });
}
