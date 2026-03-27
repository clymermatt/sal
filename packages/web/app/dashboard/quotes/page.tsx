"use client";

import { useEffect, useState } from "react";

interface LineItem {
  serviceId: string;
  description: string;
  quantity: number;
  unitPrice: number | null;
  durationMins?: number;
  notes?: string;
}

interface Quote {
  id: string;
  line_items: LineItem[];
  total: number;
  expires_at: string;
  approved_at: string | null;
  created_at: string;
  needs_pricing: boolean;
  customers: { name: string; phone: string };
  jobs: { job_type: string } | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://pipeaiapi-production.up.railway.app";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function apiFetch(path: string, options?: RequestInit) {
  const token = getCookie("sal_session");
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  return res.json();
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "needs_pricing">("all");
  const [editingQuote, setEditingQuote] = useState<string | null>(null);
  const [editItems, setEditItems] = useState<LineItem[]>([]);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const me = await apiFetch("/api/auth/me");
      if (me.business) {
        setBusinessId(me.business.id);
        const data = await apiFetch(
          `/api/dashboard/${me.business.id}/quotes${filter === "needs_pricing" ? "?needs_pricing=true" : ""}`,
        );
        setQuotes(data.quotes ?? []);
      }
      setLoading(false);
    }
    load();
  }, [filter]);

  function startEdit(quote: Quote) {
    setEditingQuote(quote.id);
    setEditItems(quote.line_items.map((i) => ({ ...i })));
  }

  function updateItemPrice(index: number, price: string) {
    setEditItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, unitPrice: price === "" ? null : parseFloat(price) } : item,
      ),
    );
  }

  async function saveQuote(quoteId: string) {
    const res = await apiFetch(`/api/dashboard/${businessId}/quotes/${quoteId}`, {
      method: "PUT",
      body: JSON.stringify({ line_items: editItems }),
    });

    if (res.success) {
      setQuotes((prev) =>
        prev.map((q) =>
          q.id === quoteId
            ? {
                ...q,
                line_items: editItems,
                total: res.quote.total,
                needs_pricing: !res.fully_priced,
              }
            : q,
        ),
      );
      setEditingQuote(null);
    }
  }

  async function sendQuote(quoteId: string) {
    setSending(quoteId);
    const res = await apiFetch(`/api/dashboard/${businessId}/quotes/${quoteId}/send`, {
      method: "POST",
    });
    setSending(null);

    if (res.success) {
      alert(`Quote sent to ${res.sent_to}`);
    } else {
      alert(res.error ?? "Failed to send quote");
    }
  }

  if (loading) {
    return <div className="text-gray-500 py-12 text-center">Loading quotes...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Quotes</h1>
        <div className="flex gap-2">
          {(["all", "needs_pricing"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "bg-white border text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f === "all" ? "All" : "Needs Pricing"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {quotes.map((quote) => {
          const isEditing = editingQuote === quote.id;
          const items = isEditing ? editItems : quote.line_items;
          const isExpired = new Date(quote.expires_at) < new Date();

          return (
            <div
              key={quote.id}
              className={`bg-white rounded-xl border p-5 ${
                quote.needs_pricing ? "border-orange-200" : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-medium">{quote.customers?.name}</span>
                  <span className="text-gray-400 text-sm ml-2">
                    {quote.jobs?.job_type ?? ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {quote.needs_pricing && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                      Needs Pricing
                    </span>
                  )}
                  {quote.approved_at && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      Approved
                    </span>
                  )}
                  {isExpired && !quote.approved_at && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                      Expired
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(quote.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>

              <table className="w-full text-sm mb-3">
                <thead>
                  <tr className="text-left text-gray-500 text-xs">
                    <th className="pb-1">Item</th>
                    <th className="pb-1 text-right">Price</th>
                    <th className="pb-1 text-right">Qty</th>
                    <th className="pb-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-1">
                        {item.description}
                        {item.serviceId === "CUSTOM" && (
                          <span className="text-xs text-orange-500 ml-1">(custom)</span>
                        )}
                        {item.notes && (
                          <div className="text-xs text-gray-400">{item.notes}</div>
                        )}
                      </td>
                      <td className="py-1 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            value={item.unitPrice ?? ""}
                            onChange={(e) => updateItemPrice(idx, e.target.value)}
                            placeholder="Set price"
                            className="w-24 px-2 py-1 border rounded text-right text-sm"
                          />
                        ) : item.unitPrice != null ? (
                          `$${item.unitPrice.toFixed(2)}`
                        ) : (
                          <span className="text-orange-500 font-medium">needs price</span>
                        )}
                      </td>
                      <td className="py-1 text-right">{item.quantity}</td>
                      <td className="py-1 text-right font-medium">
                        {item.unitPrice != null
                          ? `$${(item.unitPrice * item.quantity).toFixed(2)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-center justify-between border-t pt-3">
                <span className="font-semibold">
                  Total: ${Number(quote.total).toFixed(2)}
                </span>
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => saveQuote(quote.id)}
                        className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingQuote(null)}
                        className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(quote)}
                        className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200"
                      >
                        Edit Prices
                      </button>
                      {!quote.needs_pricing && !quote.approved_at && !isExpired && (
                        <button
                          onClick={() => sendQuote(quote.id)}
                          disabled={sending === quote.id}
                          className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          {sending === quote.id ? "Sending..." : "Send to Customer"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {quotes.length === 0 && (
        <p className="text-gray-500 text-center py-12">
          {filter === "needs_pricing"
            ? "No quotes need pricing right now."
            : "No quotes yet. Sal creates quotes when customers request estimates."}
        </p>
      )}
    </div>
  );
}
