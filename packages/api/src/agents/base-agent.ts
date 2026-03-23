import Anthropic from "@anthropic-ai/sdk";
import type { AgentName, AgentResult, ToolName } from "@pipeai/shared";
import { logger } from "../lib/logger.js";
import { toolRegistry } from "../orchestration/tool-registry.js";
import type { AgentContext, ToolDefinition } from "../orchestration/types.js";

export abstract class BaseAgent {
  abstract name: AgentName;

  protected abstract buildSystemPrompt(context: AgentContext): string;

  protected abstract buildUserMessage(context: AgentContext): string;

  async run(context: AgentContext): Promise<AgentResult> {
    const log = logger.child({ agent: this.name, eventId: context.event.id });
    const tools = toolRegistry.getToolsFor(this.name);
    const actions: AgentResult["actions"] = [];

    log.info({ toolCount: tools.length }, "Agent starting");

    const anthropic = new Anthropic();
    const anthropicTools = tools.map(toAnthropicTool);

    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: this.buildUserMessage(context) },
    ];

    // Agentic loop: keep calling Claude until it stops requesting tools
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: this.buildSystemPrompt(context),
      tools: anthropicTools,
      messages,
    });

    while (response.stop_reason === "tool_use") {
      const assistantContent = response.content;
      messages.push({ role: "assistant", content: assistantContent });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of assistantContent) {
        if (block.type !== "tool_use") continue;

        const toolName = block.name as ToolName;
        if (!toolRegistry.isPermitted(this.name, toolName)) {
          log.warn({ toolName }, "Agent attempted unauthorized tool call");
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Error: Agent '${this.name}' is not permitted to use tool '${toolName}'`,
            is_error: true,
          });
          continue;
        }

        const tool = toolRegistry.getTool(toolName);
        if (!tool) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Error: Tool '${toolName}' not found`,
            is_error: true,
          });
          continue;
        }

        try {
          const input = block.input as Record<string, unknown>;
          log.info({ toolName, input }, "Executing tool");
          const output = await tool.execute(input, context.business.id);

          actions.push({
            tool: toolName,
            input,
            output,
            timestamp: new Date().toISOString(),
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(output),
          });
        } catch (err) {
          log.error({ err, toolName }, "Tool execution failed");
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
            is_error: true,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });

      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: this.buildSystemPrompt(context),
        tools: anthropicTools,
        messages,
      });
    }

    // Extract final text summary
    const summary =
      response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n") || "Agent completed with no summary";

    log.info({ actionCount: actions.length }, "Agent complete");

    return {
      success: true,
      agentName: this.name,
      actions,
      triggerEvents: [], // subclasses can override to emit downstream events
      summary,
    };
  }
}

function toAnthropicTool(tool: ToolDefinition): Anthropic.Tool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters as Anthropic.Tool["input_schema"],
  };
}
