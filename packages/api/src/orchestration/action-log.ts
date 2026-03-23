import type { AgentName } from "@pipeai/shared";
import { getSupabase } from "../db/client.js";
import { logger } from "../lib/logger.js";

interface LogEntry {
  businessId: string;
  agentName: AgentName;
  actionType: string;
  description: string;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
}

export async function logAction(entry: LogEntry): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase.from("action_log").insert({
    business_id: entry.businessId,
    agent_name: entry.agentName,
    action_type: entry.actionType,
    description: entry.description,
    input_data: entry.inputData ?? {},
    output_data: entry.outputData ?? {},
  });

  if (error) {
    logger.error({ error, entry }, "Failed to log action");
  }
}

export async function getRecentHistory(
  businessId: string,
  limit = 20,
) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("action_log")
    .select("id, agent_name, action_type, description, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error }, "Failed to fetch recent history");
    return [];
  }

  return data ?? [];
}
