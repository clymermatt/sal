"use client";

import { useEffect, useState } from "react";

interface Service {
  id: string;
  job_type: string;
  description: string | null;
  flat_rate: number | null;
  duration_mins: number | null;
  category: string;
  is_active: boolean;
}

const CATEGORIES = ["emergency", "repair", "installation", "maintenance"];

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

export default function CatalogPage() {
  const [catalog, setCatalog] = useState<Service[]>([]);
  const [businessId, setBusinessId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Form state
  const [form, setForm] = useState({
    job_type: "",
    flat_rate: "",
    duration_mins: "",
    category: "repair",
    description: "",
  });

  useEffect(() => {
    async function load() {
      const me = await apiFetch("/api/auth/me");
      if (me.business) {
        setBusinessId(me.business.id);
        const data = await apiFetch(`/api/dashboard/${me.business.id}/catalog`);
        setCatalog(data.catalog ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  function startEdit(service: Service) {
    setEditing(service.id);
    setAdding(false);
    setForm({
      job_type: service.job_type,
      flat_rate: service.flat_rate?.toString() ?? "",
      duration_mins: service.duration_mins?.toString() ?? "",
      category: service.category,
      description: service.description ?? "",
    });
  }

  function startAdd() {
    setAdding(true);
    setEditing(null);
    setForm({ job_type: "", flat_rate: "", duration_mins: "", category: "repair", description: "" });
  }

  function cancelForm() {
    setEditing(null);
    setAdding(false);
  }

  async function handleSave() {
    const body = {
      job_type: form.job_type,
      flat_rate: parseFloat(form.flat_rate),
      duration_mins: parseInt(form.duration_mins, 10),
      category: form.category,
      description: form.description || undefined,
    };

    if (editing) {
      const res = await apiFetch(`/api/dashboard/${businessId}/catalog/${editing}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      if (res.success) {
        setCatalog((prev) => prev.map((s) => (s.id === editing ? res.service : s)));
        setEditing(null);
      }
    } else if (adding) {
      const res = await apiFetch(`/api/dashboard/${businessId}/catalog`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.success) {
        setCatalog((prev) => [...prev, res.service]);
        setAdding(false);
      }
    }
  }

  async function handleDelete(serviceId: string) {
    if (!confirm("Remove this service from the catalog?")) return;
    const res = await apiFetch(`/api/dashboard/${businessId}/catalog/${serviceId}`, {
      method: "DELETE",
    });
    if (res.success) {
      setCatalog((prev) => prev.filter((s) => s.id !== serviceId));
    }
  }

  async function handleToggleActive(service: Service) {
    const res = await apiFetch(`/api/dashboard/${businessId}/catalog/${service.id}`, {
      method: "PUT",
      body: JSON.stringify({ is_active: !service.is_active }),
    });
    if (res.success) {
      setCatalog((prev) => prev.map((s) => (s.id === service.id ? res.service : s)));
    }
  }

  if (loading) {
    return <div className="text-gray-500 py-12 text-center">Loading catalog...</div>;
  }

  // Group by category
  const grouped: Record<string, Service[]> = {};
  for (const item of catalog) {
    const cat = item.category ?? "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Service Catalog</h1>
        <button
          onClick={startAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          + Add Service
        </button>
      </div>

      {/* Add/Edit Form */}
      {(adding || editing) && (
        <div className="bg-white rounded-xl border border-blue-200 p-5 mb-6">
          <h3 className="font-semibold mb-4">{adding ? "Add Service" : "Edit Service"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Name</label>
              <input
                type="text"
                value={form.job_type}
                onChange={(e) => setForm({ ...form, job_type: e.target.value })}
                placeholder="e.g., Drain clearing — kitchen"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate ($)</label>
              <input
                type="number"
                value={form.flat_rate}
                onChange={(e) => setForm({ ...form, flat_rate: e.target.value })}
                placeholder="185"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (mins)</label>
              <input
                type="number"
                value={form.duration_mins}
                onChange={(e) => setForm({ ...form, duration_mins: e.target.value })}
                placeholder="60"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Additional details about this service"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              {adding ? "Add" : "Save"}
            </button>
            <button
              onClick={cancelForm}
              className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {CATEGORIES.map((cat) => {
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
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
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
                        <button
                          onClick={() => handleToggleActive(item)}
                          className={`text-xs font-medium ${
                            item.is_active ? "text-green-600" : "text-gray-400"
                          }`}
                        >
                          {item.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => startEdit(item)}
                          className="text-blue-600 text-xs font-medium mr-3 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-500 text-xs font-medium hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {catalog.length === 0 && !adding && (
        <p className="text-gray-500 text-center py-12">
          No services in the catalog yet. Click &quot;+ Add Service&quot; to get started.
        </p>
      )}
    </div>
  );
}
