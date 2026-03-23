import type { FastifyInstance } from "fastify";
import { registerVapiWebhook } from "./vapi.webhook.js";
import { registerTwilioWebhook } from "./twilio.webhook.js";
import { registerStripeWebhook } from "./stripe.webhook.js";

export async function registerWebhooks(app: FastifyInstance): Promise<void> {
  await app.register(registerVapiWebhook, { prefix: "/webhooks/vapi" });
  await app.register(registerTwilioWebhook, { prefix: "/webhooks/twilio" });
  await app.register(registerStripeWebhook, { prefix: "/webhooks/stripe" });
}
