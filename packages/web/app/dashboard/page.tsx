import { fetchDashboard } from "@/lib/api";
import { requireBusinessId } from "@/lib/auth-guard";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";

interface TodayData {
  date: string;
  summary: {
    total: number;
    assigned: number;
    unassigned: number;
    emergencies: number;
    on_hold: number;
  };
  by_tech: Record<
    string,
    {
      tech_name: string;
      jobs: Array<{
        id: string;
        job_type: string;
        address: string;
        scheduled_start: string;
        status: string;
        is_emergency: boolean;
        customers: { name: string };
      }>;
    }
  >;
  unassigned: Array<{
    id: string;
    job_type: string;
    address: string;
    scheduled_start: string;
    status: string;
    is_emergency: boolean;
    customers: { name: string };
  }>;
}

export default async function DashboardHome() {
  const businessId = await requireBusinessId();
  const data = await fetchDashboard<TodayData>(businessId, "/today");
  const { summary, by_tech, unassigned } = data;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Today&apos;s Schedule</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Jobs" value={summary.total} />
        <StatCard label="Assigned" value={summary.assigned} />
        <StatCard label="Unassigned" value={summary.unassigned} />
        <StatCard
          label="Emergencies"
          value={summary.emergencies}
          sub={summary.on_hold > 0 ? `${summary.on_hold} on hold` : undefined}
        />
      </div>

      {unassigned.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-red-600 mb-3">
            Needs Assignment ({unassigned.length})
          </h2>
          <div className="bg-white rounded-xl border border-red-200 divide-y">
            {unassigned.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}

      {Object.entries(by_tech).map(([techId, { tech_name, jobs }]) => (
        <div key={techId} className="mb-8">
          <h2 className="text-lg font-semibold mb-3">
            {tech_name} ({jobs.length} jobs)
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y">
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
        </div>
      ))}

      {summary.total === 0 && (
        <p className="text-gray-500 text-center py-12">
          No jobs scheduled for today.
        </p>
      )}
    </div>
  );
}

function JobRow({
  job,
}: {
  job: {
    id: string;
    job_type: string;
    address: string;
    scheduled_start: string;
    status: string;
    is_emergency: boolean;
    customers: { name: string };
  };
}) {
  const time = new Date(job.scheduled_start).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="w-20 text-sm font-medium text-gray-600">{time}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">
            {(job.customers as { name: string })?.name ?? "Unknown"}
          </span>
          {job.is_emergency && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
              EMERGENCY
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 truncate">
          {job.job_type} &middot; {job.address}
        </p>
      </div>
      <StatusBadge status={job.status} />
    </div>
  );
}
