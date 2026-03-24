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
import {
  createQuoteTool,
  createInvoiceTool,
  sendPaymentRequestTool,
  getArSummaryTool,
} from "./revenue.tools.js";
import { toolRegistry } from "../orchestration/tool-registry.js";

export function registerAllTools(): void {
  // Scheduling
  toolRegistry.register(scheduleJobTool);
  toolRegistry.register(getAvailableSlotsTool);
  toolRegistry.register(rescheduleJobTool);
  // Communication
  toolRegistry.register(sendSmsTool);
  toolRegistry.register(createOwnerAlertTool);
  toolRegistry.register(makeCallTool);
  toolRegistry.register(getCustomerHistoryTool);
  // Revenue
  toolRegistry.register(createQuoteTool);
  toolRegistry.register(createInvoiceTool);
  toolRegistry.register(sendPaymentRequestTool);
  toolRegistry.register(getArSummaryTool);
}
