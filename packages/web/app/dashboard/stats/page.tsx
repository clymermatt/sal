import { fetchDashboard } from "@/lib/api";
import { requireBusinessId } from "@/lib/auth-guard";
import { StatCard } from "@/components/stat-card";

interface StatsData {
  period: { days: number; start_date: string; end_date: string };
  jobs: {
    total: number;
    completed: number;
    cancelled: number;
    emergencies: number;
    completion_rate: number;
    emergency_rate: number;
  };
  revenue: {
    collected: number;
    invoiced: number;
    outstanding: number;
    collection_rate: number;
    avg_per_job: number;
  };
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const businessId = await requireBusinessId();
  const period = params.period ?? "30d";
  const data = await fetchDashboard<StatsData>(businessId, "/stats", { period });

  const fmt = (n: number) => `$${n.toLocaleString()}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Business Stats</h1>
        <div className="flex gap-2">
          {["7d", "30d", "90d"].map((p) => (
            <a
              key={p}
              href={`/dashboard/stats?period=${p}`}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                period === p
                  ? "bg-blue-600 text-white"
                  : "bg-white border text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "90 Days"}
            </a>
          ))}
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">Revenue</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Collected" value={fmt(data.revenue.collected)} />
        <StatCard label="Invoiced" value={fmt(data.revenue.invoiced)} />
        <StatCard label="Outstanding" value={fmt(data.revenue.outstanding)} />
        <StatCard
          label="Collection Rate"
          value={`${data.revenue.collection_rate}%`}
          sub={`${fmt(data.revenue.avg_per_job)} avg/job`}
        />
      </div>

      <h2 className="text-lg font-semibold mb-3">Jobs</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Jobs" value={data.jobs.total} />
        <StatCard label="Completed" value={data.jobs.completed} />
        <StatCard label="Cancelled" value={data.jobs.cancelled} />
        <StatCard
          label="Completion Rate"
          value={`${data.jobs.completion_rate}%`}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Emergencies" value={data.jobs.emergencies} />
        <StatCard
          label="Emergency Rate"
          value={`${data.jobs.emergency_rate}%`}
          sub={data.jobs.emergency_rate > 25 ? "Above 25% — investigate" : undefined}
        />
      </div>

      <p className="text-xs text-gray-400 mt-8">
        {data.period.start_date} to {data.period.end_date}
      </p>
    </div>
  );
}
