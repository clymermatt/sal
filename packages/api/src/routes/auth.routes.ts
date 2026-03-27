import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { randomUUID, randomBytes } from "node:crypto";
import { getSupabase } from "../db/client.js";
import { sendEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";

const MAGIC_LINK_EXPIRY_MINS = 15;
const SESSION_EXPIRY_DAYS = 30;

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const supabase = getSupabase();

  // Request a magic link
  app.post(
    "/login",
    async (request: FastifyRequest<{ Body: { email: string } }>) => {
      const { email } = request.body;

      if (!email) {
        return { error: "email is required" };
      }

      // Check if user exists
      const { data: user } = await supabase
        .from("users")
        .select("id, email, name")
        .eq("email", email.toLowerCase().trim())
        .single();

      if (!user) {
        // Don't reveal whether the email exists
        logger.info({ email }, "Login attempt for unknown email");
        return { success: true, message: "If an account exists, a login link has been sent." };
      }

      // Generate magic link token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINS * 60 * 1000);

      const { error: tokenError } = await supabase
        .from("auth_tokens")
        .insert({
          user_id: user.id,
          token,
          expires_at: expiresAt.toISOString(),
        });

      if (tokenError) {
        logger.error({ tokenError }, "Failed to create auth token");
        return { error: "Failed to send login link" };
      }

      // Send magic link email
      const dashboardUrl = process.env.DASHBOARD_URL ?? "https://hiresal.com";
      const magicLink = `${dashboardUrl}/auth/verify?token=${token}`;

      await sendEmail({
        to: user.email,
        subject: "Your Sal login link",
        html: `
<p>Hi${user.name ? ` ${user.name.split(" ")[0]}` : ""},</p>
<p>Click below to log in to your Sal dashboard:</p>
<p style="margin: 24px 0;">
  <a href="${magicLink}"
     style="background:#1A56A0;color:white;padding:12px 24px;
            text-decoration:none;border-radius:4px;display:inline-block;">
    Log in to Sal
  </a>
</p>
<p style="color:#666;font-size:13px;">
  This link expires in ${MAGIC_LINK_EXPIRY_MINS} minutes. If you didn't request this, ignore this email.
</p>
        `.trim(),
      });

      logger.info({ userId: user.id }, "Magic link sent");
      return { success: true, message: "If an account exists, a login link has been sent." };
    },
  );

  // Debug: check if we can read auth_tokens at all
  app.get(
    "/debug-tokens",
    async () => {
      const { data, error } = await supabase
        .from("auth_tokens")
        .select("id, token, used_at, expires_at")
        .order("created_at", { ascending: false })
        .limit(3);

      return { count: data?.length ?? 0, tokens: data?.map(t => ({ id: t.id, token_prefix: t.token.slice(0, 8), used: !!t.used_at, expires: t.expires_at })), error };
    },
  );

  // Verify magic link token → create session
  app.get(
    "/verify",
    async (
      request: FastifyRequest<{ Querystring: { token: string } }>,
      reply: FastifyReply,
    ) => {
      const { token } = request.query;

      if (!token) {
        return reply.status(400).send({ error: "Token required" });
      }

      // Look up the token
      const { data: authToken } = await supabase
        .from("auth_tokens")
        .select("id, user_id, expires_at, used_at")
        .eq("token", token)
        .single();

      if (!authToken) {
        return reply.status(401).send({ error: "Invalid or expired link" });
      }

      if (authToken.used_at) {
        return reply.status(401).send({ error: "This link has already been used" });
      }

      if (new Date(authToken.expires_at) < new Date()) {
        return reply.status(401).send({ error: "This link has expired" });
      }

      // Mark token as used
      await supabase
        .from("auth_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", authToken.id);

      // Create session
      const sessionToken = randomBytes(32).toString("hex");
      const sessionExpiry = new Date(
        Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      );

      const { error: sessionError } = await supabase
        .from("sessions")
        .insert({
          user_id: authToken.user_id,
          token: sessionToken,
          expires_at: sessionExpiry.toISOString(),
        });

      if (sessionError) {
        logger.error({ sessionError }, "Failed to create session");
        return reply.status(500).send({ error: "Failed to create session" });
      }

      logger.info({ userId: authToken.user_id }, "User logged in via magic link");

      return {
        success: true,
        session_token: sessionToken,
        expires_at: sessionExpiry.toISOString(),
      };
    },
  );

  // Validate session → return user + business info
  app.get(
    "/me",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization;
      const token = authHeader?.replace("Bearer ", "");

      if (!token) {
        return reply.status(401).send({ error: "Not authenticated" });
      }

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
        .select("id, email, name, role, business_id")
        .eq("id", session.user_id)
        .single();

      if (!user) {
        return reply.status(401).send({ error: "User not found" });
      }

      const { data: business } = await supabase
        .from("businesses")
        .select("id, name, phone, timezone, plan")
        .eq("id", user.business_id)
        .single();

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        business,
      };
    },
  );

  // Logout — invalidate session
  app.post(
    "/logout",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization;
      const token = authHeader?.replace("Bearer ", "");

      if (token) {
        await supabase.from("sessions").delete().eq("token", token);
      }

      return { success: true };
    },
  );
}
