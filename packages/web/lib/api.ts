import { getSessionToken } from "./session";

const API_BASE_URL = process.env.API_URL ?? "https://pipeaiapi-production.up.railway.app";

export async function fetchAPI<T = unknown>(
  path: string,
  params?: Record<string, string>,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  const token = await getSessionToken();

  const res = await fetch(url.toString(), {
    method: options?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export async function fetchDashboard<T = unknown>(
  businessId: string,
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  return fetchAPI<T>(`/api/dashboard/${businessId}${path}`, params);
}

export async function getMe(): Promise<{
  user: { id: string; email: string; name: string; role: string };
  business: { id: string; name: string; phone: string; timezone: string; plan: string };
} | null> {
  try {
    return await fetchAPI("/api/auth/me");
  } catch {
    return null;
  }
}
