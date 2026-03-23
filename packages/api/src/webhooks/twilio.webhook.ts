import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "node:crypto";
import type { PipeAIEvent } from "@pipeai/shared";
import { handleEvent } from "../orchestration/event-router.js";
import { logger } from "../lib/logger.js";
import { getSupabase } from "../db/client.js";

export async function registerTwilioWebhook(app: FastifyInstance): Promise<void> {
  app.post("/sms", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, string>;
    const { From: from, To: to, Body: messageBody } = body;

    logger.info({ from, to }, "Twilio SMS received");

    // TODO: Verify Twilio webhook signature

    // Look up business by PipeAI number
    const supabase = getSupabase();
    const { data: business } = await supabase
      .from("businesses")
      .select("id, owner_cell")
      .eq("pipeai_number", to)
      .single();

    if (!business) {
      logger.warn({ to }, "No business found for PipeAI number");
      return reply.status(200).send("<Response></Response>");
    }

    const isOwner = from === business.owner_cell;

    const event: PipeAIEvent = {
      id: randomUUID(),
      type: isOwner ? "owner_sms_command" : "inbound_sms",
      businessId: business.id,
      payload: { from, to, body: messageBody, isOwner },
      source: "twilio",
      timestamp: new Date().toISOString(),
    };

    handleEvent(event).catch((err) => {
      logger.error({ err, eventId: event.id }, "Failed to process Twilio event");
    });

    // Empty TwiML = no auto-reply (PipeAI handles responses via API)
    return reply
      .status(200)
      .header("Content-Type", "text/xml")
      .send("<Response></Response>");
  });
}
