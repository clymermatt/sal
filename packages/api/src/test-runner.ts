/**
 * End-to-end test runner for Sal
 *
 * Tests the full pipeline: webhooks → intent classifier → agents → tools → DB
 * Run with: pnpm test:e2e
 */

const BASE_URL = process.env.TEST_URL ?? "http://localhost:3000";
let businessId = "";
let passed = 0;
let failed = 0;
const results: Array<{ name: string; pass: boolean; duration: number; details: string }> = [];

async function api(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function test(
  name: string,
  fn: () => Promise<{ pass: boolean; details: string }>,
): Promise<void> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    results.push({ name, pass: result.pass, duration, details: result.details });
    if (result.pass) {
      passed++;
      console.log(`  ✅ ${name} (${duration}ms)`);
    } else {
      failed++;
      console.log(`  ❌ ${name} (${duration}ms) — ${result.details}`);
    }
  } catch (err) {
    const duration = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    failed++;
    results.push({ name, pass: false, duration, details: msg });
    console.log(`  ❌ ${name} (${duration}ms) — EXCEPTION: ${msg}`);
  }
}

// ─── Setup ───────────────────────────────────────────────────────────

async function setup() {
  console.log("\n🔧 SETUP\n");

  await test("Create test business", async () => {
    const res = (await api("POST", "/api/onboarding/business", {
      name: "Test Plumbing Co",
      owner_cell: "+15550000",
      phone: "555-1000",
      timezone: "America/Chicago",
      service_area_zips: ["78701", "78702", "78703"],
      business_hours: {
        mon: { open: "08:00", close: "17:00" },
        tue: { open: "08:00", close: "17:00" },
        wed: { open: "08:00", close: "17:00" },
        thu: { open: "08:00", close: "17:00" },
        fri: { open: "08:00", close: "17:00" },
      },
      plan: "pro",
    })) as { success?: boolean; business?: { id: string } };

    if (!res.success || !res.business?.id) {
      return { pass: false, details: "Failed to create business" };
    }
    businessId = res.business.id;
    return { pass: true, details: `businessId: ${businessId}` };
  });

  await test("Add technician — Jake (drains, leaks)", async () => {
    const res = (await api("POST", `/api/onboarding/${businessId}/technicians`, {
      name: "Jake Thompson",
      phone: "+15550102",
      skills: ["drain_clearing", "leak_detection", "general"],
    })) as { success?: boolean };
    return { pass: !!res.success, details: res.success ? "Added" : "Failed" };
  });

  await test("Add technician — Carlos (water heaters, gas)", async () => {
    const res = (await api("POST", `/api/onboarding/${businessId}/technicians`, {
      name: "Carlos Rivera",
      phone: "+15550103",
      skills: ["water_heater", "repiping", "gas", "general"],
    })) as { success?: boolean };
    return { pass: !!res.success, details: res.success ? "Added" : "Failed" };
  });

  await test("Verify service catalog seeded", async () => {
    const res = (await api("GET", `/api/onboarding/${businessId}/catalog`)) as {
      catalog?: unknown[];
    };
    const count = res.catalog?.length ?? 0;
    return { pass: count >= 10, details: `${count} services` };
  });

  await test("Verify onboarding status", async () => {
    const res = (await api("GET", `/api/onboarding/${businessId}/status`)) as {
      steps?: Record<string, boolean>;
      tech_count?: number;
    };
    const hasTechs = res.steps?.has_technicians ?? false;
    const hasCatalog = res.steps?.has_catalog ?? false;
    return {
      pass: hasTechs && hasCatalog,
      details: `techs: ${res.tech_count}, catalog: ${hasCatalog}`,
    };
  });
}

// ─── Intake Agent Tests ──────────────────────────────────────────────

async function intakeTests() {
  console.log("\n📞 INTAKE AGENT\n");

  await test("Standard booking — kitchen drain", async () => {
    const res = (await api("POST", "/test/simulate-call", {
      businessId,
      transcript:
        "Hi, my kitchen sink is clogged. I'm Sarah at 555-0199, I live at 45 Oak Ave Austin TX 78702. Tomorrow at 9am works for me, please book it.",
      callerPhone: "555-0199",
    })) as { success?: boolean; action_log?: Array<{ output_data?: { actions?: Array<{ tool: string; output: Record<string, unknown> }> } }> };

    const actions = res.action_log?.[0]?.output_data?.actions ?? [];
    const scheduled = actions.find((a) => a.tool === "schedule_job");
    const jobCreated = !!scheduled?.output?.success;

    return {
      pass: !!res.success && jobCreated,
      details: jobCreated
        ? `Job ${scheduled?.output?.job_id} booked`
        : `Actions: ${actions.map((a) => a.tool).join(", ") || "none"}`,
    };
  });

  await test("Emergency call — burst pipe", async () => {
    const res = (await api("POST", "/test/simulate-call", {
      businessId,
      transcript:
        "Help! There's water spraying everywhere! A pipe burst under my kitchen sink! I'm at 89 Elm Rd Austin TX. My name is Tom Davis, number is 555-0300. Please send someone NOW!",
      callerPhone: "555-0300",
    })) as {
      success?: boolean;
      action_log?: Array<{
        input_data?: { intent?: { type: string } };
        output_data?: { actions?: Array<{ tool: string; output: Record<string, unknown> }> };
      }>;
    };

    const intent = res.action_log?.[0]?.input_data?.intent?.type;
    const actions = res.action_log?.[0]?.output_data?.actions ?? [];
    const hasAlert = actions.some((a) => a.tool === "create_owner_alert");
    const hasSchedule = actions.some((a) => a.tool === "schedule_job");

    return {
      pass: intent === "emergency_call" && (hasAlert || hasSchedule),
      details: `Intent: ${intent}, actions: ${actions.map((a) => a.tool).join(", ")}`,
    };
  });

  await test("Vague inquiry — no booking details", async () => {
    const res = (await api("POST", "/test/simulate-call", {
      businessId,
      transcript: "Yeah um, I think I might have a leak somewhere? Not sure though.",
      callerPhone: "555-0400",
    })) as {
      success?: boolean;
      action_log?: Array<{
        input_data?: { intent?: { type: string } };
        description?: string;
      }>;
    };

    // Agent should still handle it — either ask for more info or try to help
    const hasResponse = !!res.action_log?.[0]?.description;
    return {
      pass: !!res.success && hasResponse,
      details: `Response: "${res.action_log?.[0]?.description?.slice(0, 100)}..."`,
    };
  });
}

// ─── Customer Agent Tests ────────────────────────────────────────────

async function customerTests() {
  console.log("\n💬 CUSTOMER AGENT\n");

  await test("FAQ — business hours", async () => {
    const res = (await api("POST", "/test/simulate-sms", {
      businessId,
      message: "What are your business hours?",
      fromPhone: "555-0500",
    })) as {
      success?: boolean;
      action_log?: Array<{
        input_data?: { intent?: { type: string } };
        description?: string;
      }>;
    };

    const intent = res.action_log?.[0]?.input_data?.intent?.type;
    const response = res.action_log?.[0]?.description ?? "";
    // Should mention hours or days
    const mentionsHours = /\d/.test(response) || /mon|tue|wed|thu|fri|hour|am|pm/i.test(response);

    return {
      pass: !!res.success && mentionsHours,
      details: `Intent: ${intent}, response: "${response.slice(0, 100)}..."`,
    };
  });

  await test("Complaint — bad work quality", async () => {
    const res = (await api("POST", "/test/simulate-sms", {
      businessId,
      message:
        "I'm really unhappy with the work your guy did yesterday. The drain is still clogged and he left a mess. I want to talk to the owner.",
      fromPhone: "555-0199",
    })) as {
      success?: boolean;
      action_log?: Array<{
        output_data?: { actions?: Array<{ tool: string }> };
        description?: string;
      }>;
    };

    const actions = res.action_log?.[0]?.output_data?.actions ?? [];
    const escalated = actions.some(
      (a) => a.tool === "create_owner_alert" || a.tool === "send_sms",
    );

    return {
      pass: !!res.success && escalated,
      details: `Actions: ${actions.map((a) => a.tool).join(", ")}`,
    };
  });

  await test("Pricing question — water heater", async () => {
    const res = (await api("POST", "/test/simulate-sms", {
      businessId,
      message: "How much does it cost to replace a water heater?",
      fromPhone: "555-0600",
    })) as {
      success?: boolean;
      action_log?: Array<{
        input_data?: { intent?: { type: string } };
        description?: string;
      }>;
    };

    const intent = res.action_log?.[0]?.input_data?.intent?.type;
    return {
      pass: !!res.success,
      details: `Intent: ${intent}, response: "${res.action_log?.[0]?.description?.slice(0, 100)}..."`,
    };
  });
}

// ─── Revenue Agent Tests ─────────────────────────────────────────────

async function revenueTests() {
  console.log("\n💰 REVENUE AGENT\n");

  await test("Invoice query from customer", async () => {
    const res = (await api("POST", "/test/simulate-sms", {
      businessId,
      message: "Hey, I got a text about an invoice but I can't find the payment link. Can you resend it?",
      fromPhone: "555-0199",
    })) as {
      success?: boolean;
      action_log?: Array<{
        input_data?: { intent?: { type: string } };
        description?: string;
      }>;
    };

    const intent = res.action_log?.[0]?.input_data?.intent?.type;
    return {
      pass: !!res.success,
      details: `Intent: ${intent}, response: "${res.action_log?.[0]?.description?.slice(0, 100)}..."`,
    };
  });
}

// ─── Dispatch Tests ──────────────────────────────────────────────────

async function dispatchTests() {
  console.log("\n🚚 DISPATCH\n");

  await test("Seed jobs for today", async () => {
    const res = (await api("POST", "/test/seed-jobs", {
      businessId,
    })) as { success?: boolean; jobs_created?: number };

    return {
      pass: !!res.success && (res.jobs_created ?? 0) > 0,
      details: `${res.jobs_created} jobs created`,
    };
  });

  await test("Build daily schedule", async () => {
    const res = (await api("POST", "/test/build-schedule", {
      businessId,
    })) as { success?: boolean; assignments_made?: number };

    return {
      pass: !!res.success,
      details: `${res.assignments_made} assignments made`,
    };
  });

  await test("Generate morning briefings", async () => {
    const res = (await api("POST", "/test/morning-briefing", {
      businessId,
    })) as {
      success?: boolean;
      tech_briefings?: Array<{ tech: string; message: string }>;
      owner_briefing?: string;
    };

    const techCount = res.tech_briefings?.length ?? 0;
    const hasOwner = !!res.owner_briefing;

    return {
      pass: !!res.success && techCount > 0 && hasOwner,
      details: `${techCount} tech briefings, owner: ${hasOwner}`,
    };
  });
}

// ─── Run ─────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║     Sal — End-to-End Test Runner         ║");
  console.log("╚══════════════════════════════════════════╝");

  // Verify server is running
  try {
    await fetch(`${BASE_URL}/health`);
  } catch {
    console.error(`\n❌ Server not reachable at ${BASE_URL}. Start it with: pnpm dev\n`);
    process.exit(1);
  }

  const totalStart = Date.now();

  await setup();
  await intakeTests();
  await customerTests();
  await revenueTests();
  await dispatchTests();

  const totalDuration = Date.now() - totalStart;

  console.log("\n══════════════════════════════════════════");
  console.log(`  ${passed} passed, ${failed} failed — ${totalDuration / 1000}s total`);

  if (failed > 0) {
    console.log("\n  Failed tests:");
    for (const r of results.filter((r) => !r.pass)) {
      console.log(`    ❌ ${r.name}: ${r.details}`);
    }
  }

  console.log("");
  process.exit(failed > 0 ? 1 : 0);
}

main();
