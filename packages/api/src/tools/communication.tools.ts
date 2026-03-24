import type { ToolName } from "@pipeai/shared";
import { getSupabase } from "../db/client.js";
import { logger } from "../lib/logger.js";
import { sendSMS } from "../lib/twilio.js";
import { insertEmergency } from "../agents/dispatch/emergency.js";
import type { ToolDefinition } from "../orchestration/types.js";

export const sendSmsTool: ToolDefinition = {
  name: "send_sms" as ToolName,
  description: "Send an SMS message to a phone number.",
  parameters: {
    type: "object" as const,
    properties: {
      to: { type: "string", description: "Recipient phone number" },
      message: { type: "string", description: "SMS message body" },
    },
    required: ["to", "message"],
  },
  async execute(input, businessId) {
    const to = input.to as string;
    const message = input.message as string;

    const result = await sendSMS(to, message);

    logger.info(
      { to, messageLength: message.length, businessId, sid: result.sid },
      result.success ? "SMS sent" : "SMS send failed",
    );

    return {
      success: result.success,
      to,
      message_length: message.length,
      status: result.success ? "sent" : "failed",
      sid: result.sid,
      error: result.error,
    };
  },
};

export const createOwnerAlertTool: ToolDefinition = {
  name: "create_owner_alert" as ToolName,
  description:
    "Send an urgent alert to the business owner via SMS. Use for emergencies, escalations, or when a caller requests to speak to a human.",
  parameters: {
    type: "object" as const,
    properties: {
      alert_type: {
        type: "string",
        description: "Type of alert: emergency | escalation | callback_request",
      },
      caller_name: { type: "string", description: "Caller's name if provided" },
      caller_phone: { type: "string", description: "Caller's phone number" },
      address: { type: "string", description: "Address if collected" },
      issue_description: {
        type: "string",
        description: "Brief description of the issue",
      },
    },
    required: ["alert_type", "caller_phone", "issue_description"],
  },
  async execute(input, businessId) {
    const supabase = getSupabase();

    // Store the alert in the database
    const { data: alert, error } = await supabase
      .from("owner_alerts")
      .insert({
        business_id: businessId,
        alert_type: input.alert_type as string,
        message: formatAlertMessage(input),
      })
      .select("id")
      .single();

    if (error) {
      logger.error({ error }, "Failed to create owner alert");
      return { success: false, error: "Failed to create alert" };
    }

    // Get owner phone number
    const { data: business } = await supabase
      .from("businesses")
      .select("owner_cell, name")
      .eq("id", businessId)
      .single();

    let ownerNotified = false;
    if (business?.owner_cell) {
      const smsResult = await sendSMS(business.owner_cell, formatAlertMessage(input));
      ownerNotified = smsResult.success;

      logger.info(
        {
          alertId: alert?.id,
          ownerCell: business.owner_cell,
          alertType: input.alert_type,
          smsSent: smsResult.success,
        },
        ownerNotified ? "Owner alert SMS sent" : "Owner alert created (SMS failed)",
      );
    }

    // For emergency alerts: immediately create a job and dispatch a tech
    // This is a hard-coded path — we don't rely on the LLM choosing to book
    let emergencyDispatch = null;
    if ((input.alert_type as string) === "emergency" && input.address) {
      const callerPhone = input.caller_phone as string;
      const callerName = (input.caller_name as string) || "Unknown";
      const address = input.address as string;
      const issueDescription = input.issue_description as string;

      // Find or create customer
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("business_id", businessId)
        .eq("phone", callerPhone)
        .single();

      let customerId: string;
      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer } = await supabase
          .from("customers")
          .insert({ business_id: businessId, name: callerName, phone: callerPhone, address })
          .select("id")
          .single();
        customerId = newCustomer?.id ?? "";
      }

      if (customerId) {
        // Create the emergency job
        const { data: emergencyJob } = await supabase
          .from("jobs")
          .insert({
            business_id: businessId,
            customer_id: customerId,
            status: "booked",
            job_type: "Emergency callout",
            address,
            scheduled_start: new Date().toISOString(),
            is_emergency: true,
            notes: issueDescription,
          })
          .select("id")
          .single();

        if (emergencyJob) {
          // Dispatch the nearest available tech
          const dispatchResult = await insertEmergency(businessId, emergencyJob.id);
          emergencyDispatch = dispatchResult;

          logger.info(
            { jobId: emergencyJob.id, dispatch: dispatchResult },
            "Emergency job created and tech dispatched",
          );
        }
      }
    }

    return {
      success: true,
      alert_id: alert?.id,
      status: "alert_created",
      owner_notified: ownerNotified,
      emergency_dispatch: emergencyDispatch,
    };
  },
};

export const makeCallTool: ToolDefinition = {
  name: "make_call" as ToolName,
  description:
    "Initiate an outbound phone call. Used for emergency escalation to owner.",
  parameters: {
    type: "object" as const,
    properties: {
      to: { type: "string", description: "Phone number to call" },
      reason: { type: "string", description: "Reason for the call" },
    },
    required: ["to", "reason"],
  },
  async execute(input, businessId) {
    // TODO: Implement Twilio outbound call
    logger.info(
      { to: input.to, reason: input.reason, businessId },
      "Outbound call requested (Twilio not configured)",
    );

    return {
      success: true,
      to: input.to,
      status: "queued",
      note: "Twilio integration pending — call logged but not placed",
    };
  },
};

export const getCustomerHistoryTool: ToolDefinition = {
  name: "get_customer_history" as ToolName,
  description: "Retrieve job and payment history for a customer by phone number.",
  parameters: {
    type: "object" as const,
    properties: {
      phone: { type: "string", description: "Customer phone number" },
    },
    required: ["phone"],
  },
  async execute(input, businessId) {
    const supabase = getSupabase();

    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, phone, address, notes, lifetime_value, job_count, last_job_at, on_plan")
      .eq("business_id", businessId)
      .eq("phone", input.phone as string)
      .single();

    if (!customer) {
      return { found: false, message: "No customer found with this phone number" };
    }

    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, job_type, status, scheduled_start, is_emergency, notes, flat_rate")
      .eq("customer_id", customer.id)
      .order("scheduled_start", { ascending: false })
      .limit(10);

    return {
      found: true,
      customer: {
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        notes: customer.notes,
        lifetime_value: customer.lifetime_value,
        job_count: customer.job_count,
        last_job_at: customer.last_job_at,
        on_maintenance_plan: customer.on_plan,
      },
      recent_jobs: jobs ?? [],
    };
  },
};

function formatAlertMessage(input: Record<string, unknown>): string {
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return [
    `🚨 ${(input.alert_type as string).toUpperCase()} — ${time}`,
    `Caller: ${(input.caller_name as string) || "Unknown"} (${input.caller_phone})`,
    `Address: ${(input.address as string) || "Not yet collected"}`,
    `Issue: ${input.issue_description}`,
    `Sal is on the line with them now.`,
  ].join("\n");
}
