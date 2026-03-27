import type { FastifyRequest, FastifyReply } from "fastify";
import { getSupabase } from "../db/client.js";

export interface AuthUser {
  userId: string;
  businessId: string;
  email: string;
  role: string;
}

/**
 * Fastify preHandler that validates the session token and attaches
 * the authenticated user to the request.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return reply.status(401).send({ error: "Authentication required" });
  }

  const supabase = getSupabase();

  const { data: session } = await supabase
    .from("sessions")
    .select("user_id, expires_at")
    .eq("token", token)
    .single();

  if (!session || new Date(session.expires_at) < new Date()) {
    return reply.status(401).send({ error: "Session expired" });
  }

  const { data: user } = await supabase
    .from("users")
    .select("id, email, role, business_id")
    .eq("id", session.user_id)
    .single();

  if (!user) {
    return reply.status(401).send({ error: "User not found" });
  }

  // Attach to request for downstream handlers
  (request as FastifyRequest & { auth: AuthUser }).auth = {
    userId: user.id,
    businessId: user.business_id,
    email: user.email,
    role: user.role,
  };
}

/**
 * Get the authenticated user from the request (after requireAuth runs).
 */
export function getAuth(request: FastifyRequest): AuthUser {
  return (request as FastifyRequest & { auth: AuthUser }).auth;
}
