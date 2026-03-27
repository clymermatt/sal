import { redirect } from "next/navigation";
import { setSessionToken } from "@/lib/session";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const token = params.token;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid link</h1>
          <p className="text-gray-600 mb-6">This login link is missing or malformed.</p>
          <a href="/auth/login" className="text-blue-600 underline">
            Request a new one
          </a>
        </div>
      </div>
    );
  }

  // Verify the token with the API
  const apiUrl = process.env.API_URL ?? "https://pipeaiapi-production.up.railway.app";

  const res = await fetch(`${apiUrl}/api/auth/verify?token=${token}`, {
    cache: "no-store",
  });

  const data = await res.json();

  if (!data.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Link expired</h1>
          <p className="text-gray-600 mb-6">
            {data.error ?? "This login link has expired or already been used."}
          </p>
          <a href="/auth/login" className="text-blue-600 underline">
            Request a new one
          </a>
        </div>
      </div>
    );
  }

  // Set session cookie and redirect to dashboard
  await setSessionToken(data.session_token, data.expires_at);
  redirect("/dashboard");
}
