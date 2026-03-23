import Twilio from "twilio";
import { logger } from "./logger.js";

let twilioClient: Twilio.Twilio | null = null;
let fromNumber: string | undefined;

export function initTwilio(accountSid: string, authToken: string, phoneNumber: string): void {
  twilioClient = Twilio(accountSid, authToken);
  fromNumber = phoneNumber;
  logger.info("Twilio client initialized");
}

export function getTwilio(): Twilio.Twilio | null {
  return twilioClient;
}

export function getTwilioFromNumber(): string | undefined {
  return fromNumber;
}

export async function sendSMS(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!twilioClient || !fromNumber) {
    logger.warn({ to, bodyLength: body.length }, "SMS not sent — Twilio not configured");
    return { success: false, error: "Twilio not configured" };
  }

  try {
    const message = await twilioClient.messages.create({
      to,
      from: fromNumber,
      body,
    });

    logger.info({ sid: message.sid, to }, "SMS sent");
    return { success: true, sid: message.sid };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err, to }, "Failed to send SMS");
    return { success: false, error: errorMessage };
  }
}
