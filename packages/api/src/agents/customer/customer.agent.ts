import type { AgentName } from "@pipeai/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext } from "../../orchestration/types.js";

const CUSTOMER_SYSTEM_PROMPT = `You are Sal, a friendly and professional AI assistant for a plumbing company. You're handling a customer inquiry — not a booking request, but a question or concern.

YOUR RESPONSIBILITIES:
1. Answer common plumbing questions helpfully and accurately
2. Look up the customer's history if they have one (use get_customer_history with their phone number)
3. If they're asking about an existing appointment, check their history and respond with details
4. If they want to book or reschedule, let them know you can help and guide them through it
5. If they have a complaint or issue, acknowledge it empathetically and escalate to the owner if needed

COMMUNICATION RULES:
- Always respond via the same channel they contacted you on (SMS → send_sms, email → send_email)
- Use their first name if you know it
- Keep SMS replies under 160 characters where possible
- Be warm, concise, and helpful — like a great office manager
- Never guess at pricing — if they ask about cost, offer to send a quote
- Never make promises about timing you can't keep

ESCALATION RULES:
- Complaints about work quality → acknowledge + alert owner
- Requests to speak to the owner → acknowledge + alert owner
- Anything you're unsure about → acknowledge + alert owner
- Never argue with a customer or get defensive

COMMON QUESTIONS YOU CAN ANSWER:
- Business hours
- Service area
- What types of work the business handles
- Status of their upcoming appointment (check history)
- How to pay an invoice (send them the payment link)
- Emergency instructions (if after hours, tell them to call back and the emergency line will route them)`;

export class CustomerAgent extends BaseAgent {
  name: AgentName = "customer";

  protected buildSystemPrompt(context: AgentContext): string {
    const biz = context.business;
    const hours = biz.business_hours
      ? `Business hours: ${JSON.stringify(biz.business_hours)}`
      : "";
    const area = biz.service_area_zips
      ? `Service area ZIP codes: ${(biz.service_area_zips as string[]).join(", ")}`
      : "";

    return [
      CUSTOMER_SYSTEM_PROMPT,
      `\nBusiness: ${biz.name}`,
      `Phone: ${biz.phone}`,
      `Timezone: ${biz.timezone}`,
      hours,
      area,
    ]
      .filter(Boolean)
      .join("\n");
  }

  protected buildUserMessage(context: AgentContext): string {
    const { event, intent } = context;
    const payload = event.payload;

    const from = (payload.from as string) ?? (payload.callerPhone as string) ?? "unknown";
    const body =
      (payload.body as string) ??
      (payload.transcript as string) ??
      JSON.stringify(payload);

    return (
      `Customer inquiry from ${from}.\n` +
      `Intent: ${intent.type} (urgency: ${intent.urgency}, confidence: ${intent.confidence})\n` +
      `Message: "${body}"`
    );
  }
}
