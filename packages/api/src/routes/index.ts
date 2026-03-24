import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health.routes.js";
import { registerTestRoutes } from "./test.routes.js";
import { registerOnboardingRoutes } from "./onboarding.routes.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(registerHealthRoutes);
  await app.register(registerTestRoutes);
  await app.register(registerOnboardingRoutes, { prefix: "/api/onboarding" });
}
