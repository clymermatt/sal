import type { ToolName } from "@pipeai/shared";
import { getSupabase } from "../db/client.js";
import { logger } from "../lib/logger.js";
import { sendSMS } from "../lib/twilio.js";
import { updateTechLocation } from "../agents/dispatch/scheduler.js";
import type { ToolDefinition } from "../orchestration/types.js";

const HOLD_REASONS = [
  "scheduling_overflow",
  "parts_needed",
  "equipment_needed",
  "customer_material",
  "scope_change",
  "customer_approval",
  "financing_needed",
  "access_issue",
  "permit_required",
  "inspection_needed",
  "utility_locate",
  "second_tech_needed",
  "senior_review",
  "safety_hazard",
  "property_coordination",
  "code_issue",
] as const;

// Which blocker type each reason maps to
const REASON_TO_BLOCKER: Record<string, string> = {
  scheduling_overflow: "internal",
  parts_needed: "external",
  equipment_needed: "internal",
  customer_material: "customer",
  scope_change: "customer",
  customer_approval: "customer",
  financing_needed: "customer",
  access_issue: "customer",
  permit_required: "internal",
  inspection_needed: "external",
  utility_locate: "external",
  second_tech_needed: "internal",
  senior_review: "internal",
  safety_hazard: "external",
  property_coordination: "external",
  code_issue: "customer",
};

export const putJobOnHoldTool: ToolDefinition = {
  name: "put_job_on_hold" as ToolName,
  description:
    "Put an incomplete job on hold with a reason. Use when a tech can't finish a job and needs to come back.",
  parameters: {
    type: "object" as const,
    properties: {
      job_id: { type: "string", description: "ID of the job to put on hold" },
      hold_reason: {
        type: "string",
        description: `Reason: ${HOLD_REASONS.join(", ")}`,
      },
      hold_notes: {
        type: "string",
        description: "Details about the hold (e.g., 'Ferguson order #12345, ETA Wednesday')",
      },
      expected_clear_date: {
        type: "string",
        description: "When we expect the blocker to clear (YYYY-MM-DD). Optional.",
      },
    },
    required: ["job_id", "hold_reason"],
  },
  async execute(input, businessId) {
    const supabase = getSupabase();
    const reason = input.hold_reason as string;

    if (!HOLD_REASONS.includes(reason as typeof HOLD_REASONS[number])) {
      return { success: false, error: `Invalid hold reason: ${reason}` };
    }

    const blocker = REASON_TO_BLOCKER[reason] ?? "internal";

    // Get job details
    const { data: job } = await supabase
      .from("jobs")
      .select("id, tech_id, customer_id, address, job_type")
      .eq("id", input.job_id as string)
      .eq("business_id", businessId)
      .single();

    if (!job) {
      return { success: false, error: "Job not found" };
    }

    // If scheduling_overflow, auto-schedule as priority return for next day
    const isAutoRebook = reason === "scheduling_overflow";
    const newStatus = isAutoRebook ? "return_scheduled" : "on_hold";

    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        status: newStatus,
        hold_reason: reason,
        hold_blocker: blocker,
        hold_notes: (input.hold_notes as string) || null,
        hold_expected_clear: (input.expected_clear_date as string) || null,
      })
      .eq("id", job.id);

    if (updateError) {
      logger.error({ updateError }, "Failed to put job on hold");
      return { success: false, error: "Failed to update job" };
    }

    // Update tech's last known address to this job site
    if (job.tech_id && job.address) {
      await updateTechLocation(job.tech_id, job.address);
    }

    // Get business + owner info for alerts
    const { data: business } = await supabase
      .from("businesses")
      .select("name, owner_cell")
      .eq("id", businessId)
      .single();

    // Alert owner for high-priority holds
    const ownerAlertReasons = [
      "safety_hazard", "scope_change", "code_issue", "senior_review",
    ];
    if (business?.owner_cell && ownerAlertReasons.includes(reason)) {
      await sendSMS(
        business.owner_cell,
        `⚠️ Job on hold: ${job.job_type}\n` +
        `Reason: ${reason.replace(/_/g, " ")}\n` +
        `${input.hold_notes ? `Notes: ${input.hold_notes}\n` : ""}` +
        `This needs your attention.`,
      );
    }

    logger.info(
      { jobId: job.id, reason, blocker, status: newStatus },
      "Job put on hold",
    );

    return {
      success: true,
      job_id: job.id,
      status: newStatus,
      hold_reason: reason,
      hold_blocker: blocker,
      auto_rebooked: isAutoRebook,
      message: isAutoRebook
        ? "Job marked as priority return — will be first on tech's schedule tomorrow"
        : `Job on hold (${blocker} blocker). Will follow up when cleared.`,
    };
  },
};

export const clearJobHoldTool: ToolDefinition = {
  name: "clear_job_hold" as ToolName,
  description:
    "Clear a hold on a job when the blocker is resolved. Moves job back to schedulable state.",
  parameters: {
    type: "object" as const,
    properties: {
      job_id: { type: "string", description: "ID of the held job" },
      resolution_notes: {
        type: "string",
        description: "What resolved the hold (e.g., 'Parts received', 'Customer approved quote')",
      },
    },
    required: ["job_id"],
  },
  async execute(input, businessId) {
    const supabase = getSupabase();

    const { data: job } = await supabase
      .from("jobs")
      .select("id, tech_id, customer_id, job_type, hold_reason, hold_blocker")
      .eq("id", input.job_id as string)
      .eq("business_id", businessId)
      .in("status", ["on_hold", "return_scheduled"])
      .single();

    if (!job) {
      return { success: false, error: "Held job not found" };
    }

    // Move to booked (ready to be scheduled)
    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        status: "booked",
        hold_reason: null,
        hold_blocker: null,
        hold_notes: (input.resolution_notes as string) || null,
        hold_expected_clear: null,
      })
      .eq("id", job.id);

    if (updateError) {
      return { success: false, error: "Failed to clear hold" };
    }

    // Notify customer that we can schedule their return
    const { data: customer } = await supabase
      .from("customers")
      .select("name, phone")
      .eq("id", job.customer_id)
      .single();

    const { data: business } = await supabase
      .from("businesses")
      .select("name")
      .eq("id", businessId)
      .single();

    if (customer?.phone) {
      await sendSMS(
        customer.phone,
        `Hi ${customer.name.split(" ")[0]}! ${business?.name ?? "Your plumber"} here. ` +
        `Good news — we're ready to schedule your return visit for ${job.job_type}. ` +
        `We'll reach out shortly to find a time that works.`,
      );
    }

    logger.info(
      { jobId: job.id, previousReason: job.hold_reason },
      "Job hold cleared — ready to schedule",
    );

    return {
      success: true,
      job_id: job.id,
      status: "booked",
      previous_reason: job.hold_reason,
      customer_notified: !!customer?.phone,
    };
  },
};
