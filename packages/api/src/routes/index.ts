import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health.routes.js";
import { registerTestRoutes } from "./test.routes.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(registerHealthRoutes);
  await app.register(registerTestRoutes);
  // Future route registrations:
  // await app.register(registerOnboardingRoutes, { prefix: "/api/onboarding" });
  // await app.register(registerBusinessRoutes, { prefix: "/api/businesses" });
  // await app.register(registerJobRoutes, { prefix: "/api/jobs" });
  // await app.register(registerCustomerRoutes, { prefix: "/api/customers" });
  // await app.register(registerTechnicianRoutes, { prefix: "/api/technicians" });
}
