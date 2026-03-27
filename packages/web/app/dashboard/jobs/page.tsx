import { fetchDashboard } from "@/lib/api";
import { requireBusinessId } from "@/lib/auth-guard";
import { StatusBadge } from "@/components/status-badge";

interface JobsData {
  jobs: Array<{
    id: string;
    job_type: string;
    address: string;
    scheduled_start: string;
    status: string;
    is_emergency: boolean;
    tech_id: string | null;
    hold_reason: string | null;
    flat_rate: number | null;
    customers: { name: string; phone: string };
    technicians: { name: string } | null;
  }>;
  pagination: { page: number; limit: number; total: number; pages: number };
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const businessId = await requireBusinessId();
  const data = await fetchDashboard<JobsData>(businessId, "/jobs", {
    status: params.status ?? "",
    tech_id: params.tech_id ?? "",
    date_from: params.date_from ?? "",
    date_to: params.date_to ?? "",
    page: params.page ?? "1",
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <p className="text-sm text-gray-500">{data.pagination.total} total</p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {["", "booked", "en_route", "in_progress", "on_hold", "complete", "cancelled"].map(
          (s) => (
            <a
              key={s}
              href={`/dashboard/jobs${s ? `?status=${s}` : ""}`}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                (params.status ?? "") === s
                  ? "bg-blue-600 text-white"
                  : "bg-white border text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s ? s.replace(/_/g, " ") : "All"}
            </a>
          ),
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Job Type</th>
              <th className="px-4 py-3 font-medium">Tech</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.jobs.map((job) => {
              const date = new Date(job.scheduled_start);
              return (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {" "}
                    <span className="text-gray-400">
                      {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{job.customers?.name}</div>
                    <div className="text-gray-400 text-xs">{job.address}</div>
                  </td>
                  <td className="px-4 py-3">
                    {job.job_type}
                    {job.is_emergency && (
                      <span className="ml-1 text-xs text-red-500">!!</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {job.technicians?.name ?? <span className="text-gray-400 italic">unassigned</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                    {job.hold_reason && (
                      <span className="ml-1 text-xs text-gray-400">
                        ({job.hold_reason.replace(/_/g, " ")})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {job.flat_rate ? `$${Number(job.flat_rate).toFixed(0)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {data.jobs.length === 0 && (
          <p className="text-gray-500 text-center py-12">No jobs found.</p>
        )}
      </div>

      {data.pagination.pages > 1 && (
        <div className="flex gap-2 mt-4 justify-center">
          {Array.from({ length: data.pagination.pages }, (_, i) => (
            <a
              key={i}
              href={`/dashboard/jobs?page=${i + 1}${params.status ? `&status=${params.status}` : ""}`}
              className={`px-3 py-1 rounded text-sm ${
                data.pagination.page === i + 1
                  ? "bg-blue-600 text-white"
                  : "bg-white border text-gray-600"
              }`}
            >
              {i + 1}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
