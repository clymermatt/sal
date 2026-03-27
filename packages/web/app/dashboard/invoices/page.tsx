import { fetchDashboard } from "@/lib/api";
import { requireBusinessId } from "@/lib/auth-guard";
import { StatusBadge } from "@/components/status-badge";

interface InvoicesData {
  invoices: Array<{
    id: string;
    total: number;
    payment_status: string;
    invoiced_at: string;
    paid_at: string | null;
    customers: { name: string };
    jobs: { job_type: string };
  }>;
  pagination: { page: number; limit: number; total: number; pages: number };
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const businessId = await requireBusinessId();
  const data = await fetchDashboard<InvoicesData>(businessId, "/invoices", {
    payment_status: params.payment_status ?? "",
    page: params.page ?? "1",
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-sm text-gray-500">{data.pagination.total} total</p>
      </div>

      <div className="flex gap-2 mb-4">
        {["", "pending", "sent", "paid", "overdue"].map((s) => (
          <a
            key={s}
            href={`/dashboard/invoices${s ? `?payment_status=${s}` : ""}`}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              (params.payment_status ?? "") === s
                ? "bg-blue-600 text-white"
                : "bg-white border text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s || "All"}
          </a>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Job Type</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  {new Date(inv.invoiced_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 font-medium">{inv.customers?.name}</td>
                <td className="px-4 py-3 text-gray-600">{inv.jobs?.job_type}</td>
                <td className="px-4 py-3 text-right font-medium">
                  ${Number(inv.total).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={inv.payment_status} />
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {inv.paid_at
                    ? new Date(inv.paid_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.invoices.length === 0 && (
          <p className="text-gray-500 text-center py-12">No invoices found.</p>
        )}
      </div>
    </div>
  );
}
