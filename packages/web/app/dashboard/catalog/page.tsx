import { fetchDashboard } from "@/lib/api";
import { requireBusinessId } from "@/lib/auth-guard";

interface CatalogData {
  catalog: Array<{
    id: string;
    job_type: string;
    description: string | null;
    flat_rate: number | null;
    duration_mins: number | null;
    category: string;
    is_active: boolean;
  }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  emergency: "Emergency",
  repair: "Repair",
  installation: "Installation",
  maintenance: "Maintenance",
};

const CATEGORY_COLORS: Record<string, string> = {
  emergency: "bg-red-100 text-red-700",
  repair: "bg-blue-100 text-blue-700",
  installation: "bg-green-100 text-green-700",
  maintenance: "bg-purple-100 text-purple-700",
};

export default async function CatalogPage() {
  const businessId = await requireBusinessId();
  const data = await fetchDashboard<CatalogData>(businessId, "/catalog");

  // Group by category
  const grouped: Record<string, typeof data.catalog> = {};
  for (const item of data.catalog) {
    const cat = item.category ?? "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }

  const categoryOrder = ["emergency", "repair", "installation", "maintenance"];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Service Catalog</h1>
        <p className="text-sm text-gray-500">
          {data.catalog.length} services
        </p>
      </div>

      {categoryOrder.map((cat) => {
        const items = grouped[cat];
        if (!items || items.length === 0) return null;
        const colors = CATEGORY_COLORS[cat] ?? "bg-gray-100 text-gray-600";

        return (
          <div key={cat} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>
                {CATEGORY_LABELS[cat] ?? cat}
              </span>
              <span className="text-sm text-gray-400">
                {items.length} {items.length === 1 ? "service" : "services"}
              </span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">Service</th>
                    <th className="px-4 py-3 font-medium text-right">Rate</th>
                    <th className="px-4 py-3 font-medium text-right">Duration</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.job_type}</div>
                        {item.description && (
                          <div className="text-xs text-gray-400 mt-0.5">{item.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {item.flat_rate ? `$${Number(item.flat_rate).toFixed(0)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {item.duration_mins ? `${item.duration_mins} min` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {item.is_active ? (
                          <span className="text-xs text-green-600 font-medium">Active</span>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium">Inactive</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {data.catalog.length === 0 && (
        <p className="text-gray-500 text-center py-12">
          No services in the catalog yet.
        </p>
      )}
    </div>
  );
}
