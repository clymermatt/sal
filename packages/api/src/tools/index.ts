import {
  scheduleJobTool,
  getAvailableSlotsTool,
  rescheduleJobTool,
} from "./scheduling.tools.js";
import {
  sendSmsTool,
  createOwnerAlertTool,
  makeCallTool,
  getCustomerHistoryTool,
} from "./communication.tools.js";
import { toolRegistry } from "../orchestration/tool-registry.js";

export function registerAllTools(): void {
  toolRegistry.register(scheduleJobTool);
  toolRegistry.register(getAvailableSlotsTool);
  toolRegistry.register(rescheduleJobTool);
  toolRegistry.register(sendSmsTool);
  toolRegistry.register(createOwnerAlertTool);
  toolRegistry.register(makeCallTool);
  toolRegistry.register(getCustomerHistoryTool);
}
