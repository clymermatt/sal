export type EventType =
  | "inbound_call"
  | "inbound_sms"
  | "owner_sms_command"
  | "job_status_update"
  | "payment_received"
  | "scheduled_trigger"
  | "quote_approved"
  | "new_customer_form"
  | "job_complete";

export type Urgency = "critical" | "high" | "normal" | "low";

export type IntentType =
  | "emergency_call"
  | "booking_request"
  | "invoice_query"
  | "owner_command"
  | "job_update"
  | "payment_received"
  | "quote_approval"
  | "customer_inquiry"
  | "faq"
  | "unknown";

export interface PipeAIEvent {
  id: string;
  type: EventType;
  businessId: string;
  payload: Record<string, unknown>;
  source: string;
  timestamp: string;
}

export interface Intent {
  type: IntentType;
  urgency: Urgency;
  confidence: number;
  reasoning: string;
}
