import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadConfig } from "./config.js";
import { initSupabase } from "./db/client.js";
import { initRedis } from "./db/redis.js";
import { initClassifier } from "./orchestration/intent-classifier.js";
import { initQueues } from "./jobs/queue.js";
import { registerRoutes } from "./routes/index.js";
import { registerWebhooks } from "./webhooks/index.js";
import { registerAllTools } from "./tools/index.js";
import { agentRegistry } from "./orchestration/agent-registry.js";
import { IntakeAgent } from "./agents/intake/intake.agent.js";
import { DispatchAgent } from "./agents/dispatch/dispatch.agent.js";
import { logger } from "./lib/logger.js";
import { initTwilio } from "./lib/twilio.js";

async function main() {
  const config = loadConfig();

  // Initialize clients
  initSupabase(config);
  initClassifier(config.ANTHROPIC_API_KEY);

  // Redis + BullMQ are optional in development
  if (config.REDIS_URL) {
    initRedis(config);
    initQueues(config);
    logger.info("Redis + BullMQ initialized");
  } else {
    logger.warn("REDIS_URL not set — BullMQ background jobs disabled");
  }

  // Twilio (optional in development)
  if (config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN && config.TWILIO_PHONE_NUMBER) {
    initTwilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN, config.TWILIO_PHONE_NUMBER);
  } else {
    logger.warn("Twilio credentials not set — SMS sending disabled");
  }

  // Register tools and agents
  registerAllTools();
  agentRegistry.register(new IntakeAgent());
  agentRegistry.register(new DispatchAgent());

  // Create Fastify server
  const app = Fastify({
    logger: false, // We use our own pino instance
  });

  await app.register(cors, {
    origin: true, // TODO: restrict to dashboard domain in production
  });

  // Register routes and webhooks
  await registerRoutes(app);
  await registerWebhooks(app);

  // Start server
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  logger.info({ port: config.PORT, env: config.NODE_ENV }, "PipeAI API server started");
}

main().catch((err) => {
  logger.fatal(err, "Failed to start server");
  process.exit(1);
});
