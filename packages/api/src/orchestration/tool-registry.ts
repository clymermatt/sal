import type { AgentName, ToolName } from "@pipeai/shared";
import type { ToolDefinition, ToolPermissions } from "./types.js";

const TOOL_PERMISSIONS: ToolPermissions = {
  intake: [
    "schedule_job",
    "get_available_slots",
    "create_owner_alert",
    "send_sms",
    "make_call",
    "get_customer_history",
    "put_job_on_hold",
  ],
  dispatch: [
    "schedule_job",
    "reschedule_job",
    "get_available_slots",
    "get_tech_location",
    "send_sms",
    "get_customer_history",
    "create_owner_alert",
    "put_job_on_hold",
    "clear_job_hold",
  ],
  revenue: [
    "create_quote",
    "create_invoice",
    "send_payment_request",
    "send_sms",
    "send_email",
    "get_customer_history",
    "create_owner_alert",
    "get_ar_summary",
    "log_upsell_prompt",
  ],
  customer: [
    "send_sms",
    "send_email",
    "get_customer_history",
    "create_owner_alert",
    "clear_job_hold",
  ],
  intelligence: [
    "get_customer_history",
    "get_job_costs",
    "get_ar_summary",
    "send_sms",
    "send_email",
  ],
};

class ToolRegistry {
  private tools = new Map<ToolName, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  getToolsFor(agentName: AgentName): ToolDefinition[] {
    const permitted = TOOL_PERMISSIONS[agentName] ?? [];
    return permitted
      .map((name) => this.tools.get(name))
      .filter((t): t is ToolDefinition => t !== undefined);
  }

  isPermitted(agentName: AgentName, toolName: ToolName): boolean {
    const permitted = TOOL_PERMISSIONS[agentName] ?? [];
    return permitted.includes(toolName);
  }

  getTool(name: ToolName): ToolDefinition | undefined {
    return this.tools.get(name);
  }
}

export const toolRegistry = new ToolRegistry();
