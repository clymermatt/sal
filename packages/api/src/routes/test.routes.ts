import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import type { PipeAIEvent } from "@pipeai/shared";
import { handleEvent } from "../orchestration/event-router.js";
import { logger } from "../lib/logger.js";
import { sendSMS } from "../lib/twilio.js";

export async function registerTestRoutes(app: FastifyInstance): Promise<void> {
  // Send a real SMS to verify Twilio is working
  app.post(
    "/test/send-sms",
    async (request: FastifyRequest<{ Body: { to: string; message?: string } }>) => {
      const { to, message } = request.body;

      if (!to) {
        return { error: "to (phone number) is required" };
      }

      const body = message ?? "PipeAI test — if you received this, Twilio is working!";
      const result = await sendSMS(to, body);

      return {
        ...result,
        to,
        body,
      };
    },
  );

  // Simulate an inbound phone call
  app.post(
    "/test/simulate-call",
    async (request: FastifyRequest<{ Body: { businessId: string; transcript: string; callerPhone?: string } }>) => {
      const { businessId, transcript, callerPhone } = request.body;

      if (!businessId || !transcript) {
        return { error: "businessId and transcript are required" };
      }

      const event: PipeAIEvent = {
        id: randomUUID(),
        type: "inbound_call",
        businessId,
        payload: {
          transcript,
          callerPhone: callerPhone ?? "555-0199",
          source: "test-simulator",
        },
        source: "vapi",
        timestamp: new Date().toISOString(),
      };

      logger.info({ eventId: event.id }, "Simulating inbound call");

      const startTime = Date.now();
      await handleEvent(event);
      const duration = Date.now() - startTime;

      // Fetch the action log entry that was created
      const { getSupabase } = await import("../db/client.js");
      const supabase = getSupabase();
      const { data: logs } = await supabase
        .from("action_log")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(5);

      return {
        success: true,
        event_id: event.id,
        duration_ms: duration,
        action_log: logs,
      };
    },
  );

  // Simulate an inbound SMS
  app.post(
    "/test/simulate-sms",
    async (request: FastifyRequest<{ Body: { businessId: string; message: string; fromPhone?: string } }>) => {
      const { businessId, message, fromPhone } = request.body;

      if (!businessId || !message) {
        return { error: "businessId and message are required" };
      }

      const event: PipeAIEvent = {
        id: randomUUID(),
        type: "inbound_sms",
        businessId,
        payload: {
          body: message,
          from: fromPhone ?? "555-0199",
          isOwner: false,
        },
        source: "twilio",
        timestamp: new Date().toISOString(),
      };

      logger.info({ eventId: event.id }, "Simulating inbound SMS");

      const startTime = Date.now();
      await handleEvent(event);
      const duration = Date.now() - startTime;

      const { getSupabase } = await import("../db/client.js");
      const supabase = getSupabase();
      const { data: logs } = await supabase
        .from("action_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      return {
        success: true,
        event_id: event.id,
        duration_ms: duration,
        action_log: logs,
      };
    },
  );

  // Seed test data for a demo business
  app.post("/test/seed", async () => {
    const { getSupabase } = await import("../db/client.js");
    const supabase = getSupabase();

    // Create a test business
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .upsert(
        {
          name: "Mike's Plumbing",
          phone: "555-0100",
          pipeai_number: "+15550100",
          owner_cell: "+15550101",
          service_area_zips: ["78701", "78702", "78703", "78704", "78705"],
          timezone: "America/Chicago",
          business_hours: {
            mon: { open: "08:00", close: "17:00" },
            tue: { open: "08:00", close: "17:00" },
            wed: { open: "08:00", close: "17:00" },
            thu: { open: "08:00", close: "17:00" },
            fri: { open: "08:00", close: "17:00" },
          },
          plan: "pro",
        },
        { onConflict: "pipeai_number" },
      )
      .select("id")
      .single();

    if (bizError || !business) {
      return { error: "Failed to create business", details: bizError };
    }

    // Create technicians
    const techs = [
      { name: "Jake Thompson", phone: "+15550102", skills: ["drain_clearing", "leak_detection", "general"], business_id: business.id },
      { name: "Carlos Rivera", phone: "+15550103", skills: ["water_heater", "repiping", "gas", "general"], business_id: business.id },
    ];

    // Delete existing techs for this business before re-seeding
    await supabase.from("technicians").delete().eq("business_id", business.id);
    await supabase.from("technicians").insert(techs);

    // Seed service catalog
    const services = [
      { business_id: business.id, job_type: "Drain clearing — kitchen", flat_rate: 185, duration_mins: 60, category: "repair" },
      { business_id: business.id, job_type: "Drain clearing — bathroom", flat_rate: 165, duration_mins: 45, category: "repair" },
      { business_id: business.id, job_type: "Drain clearing — main line", flat_rate: 350, duration_mins: 120, category: "repair" },
      { business_id: business.id, job_type: "Toilet repair", flat_rate: 195, duration_mins: 60, category: "repair" },
      { business_id: business.id, job_type: "Toilet replacement", flat_rate: 450, duration_mins: 120, category: "installation" },
      { business_id: business.id, job_type: "Water heater repair", flat_rate: 275, duration_mins: 90, category: "repair" },
      { business_id: business.id, job_type: "Water heater replacement — tank", flat_rate: 1800, duration_mins: 240, category: "installation" },
      { business_id: business.id, job_type: "Water heater replacement — tankless", flat_rate: 3200, duration_mins: 360, category: "installation" },
      { business_id: business.id, job_type: "Leak repair — pipe", flat_rate: 225, duration_mins: 90, category: "repair" },
      { business_id: business.id, job_type: "Leak repair — faucet", flat_rate: 145, duration_mins: 45, category: "repair" },
      { business_id: business.id, job_type: "Faucet replacement", flat_rate: 275, duration_mins: 60, category: "installation" },
      { business_id: business.id, job_type: "Garbage disposal installation", flat_rate: 350, duration_mins: 60, category: "installation" },
      { business_id: business.id, job_type: "Sewer line camera inspection", flat_rate: 295, duration_mins: 60, category: "repair" },
      { business_id: business.id, job_type: "Emergency callout — after hours", flat_rate: 150, duration_mins: 30, category: "emergency" },
      { business_id: business.id, job_type: "Burst pipe repair", flat_rate: 475, duration_mins: 120, category: "emergency" },
    ];

    // Delete existing catalog for this business before re-seeding
    await supabase.from("service_catalog").delete().eq("business_id", business.id);
    await supabase.from("service_catalog").insert(services);

    return {
      success: true,
      business_id: business.id,
      message: "Test data seeded: Mike's Plumbing with 2 techs and 15 service catalog items",
    };
  });

  // Seed some unassigned jobs for dispatch testing
  app.post(
    "/test/seed-jobs",
    async (request: FastifyRequest<{ Body: { businessId: string } }>) => {
      const { businessId } = request.body;
      if (!businessId) return { error: "businessId required" };

      const { getSupabase } = await import("../db/client.js");
      const supabase = getSupabase();

      // Create a test customer
      const { data: customer } = await supabase
        .from("customers")
        .upsert(
          { business_id: businessId, name: "Sarah Johnson", phone: "555-0199", address: "45 Oak Ave, Austin TX 78702" },
          { onConflict: "business_id,phone" as never },
        )
        .select("id")
        .single();

      // Fallback: just insert
      let customerId = customer?.id;
      if (!customerId) {
        const { data: existing } = await supabase
          .from("customers")
          .select("id")
          .eq("business_id", businessId)
          .eq("phone", "555-0199")
          .single();
        customerId = existing?.id;

        if (!customerId) {
          const { data: created } = await supabase
            .from("customers")
            .insert({ business_id: businessId, name: "Sarah Johnson", phone: "555-0199", address: "45 Oak Ave, Austin TX 78702" })
            .select("id")
            .single();
          customerId = created?.id;
        }
      }

      if (!customerId) return { error: "Failed to create test customer" };

      const today = new Date().toISOString().split("T")[0];

      const jobs = [
        {
          business_id: businessId,
          customer_id: customerId,
          status: "booked",
          job_type: "Drain clearing — kitchen",
          required_skills: ["drain_clearing"],
          address: "45 Oak Ave, Austin TX",
          scheduled_start: `${today}T09:00:00`,
          estimated_mins: 60,
          is_emergency: false,
          notes: "Kitchen sink slow drain",
        },
        {
          business_id: businessId,
          customer_id: customerId,
          status: "booked",
          job_type: "Water heater repair",
          required_skills: ["water_heater"],
          address: "12 Pine St, Austin TX",
          scheduled_start: `${today}T11:00:00`,
          estimated_mins: 90,
          is_emergency: false,
          notes: "No hot water since yesterday",
        },
        {
          business_id: businessId,
          customer_id: customerId,
          status: "booked",
          job_type: "Burst pipe repair",
          required_skills: ["general"],
          address: "89 Elm Rd, Austin TX",
          scheduled_start: `${today}T14:00:00`,
          estimated_mins: 120,
          is_emergency: true,
          notes: "Pipe under kitchen sink",
        },
      ];

      // Clear existing test jobs for today
      await supabase
        .from("jobs")
        .delete()
        .eq("business_id", businessId)
        .gte("scheduled_start", `${today}T00:00:00`)
        .lte("scheduled_start", `${today}T23:59:59`);

      const { data: created, error } = await supabase
        .from("jobs")
        .insert(jobs)
        .select("id, job_type, tech_id, is_emergency");

      if (error) return { error: "Failed to create jobs", details: error };

      return {
        success: true,
        jobs_created: created?.length ?? 0,
        jobs: created,
        message: "3 unassigned jobs created for today (1 emergency)",
      };
    },
  );

  // Run the daily schedule builder
  app.post(
    "/test/build-schedule",
    async (request: FastifyRequest<{ Body: { businessId: string } }>) => {
      const { businessId } = request.body;
      if (!businessId) return { error: "businessId required" };

      const { buildDailySchedule } = await import("../agents/dispatch/scheduler.js");
      const assignments = await buildDailySchedule(businessId, new Date());

      return {
        success: true,
        assignments_made: assignments.length,
        assignments,
      };
    },
  );

  // Generate morning briefings
  app.post(
    "/test/morning-briefing",
    async (request: FastifyRequest<{ Body: { businessId: string } }>) => {
      const { businessId } = request.body;
      if (!businessId) return { error: "businessId required" };

      const { getSupabase } = await import("../db/client.js");
      const supabase = getSupabase();
      const { getTechDailySchedule, getBusinessDailyJobs } = await import("../agents/dispatch/scheduler.js");
      const { techMorningBriefingSMS, techNoJobsSMS, ownerMorningBriefingSMS, generateOwnerActionItem } = await import("../prompts/briefings.js");

      const today = new Date();
      const dateStr = today.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });

      // Get business info
      const { data: business } = await supabase
        .from("businesses")
        .select("name, owner_cell")
        .eq("id", businessId)
        .single();

      if (!business) return { error: "Business not found" };

      // Get all techs
      const { data: techs } = await supabase
        .from("technicians")
        .select("id, name, phone")
        .eq("business_id", businessId)
        .eq("is_active", true);

      const briefings: Array<{ tech: string; message: string }> = [];

      for (const tech of techs ?? []) {
        const jobs = await getTechDailySchedule(businessId, tech.id, today);

        if (jobs.length === 0) {
          briefings.push({
            tech: tech.name,
            message: techNoJobsSMS({
              techFirstName: tech.name.split(" ")[0],
              date: dateStr,
              ownerFirstName: "Mike",
            }),
          });
        } else {
          briefings.push({
            tech: tech.name,
            message: techMorningBriefingSMS({
              techFirstName: tech.name.split(" ")[0],
              date: dateStr,
              businessName: business.name,
              jobs: jobs.map((j) => {
                const startTime = new Date(j.scheduled_start).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                });
                const customer = j.customers as unknown as { name: string };
                return {
                  scheduledTime: startTime,
                  customerName: customer?.name ?? "Unknown",
                  address: j.address ?? "",
                  jobType: j.job_type ?? "",
                  notes: j.notes ?? "",
                  isEmergency: j.is_emergency,
                };
              }),
            }),
          });
        }
      }

      // Owner briefing
      const allJobs = await getBusinessDailyJobs(businessId, today);
      const techsWorking = new Set(allJobs.filter((j) => j.tech_id).map((j) => j.tech_id)).size;
      const emergencies = allJobs.filter((j) => j.is_emergency).length;

      const ownerBriefing = ownerMorningBriefingSMS({
        ownerFirstName: "Mike",
        date: dateStr,
        revenueYesterday: 0,
        jobsYesterday: 0,
        outstandingAR: 0,
        overdueCount: 0,
        jobsToday: allJobs.length,
        techsWorkingToday: techsWorking,
        emergenciesToday: emergencies,
        oneActionItem: generateOwnerActionItem({
          invoices: [],
          todayJobs: allJobs.map((j) => ({
            address: j.address ?? "",
            isEmergency: j.is_emergency,
            techConfirmed: !!j.tech_id,
          })),
          quotes: [],
          techsToday: (techs ?? []).map((t) => ({
            name: t.name,
            scheduledMins: allJobs.filter((j) => j.tech_id === t.id).length * 60,
            availableMins: 480,
          })),
          yesterdayUpsellsClosed: 0,
          yesterdayJobs: 0,
        }),
      });

      return {
        success: true,
        tech_briefings: briefings,
        owner_briefing: ownerBriefing,
      };
    },
  );
}
