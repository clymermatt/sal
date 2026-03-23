export type AgentName =
  | "intake"
  | "dispatch"
  | "revenue"
  | "customer"
  | "intelligence";

export interface AgentResult {
  success: boolean;
  agentName: AgentName;
  actions: ActionRecord[];
  triggerEvents: TriggerEvent[];
  summary: string;
}

export interface ActionRecord {
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  timestamp: string;
}

export interface TriggerEvent {
  type: string;
  payload: Record<string, unknown>;
  delay?: number; // ms
}

export type ToolName =
  | "schedule_job"
  | "reschedule_job"
  | "get_available_slots"
  | "get_tech_location"
  | "create_quote"
  | "create_invoice"
  | "send_payment_request"
  | "send_sms"
  | "send_email"
  | "make_call"
  | "get_customer_history"
  | "get_job_costs"
  | "create_owner_alert"
  | "update_business_context"
  | "get_ar_summary"
  | "log_upsell_prompt";
