import type { AgentName } from "@pipeai/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext } from "../../orchestration/types.js";
import { INTAKE_SYSTEM_PROMPT, buildIntakeContext } from "../../prompts/intake.js";

export class IntakeAgent extends BaseAgent {
  name: AgentName = "intake";

  protected buildSystemPrompt(context: AgentContext): string {
    // The dynamic context is built async in run() and cached on the context
    const dynamicContext =
      (context as AgentContext & { _intakeContext?: string })._intakeContext ?? "";
    return `${INTAKE_SYSTEM_PROMPT}\n\n${dynamicContext}`;
  }

  protected buildUserMessage(context: AgentContext): string {
    const { event, intent } = context;
    const payload = event.payload;

    // Format differently based on event source
    if (event.source === "vapi") {
      // Voice call — transcript or call event
      const transcript = (payload.transcript as string) ?? "";
      const callerPhone = (payload.callerPhone as string) ?? "unknown";
      return (
        `New inbound call from ${callerPhone}.\n` +
        `Intent classified as: ${intent.type} (urgency: ${intent.urgency})\n` +
        (transcript ? `Caller said: "${transcript}"` : "Call just connected — greet the caller.")
      );
    }

    if (event.source === "twilio") {
      // SMS
      const from = (payload.from as string) ?? "unknown";
      const body = (payload.body as string) ?? "";
      return (
        `New inbound SMS from ${from}.\n` +
        `Intent classified as: ${intent.type} (urgency: ${intent.urgency})\n` +
        `Message: "${body}"`
      );
    }

    // Web form or other
    return (
      `New inbound inquiry.\n` +
      `Intent: ${intent.type} (urgency: ${intent.urgency})\n` +
      `Details: ${JSON.stringify(payload)}`
    );
  }

  async run(context: AgentContext) {
    // Pre-build dynamic context before the agentic loop
    const dynamicContext = await buildIntakeContext(context.business);
    (context as AgentContext & { _intakeContext?: string })._intakeContext = dynamicContext;

    return super.run(context);
  }
}
