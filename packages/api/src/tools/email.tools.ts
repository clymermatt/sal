import type { ToolName } from "@pipeai/shared";
import { sendEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";
import type { ToolDefinition } from "../orchestration/types.js";

export const sendEmailTool: ToolDefinition = {
  name: "send_email" as ToolName,
  description:
    "Send an email to a customer. Use for invoice delivery, quote approval requests, or other transactional emails.",
  parameters: {
    type: "object" as const,
    properties: {
      to: { type: "string", description: "Recipient email address" },
      subject: { type: "string", description: "Email subject line" },
      html: { type: "string", description: "Email body as HTML" },
      reply_to: { type: "string", description: "Reply-to email address (optional)" },
    },
    required: ["to", "subject", "html"],
  },
  async execute(input, businessId) {
    const to = input.to as string;
    const subject = input.subject as string;
    const html = input.html as string;
    const replyTo = input.reply_to as string | undefined;

    const result = await sendEmail({ to, subject, html, replyTo });

    logger.info(
      { to, subject, businessId, success: result.success },
      result.success ? "Email sent" : "Email send failed",
    );

    return {
      success: result.success,
      to,
      subject,
      email_id: result.id,
      error: result.error,
    };
  },
};
