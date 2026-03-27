import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Verify the token with the API
  const apiUrl = process.env.API_URL ?? "https://pipeaiapi-production.up.railway.app";

  const res = await fetch(`${apiUrl}/api/auth/verify?token=${token}`, {
    cache: "no-store",
  });

  const data = await res.json();

  if (!data.success) {
    // Redirect to a failure page
    return NextResponse.redirect(
      new URL(`/auth/verify/failed?error=${encodeURIComponent(data.error ?? "Link expired")}`, request.url),
    );
  }

  // Set session cookie
  const cookieStore = await cookies();
  cookieStore.set("sal_session", data.session_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(data.expires_at),
  });

  // Redirect to dashboard
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
