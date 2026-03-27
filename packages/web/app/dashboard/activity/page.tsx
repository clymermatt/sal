import { fetchDashboard } from "@/lib/api";
import { requireBusinessId } from "@/lib/auth-guard";

interface ActivityData {
  actions: Array<{
    id: string;
    agent_name: string;
    action_type: string;
    description: string;
    created_at: string;
  }>;
  pagination: { page: number; limit: number; total: number; pages: number };
}

const AGENT_COLORS: Record<string, string> = {
  intake: "bg-blue-100 text-blue-700",
  dispatch: "bg-orange-100 text-orange-700",
  revenue: "bg-green-100 text-green-700",
  customer: "bg-purple-100 text-purple-700",
  intelligence: "bg-teal-100 text-teal-700",
};

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const businessId = await requireBusinessId();
  const data = await fetchDashboard<ActivityData>(businessId, "/activity", {
    page: params.page ?? "1",
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Sal&apos;s Activity</h1>
        <p className="text-sm text-gray-500">{data.pagination.total} actions</p>
      </div>

      <div className="space-y-3">
        {data.actions.map((action) => {
          const colors = AGENT_COLORS[action.agent_name] ?? "bg-gray-100 text-gray-600";
          const time = new Date(action.created_at);

          return (
            <div
              key={action.id}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colors}`}
                >
                  {action.agent_name}
                </span>
                <span className="text-xs text-gray-400">
                  {time.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  {time.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-xs text-gray-400">
                  {action.action_type.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-sm text-gray-700">{action.description}</p>
            </div>
          );
        })}
      </div>

      {data.actions.length === 0 && (
        <p className="text-gray-500 text-center py-12">
          No activity yet. Sal will log actions here as they happen.
        </p>
      )}

      {data.pagination.pages > 1 && (
        <div className="flex gap-2 mt-6 justify-center">
          {Array.from({ length: Math.min(data.pagination.pages, 10) }, (_, i) => (
            <a
              key={i}
              href={`/dashboard/activity?page=${i + 1}`}
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
