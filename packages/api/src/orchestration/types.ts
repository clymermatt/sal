import type {
  AgentName,
  AgentResult,
  Business,
  Intent,
  PipeAIEvent,
  ToolName,
} from "@pipeai/shared";

export interface AgentContext {
  event: PipeAIEvent;
  intent: Intent;
  business: Business;
  history: HistoryEntry[];
}

export interface HistoryEntry {
  id: string;
  agent_name: string;
  action_type: string;
  description: string;
  created_at: string;
}

export interface Agent {
  name: AgentName;
  run(context: AgentContext): Promise<AgentResult>;
}

export interface ToolDefinition {
  name: ToolName;
  description: string;
  parameters: Record<string, unknown>;
  execute(
    input: Record<string, unknown>,
    businessId: string,
  ): Promise<Record<string, unknown>>;
}

export type ToolPermissions = Record<AgentName, ToolName[]>;
