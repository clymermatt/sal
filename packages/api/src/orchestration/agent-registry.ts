import type { IntentType } from "@pipeai/shared";
import type { Agent } from "./types.js";

const INTENT_TO_AGENT: Record<IntentType, string> = {
  emergency_call: "intake",
  booking_request: "intake",
  customer_inquiry: "customer",
  faq: "intake",
  invoice_query: "revenue",
  owner_command: "intake", // routed to command parser within intake
  job_update: "dispatch",
  payment_received: "revenue",
  quote_approval: "revenue",
  unknown: "intake",
};

class AgentRegistry {
  private agents = new Map<string, Agent>();

  register(agent: Agent): void {
    this.agents.set(agent.name, agent);
  }

  getAgent(intentType: IntentType): Agent {
    const agentName = INTENT_TO_AGENT[intentType];
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(
        `No agent registered for intent '${intentType}' (expected '${agentName}')`,
      );
    }
    return agent;
  }
}

export const agentRegistry = new AgentRegistry();
