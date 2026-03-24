import { Resend } from "resend";
import { logger } from "./logger.js";

let resend: Resend | null = null;
let fromAddress: string = "Sal <noreply@hiresal.com>";

export function initEmail(apiKey: string, from?: string): void {
  resend = new Resend(apiKey);
  if (from) fromAddress = from;
  logger.info("Resend email client initialized");
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!resend) {
    logger.warn({ to: params.to, subject: params.subject }, "Email not sent — Resend not configured");
    return { success: false, error: "Resend not configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: params.to,
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo,
    });

    if (error) {
      logger.error({ err: error, to: params.to }, "Failed to send email");
      return { success: false, error: error.message };
    }

    logger.info({ emailId: data?.id, to: params.to, subject: params.subject }, "Email sent");
    return { success: true, id: data?.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err, to: params.to }, "Failed to send email");
    return { success: false, error: errorMessage };
  }
}
