import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health.routes.js";
import { registerTestRoutes } from "./test.routes.js";
import { registerOnboardingRoutes } from "./onboarding.routes.js";
import { registerDashboardRoutes } from "./dashboard.routes.js";
import { registerAuthRoutes } from "./auth.routes.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(registerHealthRoutes);
  await app.register(registerTestRoutes);
  await app.register(registerAuthRoutes, { prefix: "/api/auth" });
  await app.register(registerOnboardingRoutes, { prefix: "/api/onboarding" });
  await app.register(registerDashboardRoutes, { prefix: "/api/dashboard" });
}
