import type { ToolName } from "@pipeai/shared";
import { getSupabase } from "../db/client.js";
import { logger } from "../lib/logger.js";
import { sendSMS } from "../lib/twilio.js";
import { insertEmergency } from "../agents/dispatch/emergency.js";
import { bookingConfirmationSMS } from "../prompts/messages.js";
import type { ToolDefinition } from "../orchestration/types.js";

export const scheduleJobTool: ToolDefinition = {
  name: "schedule_job" as ToolName,
  description:
    "Book a new job onto the schedule. Requires customer info, job type, address, and time slot.",
  parameters: {
    type: "object" as const,
    properties: {
      customer_name: { type: "string", description: "Customer's name" },
      customer_phone: { type: "string", description: "Customer's phone number" },
      address: { type: "string", description: "Job site address" },
      job_type: { type: "string", description: "Type of plumbing job" },
      notes: { type: "string", description: "Additional details about the problem" },
      scheduled_start: {
        type: "string",
        description: "ISO 8601 datetime for the scheduled start",
      },
      tech_id: { type: "string", description: "ID of the assigned technician" },
      is_emergency: {
        type: "boolean",
        description: "Whether this is an emergency job",
      },
    },
    required: ["customer_name", "customer_phone", "address", "job_type", "scheduled_start"],
  },
  async execute(input, businessId) {
    const supabase = getSupabase();

    // Find or create customer
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("business_id", businessId)
      .eq("phone", input.customer_phone as string)
      .single();

    let customerId: string;

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: custError } = await supabase
        .from("customers")
        .insert({
          business_id: businessId,
          name: input.customer_name as string,
          phone: input.customer_phone as string,
          address: input.address as string,
        })
        .select("id")
        .single();

      if (custError || !newCustomer) {
        logger.error({ custError }, "Failed to create customer");
        return { success: false, error: "Failed to create customer" };
      }
      customerId = newCustomer.id;
    }

    // Create the job
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        business_id: businessId,
        customer_id: customerId,
        tech_id: (input.tech_id as string) || null,
        status: "booked",
        job_type: input.job_type as string,
        address: input.address as string,
        scheduled_start: input.scheduled_start as string,
        is_emergency: (input.is_emergency as boolean) ?? false,
        notes: (input.notes as string) || null,
      })
      .select("id, status, scheduled_start")
      .single();

    if (jobError || !job) {
      logger.error({ jobError }, "Failed to create job");
      return { success: false, error: "Failed to create job" };
    }

    logger.info({ jobId: job.id, customerId }, "Job scheduled");

    // Look up business info for SMS templates
    const { data: business } = await supabase
      .from("businesses")
      .select("name, phone")
      .eq("id", businessId)
      .single();

    const businessName = business?.name ?? "Your plumber";
    const businessPhone = business?.phone ?? "";

    // If emergency, immediately dispatch a tech
    const isEmergency = (input.is_emergency as boolean) ?? false;
    let emergencyDispatch = null;

    if (isEmergency) {
      logger.info({ jobId: job.id }, "Emergency job — triggering immediate dispatch");
      const dispatchResult = await insertEmergency(businessId, job.id);
      emergencyDispatch = dispatchResult;

      if (dispatchResult.success && dispatchResult.techPhone) {
        // Notify tech of emergency dispatch
        await sendSMS(
          dispatchResult.techPhone,
          `🚨 EMERGENCY DISPATCH — ${businessName}\n` +
          `Customer: ${input.customer_name}\n` +
          `Address: ${input.address}\n` +
          `Issue: ${input.job_type}${input.notes ? " — " + input.notes : ""}\n` +
          `Head there ASAP. Reply CONFIRM when en route.`,
        );
      }

      if (dispatchResult.success) {
        // Send confirmation to customer with tech info
        await sendSMS(
          input.customer_phone as string,
          `${businessName}: We're sending ${dispatchResult.techName ?? "a technician"} ` +
          `to you right away for your ${input.job_type}. ` +
          `They'll be there as soon as possible. Hang tight!`,
        );
      }
    } else {
      // Standard booking — send confirmation SMS to customer
      const startDate = new Date(input.scheduled_start as string);
      const dateStr = startDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const timeStr = startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

      // Look up tech name if assigned
      let techName = "a technician";
      if (input.tech_id) {
        const { data: tech } = await supabase
          .from("technicians")
          .select("name")
          .eq("id", input.tech_id as string)
          .single();
        if (tech) techName = tech.name;
      }

      const confirmationMsg = bookingConfirmationSMS({
        customerFirstName: (input.customer_name as string).split(" ")[0],
        businessName,
        jobType: input.job_type as string,
        scheduledDate: dateStr,
        scheduledTime: timeStr,
        techName,
        businessPhone,
      });

      await sendSMS(input.customer_phone as string, confirmationMsg);
    }

    return {
      success: true,
      job_id: job.id,
      customer_id: customerId,
      status: job.status,
      scheduled_start: job.scheduled_start,
      emergency_dispatch: emergencyDispatch,
    };
  },
};

export const getAvailableSlotsTool: ToolDefinition = {
  name: "get_available_slots" as ToolName,
  description:
    "Query available schedule windows for technicians. Returns open time slots for a given date.",
  parameters: {
    type: "object" as const,
    properties: {
      date: {
        type: "string",
        description: "Date to check availability for (YYYY-MM-DD). Defaults to today.",
      },
      job_type: {
        type: "string",
        description: "Type of job — used to filter by tech skills",
      },
    },
    required: [],
  },
  async execute(input, businessId) {
    const supabase = getSupabase();
    const targetDate = (input.date as string) || new Date().toISOString().split("T")[0];

    // Get active technicians
    const { data: techs } = await supabase
      .from("technicians")
      .select("id, name, skills")
      .eq("business_id", businessId)
      .eq("is_active", true);

    if (!techs || techs.length === 0) {
      return { slots: [], message: "No technicians available" };
    }

    // Get existing jobs for the date
    const dayStart = `${targetDate}T00:00:00`;
    const dayEnd = `${targetDate}T23:59:59`;

    const { data: existingJobs } = await supabase
      .from("jobs")
      .select("tech_id, scheduled_start, scheduled_end, estimated_mins")
      .eq("business_id", businessId)
      .gte("scheduled_start", dayStart)
      .lte("scheduled_start", dayEnd)
      .neq("status", "cancelled");

    // Build available slots (simple: 8am-5pm, 1-hour blocks, skip occupied)
    const slots: Array<{
      tech_id: string;
      tech_name: string;
      start_time: string;
      available: boolean;
    }> = [];

    for (const tech of techs) {
      const techJobs = (existingJobs ?? []).filter((j) => j.tech_id === tech.id);
      const occupiedHours = new Set(
        techJobs.map((j) => new Date(j.scheduled_start).getHours()),
      );

      for (let hour = 8; hour <= 16; hour++) {
        if (!occupiedHours.has(hour)) {
          const padded = hour.toString().padStart(2, "0");
          slots.push({
            tech_id: tech.id,
            tech_name: tech.name,
            start_time: `${targetDate}T${padded}:00:00`,
            available: true,
          });
        }
      }
    }

    return {
      date: targetDate,
      slots: slots.slice(0, 10), // Return top 10 options
      total_available: slots.length,
    };
  },
};

export const rescheduleJobTool: ToolDefinition = {
  name: "reschedule_job" as ToolName,
  description:
    "Move an existing job to a new time slot and/or reassign to a different technician.",
  parameters: {
    type: "object" as const,
    properties: {
      job_id: { type: "string", description: "ID of the job to reschedule" },
      new_scheduled_start: {
        type: "string",
        description: "New ISO 8601 datetime for the job start",
      },
      new_tech_id: {
        type: "string",
        description: "New technician ID (optional — keeps current tech if omitted)",
      },
      reason: { type: "string", description: "Reason for rescheduling" },
    },
    required: ["job_id", "new_scheduled_start"],
  },
  async execute(input, businessId) {
    const supabase = getSupabase();
    const jobId = input.job_id as string;

    // Verify job belongs to this business
    const { data: job } = await supabase
      .from("jobs")
      .select("id, tech_id, customer_id, status")
      .eq("id", jobId)
      .eq("business_id", businessId)
      .single();

    if (!job) {
      return { success: false, error: "Job not found" };
    }

    if (job.status === "complete" || job.status === "cancelled") {
      return { success: false, error: `Cannot reschedule a ${job.status} job` };
    }

    const updates: Record<string, unknown> = {
      scheduled_start: input.new_scheduled_start as string,
    };

    if (input.new_tech_id) {
      updates.tech_id = input.new_tech_id as string;
    }

    const { error } = await supabase
      .from("jobs")
      .update(updates)
      .eq("id", jobId);

    if (error) {
      logger.error({ error, jobId }, "Failed to reschedule job");
      return { success: false, error: "Failed to reschedule job" };
    }

    logger.info(
      { jobId, newStart: input.new_scheduled_start, reason: input.reason },
      "Job rescheduled",
    );

    return {
      success: true,
      job_id: jobId,
      new_scheduled_start: input.new_scheduled_start,
      new_tech_id: input.new_tech_id ?? job.tech_id,
      reason: input.reason,
    };
  },
};
