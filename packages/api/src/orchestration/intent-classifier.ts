import Anthropic from "@anthropic-ai/sdk";
import type { Business, Intent, PipeAIEvent } from "@pipeai/shared";
import { EMERGENCY_KEYWORDS } from "@pipeai/shared";
import { logger } from "../lib/logger.js";
import type { HistoryEntry } from "./types.js";

let anthropic: Anthropic;

export function initClassifier(apiKey: string): void {
  anthropic = new Anthropic({ apiKey });
}

export async function classifyIntent(
  event: PipeAIEvent,
  business: Business,
  history: HistoryEntry[],
): Promise<Intent> {
  // Fast path: check for emergency keywords in text-based events
  const textContent = extractTextContent(event);
  if (textContent && containsEmergencyKeyword(textContent)) {
    return {
      type: "emergency_call",
      urgency: "critical",
      confidence: 0.95,
      reasoning: "Emergency keyword detected in message content",
    };
  }

  // Fast path: known event types that map directly
  if (event.type === "payment_received") {
    return {
      type: "payment_received",
      urgency: "normal",
      confidence: 1.0,
      reasoning: "Direct event type mapping",
    };
  }
  if (event.type === "quote_approved") {
    return {
      type: "quote_approval",
      urgency: "normal",
      confidence: 1.0,
      reasoning: "Direct event type mapping",
    };
  }
  if (event.type === "job_status_update") {
    return {
      type: "job_update",
      urgency: "normal",
      confidence: 1.0,
      reasoning: "Direct event type mapping",
    };
  }

  // LLM classification for ambiguous events (inbound calls, SMS, forms)
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 256,
    system: `You classify inbound events for a plumbing business AI system.
Respond with JSON only: {"type": string, "urgency": string, "confidence": number, "reasoning": string}

Intent types: emergency_call, booking_request, invoice_query, owner_command, customer_inquiry, faq, unknown
Urgency levels: critical, high, normal, low

Business: ${business.name}
Service area: ${business.service_area_zips.join(", ")}`,
    messages: [
      {
        role: "user",
        content: `Event type: ${event.type}
Source: ${event.source}
Payload: ${JSON.stringify(event.payload)}
Recent history: ${JSON.stringify(history.slice(0, 5))}

Classify this event.`,
      },
    ],
  });

  try {
    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text) as Intent;
    return parsed;
  } catch (err) {
    logger.error({ err, response }, "Failed to parse intent classification");
    return {
      type: "unknown",
      urgency: "normal",
      confidence: 0,
      reasoning: "Classification parse failure — defaulting to unknown",
    };
  }
}

function extractTextContent(event: PipeAIEvent): string | null {
  const payload = event.payload;
  if (typeof payload.body === "string") return payload.body;
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.transcript === "string") return payload.transcript;
  return null;
}

function containsEmergencyKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw));
}
