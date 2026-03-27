import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getSupabase } from "../db/client.js";
import { requireAuth, getAuth } from "../lib/auth.js";

interface DashboardParams {
  businessId: string;
}

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  const supabase = getSupabase();

  // All dashboard routes require auth + business ownership check
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", async (request: FastifyRequest<{ Params: DashboardParams }>, reply: FastifyReply) => {
    const auth = getAuth(request);
    const { businessId } = request.params as { businessId?: string };
    if (businessId && businessId !== auth.businessId) {
      return reply.status(403).send({ error: "Access denied" });
    }
  });

  // Today's schedule — grouped by tech
  app.get(
    "/:businessId/today",
    async (request: FastifyRequest<{ Params: DashboardParams }>) => {
      const { businessId } = request.params;
      const today = new Date().toISOString().split("T")[0];

      const { data: jobs } = await supabase
        .from("jobs")
        .select(`
          id, job_type, address, scheduled_start, estimated_mins,
          is_emergency, status, notes, tech_id, hold_reason,
          customers!inner(name, phone),
          technicians(name, phone)
        `)
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .gte("scheduled_start", `${today}T00:00:00`)
        .lte("scheduled_start", `${today}T23:59:59`)
        .order("scheduled_start", { ascending: true });

      const allJobs = jobs ?? [];
      const assigned = allJobs.filter((j) => j.tech_id);
      const unassigned = allJobs.filter((j) => !j.tech_id);
      const emergencies = allJobs.filter((j) => j.is_emergency);
      const onHold = allJobs.filter((j) => j.status === "on_hold" || j.status === "return_scheduled");

      // Group by tech
      const byTech: Record<string, { tech_name: string; jobs: typeof allJobs }> = {};
      for (const job of assigned) {
        const tech = job.technicians as unknown as { name: string } | null;
        const techName = tech?.name ?? "Unknown";
        const techId = job.tech_id!;
        if (!byTech[techId]) byTech[techId] = { tech_name: techName, jobs: [] };
        byTech[techId].jobs.push(job);
      }

      return {
        date: today,
        summary: {
          total: allJobs.length,
          assigned: assigned.length,
          unassigned: unassigned.length,
          emergencies: emergencies.length,
          on_hold: onHold.length,
        },
        by_tech: byTech,
        unassigned,
      };
    },
  );

  // Jobs list — filterable, paginated
  app.get(
    "/:businessId/jobs",
    async (
      request: FastifyRequest<{
        Params: DashboardParams;
        Querystring: {
          status?: string;
          tech_id?: string;
          date_from?: string;
          date_to?: string;
          page?: string;
          limit?: string;
        };
      }>,
    ) => {
      const { businessId } = request.params;
      const { status, tech_id, date_from, date_to } = request.query;
      const page = parseInt(request.query.page ?? "1", 10);
      const limit = parseInt(request.query.limit ?? "50", 10);
      const offset = (page - 1) * limit;

      let query = supabase
        .from("jobs")
        .select(
          `id, job_type, address, scheduled_start, estimated_mins,
           is_emergency, status, notes, tech_id, hold_reason, hold_blocker, flat_rate,
           customers!inner(name, phone),
           technicians(name)`,
          { count: "exact" },
        )
        .eq("business_id", businessId)
        .order("scheduled_start", { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq("status", status);
      if (tech_id) query = query.eq("tech_id", tech_id);
      if (date_from) query = query.gte("scheduled_start", `${date_from}T00:00:00`);
      if (date_to) query = query.lte("scheduled_start", `${date_to}T23:59:59`);

      const { data: jobs, count } = await query;

      // Fill in missing flat_rate from service catalog
      const { data: catalog } = await supabase
        .from("service_catalog")
        .select("job_type, flat_rate")
        .eq("business_id", businessId);

      const catalogRates = new Map(
        (catalog ?? []).map((c) => [c.job_type, c.flat_rate]),
      );

      const enrichedJobs = (jobs ?? []).map((job) => ({
        ...job,
        flat_rate: job.flat_rate ?? catalogRates.get(job.job_type) ?? null,
      }));

      return {
        jobs: enrichedJobs,
        pagination: {
          page,
          limit,
          total: count ?? 0,
          pages: Math.ceil((count ?? 0) / limit),
        },
      };
    },
  );

  // Customers list — searchable, paginated
  app.get(
    "/:businessId/customers",
    async (
      request: FastifyRequest<{
        Params: DashboardParams;
        Querystring: { search?: string; page?: string; limit?: string };
      }>,
    ) => {
      const { businessId } = request.params;
      const { search } = request.query;
      const page = parseInt(request.query.page ?? "1", 10);
      const limit = parseInt(request.query.limit ?? "50", 10);
      const offset = (page - 1) * limit;

      let query = supabase
        .from("customers")
        .select("id, name, phone, address, notes, on_plan", {
          count: "exact",
        })
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      const { data: customers, count } = await query;

      // Calculate job_count and lifetime_value from actual jobs/invoices
      const enriched = await Promise.all(
        (customers ?? []).map(async (c) => {
          const { count: jobCount } = await supabase
            .from("jobs")
            .select("id", { count: "exact", head: true })
            .eq("customer_id", c.id);

          const { data: lastJob } = await supabase
            .from("jobs")
            .select("scheduled_start")
            .eq("customer_id", c.id)
            .order("scheduled_start", { ascending: false })
            .limit(1)
            .single();

          const { data: paidInvoices } = await supabase
            .from("invoices")
            .select("total")
            .eq("customer_id", c.id)
            .eq("payment_status", "paid");

          const lifetimeValue = (paidInvoices ?? []).reduce(
            (sum, inv) => sum + Number(inv.total),
            0,
          );

          return {
            ...c,
            job_count: jobCount ?? 0,
            lifetime_value: lifetimeValue,
            last_job_at: lastJob?.scheduled_start ?? null,
          };
        }),
      );

      return {
        customers: enriched,
        pagination: {
          page,
          limit,
          total: count ?? 0,
          pages: Math.ceil((count ?? 0) / limit),
        },
      };
    },
  );

  // Invoices list — filterable by payment status, paginated
  app.get(
    "/:businessId/invoices",
    async (
      request: FastifyRequest<{
        Params: DashboardParams;
        Querystring: { payment_status?: string; page?: string; limit?: string };
      }>,
    ) => {
      const { businessId } = request.params;
      const { payment_status } = request.query;
      const page = parseInt(request.query.page ?? "1", 10);
      const limit = parseInt(request.query.limit ?? "50", 10);
      const offset = (page - 1) * limit;

      let query = supabase
        .from("invoices")
        .select(
          `id, total, subtotal, tax, payment_status, payment_link,
           invoiced_at, paid_at,
           customers!inner(name, phone),
           jobs!inner(job_type)`,
          { count: "exact" },
        )
        .eq("business_id", businessId)
        .order("invoiced_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (payment_status) query = query.eq("payment_status", payment_status);

      const { data: invoices, count } = await query;

      return {
        invoices: invoices ?? [],
        pagination: {
          page,
          limit,
          total: count ?? 0,
          pages: Math.ceil((count ?? 0) / limit),
        },
      };
    },
  );

  // Activity log — Sal's action history
  app.get(
    "/:businessId/activity",
    async (
      request: FastifyRequest<{
        Params: DashboardParams;
        Querystring: { page?: string; limit?: string };
      }>,
    ) => {
      const { businessId } = request.params;
      const page = parseInt(request.query.page ?? "1", 10);
      const limit = parseInt(request.query.limit ?? "50", 10);
      const offset = (page - 1) * limit;

      const { data: actions, count } = await supabase
        .from("action_log")
        .select("id, agent_name, action_type, description, created_at", { count: "exact" })
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      return {
        actions: actions ?? [],
        pagination: {
          page,
          limit,
          total: count ?? 0,
          pages: Math.ceil((count ?? 0) / limit),
        },
      };
    },
  );

  // Business stats — revenue, job counts, etc.
  app.get(
    "/:businessId/stats",
    async (
      request: FastifyRequest<{
        Params: DashboardParams;
        Querystring: { period?: string };
      }>,
    ) => {
      const { businessId } = request.params;
      const periodDays = { "7d": 7, "30d": 30, "90d": 90 }[request.query.period ?? "30d"] ?? 30;

      const now = new Date();
      const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const endDate = now.toISOString().split("T")[0];

      // Jobs in period
      const { data: jobs } = await supabase
        .from("jobs")
        .select("id, status, is_emergency, estimated_mins, tech_id")
        .eq("business_id", businessId)
        .gte("scheduled_start", `${startDate}T00:00:00`)
        .lte("scheduled_start", `${endDate}T23:59:59`);

      // Invoices in period
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, total, payment_status, invoiced_at, paid_at")
        .eq("business_id", businessId)
        .gte("invoiced_at", `${startDate}T00:00:00`)
        .lte("invoiced_at", `${endDate}T23:59:59`);

      const allJobs = jobs ?? [];
      const allInvoices = invoices ?? [];

      const totalJobs = allJobs.length;
      const completedJobs = allJobs.filter((j) => j.status === "complete").length;
      const cancelledJobs = allJobs.filter((j) => j.status === "cancelled").length;
      const emergencyJobs = allJobs.filter((j) => j.is_emergency).length;

      const revenueCollected = allInvoices
        .filter((i) => i.payment_status === "paid")
        .reduce((sum, i) => sum + Number(i.total), 0);

      const totalInvoiced = allInvoices.reduce((sum, i) => sum + Number(i.total), 0);

      const outstanding = allInvoices
        .filter((i) => i.payment_status !== "paid" && i.payment_status !== "void")
        .reduce((sum, i) => sum + Number(i.total), 0);

      return {
        period: { days: periodDays, start_date: startDate, end_date: endDate },
        jobs: {
          total: totalJobs,
          completed: completedJobs,
          cancelled: cancelledJobs,
          emergencies: emergencyJobs,
          completion_rate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0,
          emergency_rate: totalJobs > 0 ? Math.round((emergencyJobs / totalJobs) * 100) : 0,
        },
        revenue: {
          collected: revenueCollected,
          invoiced: totalInvoiced,
          outstanding,
          collection_rate: totalInvoiced > 0 ? Math.round((revenueCollected / totalInvoiced) * 100) : 0,
          avg_per_job: totalJobs > 0 ? Math.round(totalInvoiced / totalJobs) : 0,
        },
      };
    },
  );

  // Service catalog
  app.get(
    "/:businessId/catalog",
    async (request: FastifyRequest<{ Params: DashboardParams }>) => {
      const { businessId } = request.params;

      const { data: catalog } = await supabase
        .from("service_catalog")
        .select("id, job_type, description, flat_rate, duration_mins, category, is_active")
        .eq("business_id", businessId)
        .order("category")
        .order("job_type");

      return { catalog: catalog ?? [] };
    },
  );
}
