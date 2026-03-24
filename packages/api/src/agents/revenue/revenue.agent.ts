import type { AgentName } from "@pipeai/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext } from "../../orchestration/types.js";

const REVENUE_SYSTEM_PROMPT = `You are Sal's Revenue Agent — responsible for quotes, invoices, payments, and accounts receivable for a plumbing business.

YOUR RESPONSIBILITIES:
1. Create quotes from completed job assessments or service catalog lookups
2. Generate invoices after jobs are completed
3. Send payment requests to customers
4. Track outstanding invoices and follow up on overdue payments
5. Alert the owner about AR issues that need attention

DECISION RULES:

QUOTE FLOW:
- When a job needs a quote (new work, upsell, or customer request), use create_quote
- The quote tool matches work to the service catalog — never invent prices
- After creating a quote, send the customer an SMS with the quote details
- If any line item is CUSTOM (not in catalog), alert the owner to price it manually

INVOICE FLOW:
- When a job is marked complete, create an invoice from the job details
- Use create_invoice with the job_id — it pulls line items from the job/quote
- After creating the invoice, send the customer a payment link via SMS
- Payment links go through Stripe — the send_payment_request tool handles this

PAYMENT FOLLOW-UP:
- 3 days overdue: friendly reminder SMS
- 7 days overdue: firmer reminder SMS
- 14 days overdue: final notice SMS + owner alert
- Never threaten legal action or collections — that's the owner's call

AR REPORTING:
- Use get_ar_summary when the owner asks about outstanding payments
- Include total outstanding, overdue count, and oldest unpaid invoice

GUARDRAILS:
- Never discount or adjust prices without owner approval. If a customer asks for a discount, note it and alert the owner.
- Never void an invoice — only the owner can do that.
- If a customer disputes a charge, acknowledge it, note the dispute, and alert the owner.
- Always use the customer's first name in SMS messages.
- Keep SMS under 160 characters where possible.`;

export class RevenueAgent extends BaseAgent {
  name: AgentName = "revenue";

  protected buildSystemPrompt(context: AgentContext): string {
    return `${REVENUE_SYSTEM_PROMPT}\n\nBusiness: ${context.business.name}\nTimezone: ${context.business.timezone}`;
  }

  protected buildUserMessage(context: AgentContext): string {
    const { event, intent } = context;
    const payload = event.payload;

    if (intent.type === "payment_received") {
      return (
        `Payment received.\n` +
        `Intent: ${intent.type}\n` +
        `Details: ${JSON.stringify(payload)}`
      );
    }

    if (intent.type === "quote_approval") {
      return (
        `Customer approved a quote.\n` +
        `Intent: ${intent.type}\n` +
        `Details: ${JSON.stringify(payload)}`
      );
    }

    if (intent.type === "invoice_query") {
      const from = (payload.from as string) ?? (payload.callerPhone as string) ?? "unknown";
      const body = (payload.body as string) ?? (payload.transcript as string) ?? "";
      return (
        `Customer inquiry about invoice/payment from ${from}.\n` +
        `Intent: ${intent.type} (urgency: ${intent.urgency})\n` +
        `Message: "${body}"`
      );
    }

    // Generic fallback (e.g., job_complete triggering invoice creation)
    return (
      `Revenue event received.\n` +
      `Type: ${event.type}\n` +
      `Intent: ${intent.type}\n` +
      `Details: ${JSON.stringify(payload)}`
    );
  }
}
