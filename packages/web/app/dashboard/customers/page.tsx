import { fetchDashboard } from "@/lib/api";
import { requireBusinessId } from "@/lib/auth-guard";

interface CustomersData {
  customers: Array<{
    id: string;
    name: string;
    phone: string;
    address: string | null;
    lifetime_value: number | null;
    job_count: number | null;
    last_job_at: string | null;
    on_plan: boolean;
  }>;
  pagination: { page: number; limit: number; total: number; pages: number };
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const businessId = await requireBusinessId();
  const data = await fetchDashboard<CustomersData>(businessId, "/customers", {
    search: params.search ?? "",
    page: params.page ?? "1",
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-sm text-gray-500">{data.pagination.total} total</p>
      </div>

      <form className="mb-4">
        <input
          type="text"
          name="search"
          placeholder="Search by name or phone..."
          defaultValue={params.search ?? ""}
          className="w-full max-w-md px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Address</th>
              <th className="px-4 py-3 font-medium text-right">Jobs</th>
              <th className="px-4 py-3 font-medium text-right">Lifetime Value</th>
              <th className="px-4 py-3 font-medium">Last Job</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.customers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  {c.name}
                  {c.on_plan && (
                    <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                      Plan
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{c.address ?? "—"}</td>
                <td className="px-4 py-3 text-right">{c.job_count ?? 0}</td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {c.lifetime_value ? `$${Number(c.lifetime_value).toFixed(0)}` : "—"}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {c.last_job_at
                    ? new Date(c.last_job_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.customers.length === 0 && (
          <p className="text-gray-500 text-center py-12">No customers found.</p>
        )}
      </div>
    </div>
  );
}
