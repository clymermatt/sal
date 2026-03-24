import type { ToolName } from "@pipeai/shared";
import { getSupabase } from "../db/client.js";
import type { ToolDefinition } from "../orchestration/types.js";

export const getJobCostsTool: ToolDefinition = {
  name: "get_job_costs" as ToolName,
  description:
    "Get revenue, job counts, and margins for a time period. Use for business performance reporting.",
  parameters: {
    type: "object" as const,
    properties: {
      start_date: {
        type: "string",
        description: "Start date (YYYY-MM-DD). Defaults to 30 days ago.",
      },
      end_date: {
        type: "string",
        description: "End date (YYYY-MM-DD). Defaults to today.",
      },
      group_by: {
        type: "string",
        description: "Group results by: tech, job_type, day, week, or month. Default: none (totals only).",
      },
    },
    required: [],
  },
  async execute(input, businessId) {
    const supabase = getSupabase();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startDate = (input.start_date as string) || thirtyDaysAgo.toISOString().split("T")[0];
    const endDate = (input.end_date as string) || now.toISOString().split("T")[0];

    // Get all completed jobs in the range
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, job_type, tech_id, scheduled_start, flat_rate, estimated_mins, is_emergency, status")
      .eq("business_id", businessId)
      .gte("scheduled_start", `${startDate}T00:00:00`)
      .lte("scheduled_start", `${endDate}T23:59:59`);

    // Get invoices for revenue data
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, job_id, total, payment_status, invoiced_at, paid_at")
      .eq("business_id", businessId)
      .gte("invoiced_at", `${startDate}T00:00:00`)
      .lte("invoiced_at", `${endDate}T23:59:59`);

    // Get tech names for grouping
    const { data: techs } = await supabase
      .from("technicians")
      .select("id, name")
      .eq("business_id", businessId);

    const techMap = new Map((techs ?? []).map((t) => [t.id, t.name]));
    const allJobs = jobs ?? [];
    const allInvoices = invoices ?? [];

    // Calculate totals
    const totalJobs = allJobs.length;
    const completedJobs = allJobs.filter((j) => j.status === "complete").length;
    const cancelledJobs = allJobs.filter((j) => j.status === "cancelled").length;
    const emergencyJobs = allJobs.filter((j) => j.is_emergency).length;

    const totalRevenue = allInvoices
      .filter((i) => i.payment_status === "paid")
      .reduce((sum, i) => sum + Number(i.total), 0);

    const totalInvoiced = allInvoices.reduce((sum, i) => sum + Number(i.total), 0);

    const totalOutstanding = allInvoices
      .filter((i) => i.payment_status !== "paid" && i.payment_status !== "void")
      .reduce((sum, i) => sum + Number(i.total), 0);

    const totalScheduledMins = allJobs.reduce((sum, j) => sum + (j.estimated_mins ?? 60), 0);

    const result: Record<string, unknown> = {
      period: { start_date: startDate, end_date: endDate },
      summary: {
        total_jobs: totalJobs,
        completed_jobs: completedJobs,
        cancelled_jobs: cancelledJobs,
        emergency_jobs: emergencyJobs,
        emergency_rate: totalJobs > 0 ? `${((emergencyJobs / totalJobs) * 100).toFixed(1)}%` : "0%",
        total_revenue_collected: totalRevenue,
        total_invoiced: totalInvoiced,
        total_outstanding: totalOutstanding,
        collection_rate: totalInvoiced > 0 ? `${((totalRevenue / totalInvoiced) * 100).toFixed(1)}%` : "N/A",
        total_scheduled_hours: (totalScheduledMins / 60).toFixed(1),
        avg_revenue_per_job: totalJobs > 0 ? (totalInvoiced / totalJobs).toFixed(2) : "0",
      },
    };

    // Group by if requested
    const groupBy = input.group_by as string | undefined;

    if (groupBy === "tech") {
      const byTech: Record<string, { jobs: number; revenue: number; hours: number }> = {};
      for (const job of allJobs) {
        const name = techMap.get(job.tech_id) ?? "Unassigned";
        if (!byTech[name]) byTech[name] = { jobs: 0, revenue: 0, hours: 0 };
        byTech[name].jobs++;
        byTech[name].hours += (job.estimated_mins ?? 60) / 60;
      }
      // Add revenue from invoices
      for (const inv of allInvoices.filter((i) => i.payment_status === "paid")) {
        const job = allJobs.find((j) => j.id === inv.job_id);
        if (job) {
          const name = techMap.get(job.tech_id) ?? "Unassigned";
          if (byTech[name]) byTech[name].revenue += Number(inv.total);
        }
      }
      result.by_tech = byTech;
    }

    if (groupBy === "job_type") {
      const byType: Record<string, { jobs: number; revenue: number }> = {};
      for (const job of allJobs) {
        const type = job.job_type ?? "Unknown";
        if (!byType[type]) byType[type] = { jobs: 0, revenue: 0 };
        byType[type].jobs++;
      }
      for (const inv of allInvoices.filter((i) => i.payment_status === "paid")) {
        const job = allJobs.find((j) => j.id === inv.job_id);
        if (job) {
          const type = job.job_type ?? "Unknown";
          if (byType[type]) byType[type].revenue += Number(inv.total);
        }
      }
      result.by_job_type = byType;
    }

    if (groupBy === "day" || groupBy === "week" || groupBy === "month") {
      const byPeriod: Record<string, { jobs: number; revenue: number }> = {};
      for (const job of allJobs) {
        const date = new Date(job.scheduled_start);
        let key: string;
        if (groupBy === "day") {
          key = date.toISOString().split("T")[0];
        } else if (groupBy === "week") {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = `week_of_${weekStart.toISOString().split("T")[0]}`;
        } else {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        }
        if (!byPeriod[key]) byPeriod[key] = { jobs: 0, revenue: 0 };
        byPeriod[key].jobs++;
      }
      result.by_period = byPeriod;
    }

    return result;
  },
};
