import type { PipeAIEvent } from "@pipeai/shared";
import { getSupabase } from "../db/client.js";
import { logger } from "../lib/logger.js";
import { publishEvent } from "../jobs/event-publisher.js";
import { logAction, getRecentHistory } from "./action-log.js";
import { agentRegistry } from "./agent-registry.js";
import { classifyIntent } from "./intent-classifier.js";

export async function handleEvent(event: PipeAIEvent): Promise<void> {
  const log = logger.child({ eventId: event.id, eventType: event.type });
  log.info("Processing event");

  // Step 1: Load business context
  const business = await getBusinessContext(event.businessId);
  if (!business) {
    log.error({ businessId: event.businessId }, "Business not found");
    return;
  }

  // Step 2: Get recent action history
  const history = await getRecentHistory(event.businessId, 20);

  // Step 3: Classify intent
  const intent = await classifyIntent(event, business, history);
  log.info({ intent }, "Intent classified");

  // Step 4: Route to correct agent
  const agent = agentRegistry.getAgent(intent.type);
  log.info({ agentName: agent.name }, "Routing to agent");

  // Step 5: Execute agent with full context
  const result = await agent.run({ event, intent, business, history });
  log.info(
    { agentName: agent.name, success: result.success, actions: result.actions.length },
    "Agent execution complete",
  );

  // Step 6: Log the action for owner transparency
  await logAction({
    businessId: event.businessId,
    agentName: agent.name,
    actionType: intent.type,
    description: result.summary,
    inputData: { event, intent },
    outputData: { actions: result.actions },
  });

  // Step 7: Process downstream trigger events
  for (const trigger of result.triggerEvents) {
    log.info({ triggerType: trigger.type, delay: trigger.delay ?? 0 }, "Publishing downstream event");
    await publishEvent(trigger, event.businessId);
  }
}

async function getBusinessContext(businessId: string) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .single();

  if (error || !data) return null;
  return data;
}
