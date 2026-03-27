import { redirect } from "next/navigation";
import { getMe } from "./api";

/**
 * Get the current user's business ID. Redirects to login if not authenticated.
 */
export async function requireBusinessId(): Promise<string> {
  const me = await getMe();
  if (!me) redirect("/auth/login");
  return me.business.id;
}
