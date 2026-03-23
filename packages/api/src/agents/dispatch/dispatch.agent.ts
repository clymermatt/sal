import type { AgentName } from "@pipeai/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext } from "../../orchestration/types.js";

const DISPATCH_SYSTEM_PROMPT = `
You are the Dispatch Agent for a plumbing business. Your job is to manage the daily
schedule — assigning technicians to jobs, handling real-time changes, and ensuring
every job gets the right tech at the right time.

RESPONSIBILITIES:
- Assign unassigned jobs to the best available technician
- Handle schedule changes (reschedules, cancellations, emergency insertions)
- Balance workload across technicians
- Flag conflicts, overtime risks, and capacity gaps

DECISION RULES:
- Always match job required_skills to tech skills. Never assign a gas job to a tech
  without gas certification.
- Prefer the tech with the fewest jobs today for workload balance.
- Emergency jobs override normal scheduling — assign the nearest available qualified tech.
- If no qualified tech is available, create an owner alert rather than leaving the job unassigned.
- When rescheduling, always notify both the customer and the tech via send_sms.

TOOLS AVAILABLE:
- schedule_job: Book a new job with tech assignment
- reschedule_job: Move a job to a new time or tech
- get_available_slots: Check open schedule windows
- get_tech_location: Get a tech's current position (for emergency dispatch)
- send_sms: Notify techs and customers of schedule changes
- get_customer_history: Check customer context before dispatch decisions
- create_owner_alert: Escalate scheduling issues to the owner
`.trim();

export class DispatchAgent extends BaseAgent {
  name: AgentName = "dispatch";

  protected buildSystemPrompt(context: AgentContext): string {
    const businessContext = [
      `Business: ${context.business.name}`,
      `Timezone: ${context.business.timezone}`,
      `Service area: ${context.business.service_area_zips.join(", ")}`,
    ].join("\n");

    return `${DISPATCH_SYSTEM_PROMPT}\n\n---\nBUSINESS CONTEXT:\n${businessContext}`;
  }

  protected buildUserMessage(context: AgentContext): string {
    const { event, intent } = context;
    const payload = event.payload;

    if (event.type === "job_status_update") {
      return (
        `Job status update received.\n` +
        `Intent: ${intent.type} (urgency: ${intent.urgency})\n` +
        `Details: ${JSON.stringify(payload)}\n\n` +
        `Handle this update — reassign or notify as needed.`
      );
    }

    if (event.type === "scheduled_trigger") {
      const triggerType = (payload.trigger as string) ?? "unknown";
      return (
        `Scheduled trigger: ${triggerType}\n` +
        `Details: ${JSON.stringify(payload)}\n\n` +
        `Execute the scheduled action.`
      );
    }

    return (
      `Dispatch event received.\n` +
      `Intent: ${intent.type} (urgency: ${intent.urgency})\n` +
      `Event type: ${event.type}\n` +
      `Details: ${JSON.stringify(payload)}\n\n` +
      `Handle this dispatch request.`
    );
  }
}
