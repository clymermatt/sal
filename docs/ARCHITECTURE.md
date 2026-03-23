# PipeAI — Technical Architecture & Build Specification
> Version 1.0 — March 2026 | CONFIDENTIAL

---

## Quick Reference

| Stat | Value |
|------|-------|
| Core philosophy | Buy infra, build the intelligence layer |
| Agents | 5 (Intake, Dispatch, Revenue, Customer, Intelligence) |
| Vendors (buy) | Vapi, Anthropic Claude, Twilio, Stripe Connect, Supabase, Resend, QuickBooks SDK |
| Build (own) | Agent orchestration, dispatch algorithm, pricing engine, upsell engine |
| Est. infra cost @ 500 customers | ~$3,300–4,800/month (~$6.60–9.60/customer) |
| MVP timeline | 6 sprints × 2 weeks = 90 days to first customer |
| Team for MVP | 2 engineers + founder/PM |

---

## 1. System Architecture Overview

PipeAI is a multi-agent system built on a cloud-native stack. Three non-negotiable properties:
1. **Low latency** — voice calls require <500ms LLM response
2. **High reliability** — a missed emergency call at 2am is a product failure
3. **Operational simplicity** — maintainable by 2 engineers

### 1.1 The Four-Layer Stack

| Layer | What It Does |
|-------|-------------|
| **Layer 1: Edge** | All inbound/outbound comms — phone calls, SMS, email. Third-party vendors with thin PipeAI wrappers. |
| **Layer 2: Agent Orchestration** | The PipeAI brain. Receives events, decides what to do, calls tools, coordinates agents. Core IP. |
| **Layer 3: Integrations** | QuickBooks, Stripe, Google Maps. Mostly off-the-shelf SDKs with custom logic. |
| **Layer 4: Data Store** | Customer records, job history, pricing, business state. Accumulates context over time. |

### 1.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        EDGE LAYER                               │
│  Phone Call (Vapi) │ SMS (Twilio) │ Email (Resend) │ Web Form   │
└──────────────────────────┬──────────────────────────────────────┘
                           │  Events (webhooks)
┌──────────────────────────▼──────────────────────────────────────┐
│                   AGENT ORCHESTRATION LAYER                     │
│                                                                  │
│   Event Router → Intent Classifier → Agent Dispatcher           │
│                                                                  │
│   ┌───────────┐ ┌──────────┐ ┌─────────┐ ┌──────┐ ┌────────┐  │
│   │  Intake   │ │ Dispatch │ │ Revenue │ │ Cust │ │  Intel │  │
│   │  Agent    │ │  Agent   │ │  Agent  │ │ Agent│ │  Agent │  │
│   └─────┬─────┘ └────┬─────┘ └────┬────┘ └──┬───┘ └───┬────┘  │
│         └────────────┴─────────────┴─────────┴─────────┘        │
│                         Tool Registry                            │
│   (schedule_job │ create_invoice │ send_sms │ query_history)    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                   INTEGRATION LAYER                             │
│  QuickBooks Online │ Twilio │ Stripe │ Google Maps │ Calendly   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                     DATA LAYER                                  │
│   PostgreSQL (Supabase)  │  Redis (cache)  │  S3 (files/audio) │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Buy vs. Build Decisions

### 2.1 Decision Matrix

| Component | Decision | Rationale |
|-----------|----------|-----------|
| Voice AI | **BUY — Vapi** | Handles WebRTC, STT, TTS, interruption detection. Building in-house = 6 months, $300K+. |
| LLM | **BUY — Anthropic Claude** | PipeAI owns the prompts and plumbing context; Anthropic owns the model. |
| SMS & telephony | **BUY — Twilio** | Reliable, well-documented, not a source of differentiation. |
| Email delivery | **BUY — Resend** | Modern transactional email. 15-min integration. |
| Payments | **BUY — Stripe Connect** | Handles all compliance, card processing, ACH, payouts. Never build payments. |
| Database | **BUY — Supabase (Postgres)** | Managed Postgres with real-time, auth, and storage. Removes need for DBA. |
| Auth | **BUY — Supabase Auth** | Free, built-in. No reason to build. |
| Job scheduling logic | **BUILD** | Plumbing-specific: skill matching, drive-time, emergency insertion. Generic schedulers don't understand trades. |
| Agent orchestration | **BUILD** | Event router, intent classifier, tool registry, agent coordination = core IP. |
| Flat-rate pricing engine | **BUILD** | Context-aware quote generation with local market calibration. Key differentiator. |
| Upsell recommendation engine | **BUILD** | Requires job type knowledge, equipment age signals, customer history. Proprietary. |
| QuickBooks integration | **BUY — Official QB SDK** | Well-documented. Not differentiated; just needs to work. |

### 2.2 Estimated Monthly Infrastructure Cost @ 500 Customers

| Service | Monthly Cost |
|---------|-------------|
| Vapi (voice AI) — ~50K mins/mo | $1,000–1,500 |
| Anthropic Claude API — ~10M tokens/mo | $800–1,200 |
| Twilio SMS — ~200K messages/mo | $600–900 |
| Twilio phone numbers — 500 numbers | $500 |
| Supabase Pro | $25 |
| Resend email | $20 |
| Stripe (payments infra) | $0 base (% per transaction) |
| AWS / Vercel (compute & hosting) | $300–500 |
| Redis (Upstash) | $50–150 |
| **Total** | **~$3,300–4,800/month** |
| **Per-customer infra cost** | **~$6.60–9.60/customer/month** |

---

## 3. Agent Orchestration Layer

This is PipeAI's core proprietary system. Receives all inbound events, classifies intent, routes to the correct agent, manages tool execution, and logs every action.

### 3.1 Event Types & Routing

| Event Type | Source | Routed To |
|-----------|--------|-----------|
| Inbound phone call | Vapi webhook | Intake Agent |
| Inbound SMS | Twilio webhook | Intake Agent or Customer Agent (based on sender) |
| Owner SMS command | Twilio webhook | Command Parser → appropriate agent |
| Job status update | Tech mobile app | Dispatch Agent + Revenue Agent |
| Payment received | Stripe webhook | Revenue Agent + Intelligence Agent |
| Scheduled trigger (cron) | Internal scheduler | Morning briefing, follow-up sequences, renewal checks |
| Quote approval | Stripe payment link | Revenue Agent |
| New customer form | Web embed | Intake Agent |

### 3.2 Core Orchestration Loop

```typescript
// Runs on every inbound event
async function handleEvent(event: PipeAIEvent) {
  const business = await getBusinessContext(event.businessId);
  const history  = await getRecentHistory(event.businessId, limit=20);

  // Step 1: Classify intent
  const intent = await classifyIntent(event, business, history);
  // intent: {
  //   type: 'emergency_call' | 'booking_request' | 'invoice_query'
  //        | 'owner_command' | 'job_update' | 'payment_received' | ...
  //   urgency: 'critical' | 'high' | 'normal' | 'low'
  // }

  // Step 2: Route to correct agent
  const agent = AgentRegistry.getAgent(intent.type);

  // Step 3: Execute agent with full context
  const result = await agent.run({
    event, intent, business, history,
    tools: ToolRegistry.getToolsFor(agent.name)
  });

  // Step 4: Log action for owner transparency
  await ActionLog.record({ event, intent, result, agentName: agent.name });

  // Step 5: Trigger downstream agents if needed
  for (const downstream of result.triggerEvents) {
    await eventQueue.push(downstream);
  }
}
```

### 3.3 Tool Registry

Each agent can only call tools it is explicitly granted. This is enforced — agents cannot take unintended actions.

| Tool | Description | Agents With Access |
|------|-------------|-------------------|
| `schedule_job` | Book a job onto the calendar with tech assignment | Intake, Dispatch |
| `reschedule_job` | Move an existing job to new time/tech | Dispatch |
| `get_available_slots` | Query open schedule windows for a tech/zone | Intake, Dispatch |
| `get_tech_location` | Get current GPS position of a technician | Dispatch |
| `create_quote` | Generate flat-rate quote and send to customer | Revenue |
| `create_invoice` | Generate invoice from job data and deliver | Revenue |
| `send_payment_request` | Send Stripe payment link to customer | Revenue |
| `send_sms` | Send outbound SMS to customer or tech | All agents |
| `send_email` | Send transactional email | Revenue, Customer |
| `make_call` | Initiate outbound call (emergency escalation) | Intake |
| `get_customer_history` | Retrieve full job + payment history | All agents |
| `get_job_costs` | Calculate actual vs. estimated job cost | Intelligence |
| `create_owner_alert` | Push urgent notification to owner via SMS | Intake, Dispatch, Revenue |
| `update_business_context` | Modify pricing, service area, tech availability | Command Parser only |
| `get_ar_summary` | Retrieve outstanding invoices + aging | Revenue, Intelligence |
| `log_upsell_prompt` | Record upsell recommendation sent to tech | Revenue |

---

## 4. Intake Agent: Voice Architecture

### 4.1 Voice Stack: Vapi

- **STT:** Deepgram Nova-2 — lowest latency, highest accuracy for trade vocabulary
- **TTS:** ElevenLabs Turbo v2.5 — most natural voice, <100ms first-chunk latency
- **Interruption detection:** Caller can interrupt the AI mid-sentence
- **Endpointing:** Detects when caller has finished speaking to minimise dead air

### 4.2 Call Flow State Machine

```
States:
  GREETING → PROBLEM_COLLECTION → URGENCY_ASSESSMENT → ROUTING_DECISION
                                                        ↓               ↓
                                                  BOOKING_FLOW   EMERGENCY_ESCALATION
                                                        ↓               ↓
                                                CONFIRMATION_CLOSE  OWNER_PATCH_THROUGH

URGENCY_ASSESSMENT triggers EMERGENCY_ESCALATION if ANY of:
  - Keywords: ['burst', 'flooding', 'no water', 'sewage', 'gas smell',
               'overflowing', 'ceiling leak', 'pipe broke', 'emergency']
  - Caller distress signals (tone classification via Vapi)
  - Time: 10pm–6am AND any plumbing issue

EMERGENCY_ESCALATION actions (in order, stops at first success):
  1. Call owner's primary cell
  2. Call owner's backup number (set in onboarding)
  3. SMS owner with full caller details + issue description
  4. Book earliest available slot + confirm to caller
```

### 4.3 Vapi Assistant Configuration

```typescript
{
  model: {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    systemPrompt: INTAKE_SYSTEM_PROMPT,   // see 4.4 below
    tools: [
      schedule_job_tool,
      get_available_slots_tool,
      create_owner_alert_tool,
      send_sms_tool
    ]
  },
  voice: {
    provider: "11labs",
    voiceId: "Rachel",      // warm, professional female voice
    stability: 0.5,
    similarityBoost: 0.75
  },
  transcriber: {
    provider: "deepgram",
    model: "nova-2",
    language: "en-US",
    smartFormat: true
  },
  firstMessage: "Thanks for calling {business_name}! This is Aria. How can I help you today?",
  endCallFunctionEnabled: true,
  maxDurationSeconds: 600
}
```

### 4.4 Intake System Prompt Architecture

The system prompt is dynamically assembled at call-start. Key sections:

```
1. IDENTITY BLOCK
   You are Aria, the AI office assistant for {business_name}.
   You answer calls, book jobs, and help customers — exactly as a
   professional office manager would. You never reveal you are AI
   unless directly asked; if asked, say you are an AI assistant.

2. BUSINESS CONTEXT BLOCK (injected at runtime)
   Service area: {zip_codes}
   Hours: {business_hours}
   Technicians available today: {tech_list_with_skills}
   Services offered: {service_catalog}
   Current available slots: {open_schedule_windows}
   Common flat rates: {top_20_job_prices}

3. EMERGENCY PROTOCOL BLOCK
   If the caller describes ANY of the following, immediately call
   the create_owner_alert tool before continuing:
   [detailed emergency keyword list and escalation instructions]

4. BOOKING PROTOCOL BLOCK
   To book a job, collect in this order:
   1. Nature of problem (specific, not just 'plumbing issue')
   2. Address (validate against service area)
   3. Preferred time window
   4. Callback number
   Then call get_available_slots, confirm with customer, call schedule_job.

5. TONE & GUARDRAILS BLOCK
   Never quote a price without checking the service catalog first.
   Never promise same-day service without checking availability.
   Always get a callback number before ending the call.
   Keep responses under 30 words where possible — phone calls need brevity.
```

---

## 5. Dispatch Agent: Scheduling Architecture

### 5.1 Database Schema

```sql
CREATE TABLE technicians (
  id           UUID PRIMARY KEY,
  business_id  UUID REFERENCES businesses(id),
  name         TEXT NOT NULL,
  phone        TEXT,
  skills       TEXT[],   -- ['drain_clearing','water_heater','repiping','gas']
  base_lat     FLOAT,    -- home / depot location
  base_lng     FLOAT,
  is_active    BOOLEAN DEFAULT true
);

CREATE TABLE jobs (
  id              UUID PRIMARY KEY,
  business_id     UUID REFERENCES businesses(id),
  customer_id     UUID REFERENCES customers(id),
  tech_id         UUID REFERENCES technicians(id),
  status          TEXT,  -- booked | en_route | in_progress | complete | cancelled
  job_type        TEXT,  -- from service catalog
  required_skills TEXT[],
  address         TEXT,
  lat             FLOAT,
  lng             FLOAT,
  scheduled_start TIMESTAMPTZ,
  scheduled_end   TIMESTAMPTZ,
  estimated_mins  INT,
  is_emergency    BOOLEAN DEFAULT false,
  notes           TEXT,
  flat_rate       NUMERIC(10,2)
);
```

### 5.2 Daily Schedule Builder (runs at 5:55am)

```typescript
async function buildDailySchedule(businessId: string, date: Date) {
  const jobs  = await getUnassignedJobs(businessId, date);
  const techs = await getAvailableTechs(businessId, date);

  const assignments = [];
  for (const job of jobs) {
    const candidates = techs.filter(t => hasRequiredSkills(t, job.requiredSkills));

    const scored = candidates.map(tech => ({
      tech,
      score: scoreAssignment(job, tech, assignments)
      // Score factors:
      // - Drive time from last job (Google Maps Distance Matrix API)
      // - Skill match quality (exact vs. general)
      // - Current workload balance
      // - Tech's historical performance on this job type
    }));

    const best = scored.sort((a, b) => b.score - a.score)[0];
    assignments.push({ job, tech: best.tech });
    await assignJob(job.id, best.tech.id);
  }

  // Send morning briefings to all techs
  for (const tech of techs) {
    const techJobs = assignments.filter(a => a.tech.id === tech.id);
    await sendMorningBriefing(tech, techJobs);
  }

  await sendOwnerMorningBriefing(businessId, assignments);
}
```

### 5.3 Emergency Insertion (runs immediately)

```typescript
async function insertEmergency(job: Job) {
  const techs = await getAvailableTechs(job.businessId);

  const distances = await googleMaps.distanceMatrix({
    origins:      techs.map(t => t.currentLocation),
    destinations: [job.address],
    mode:         'driving'
  });

  const available = techs
    .filter(t => hasRequiredSkills(t, job.requiredSkills))
    .map((t, i) => ({ tech: t, eta: distances.rows[i].elements[0].duration.value }))
    .sort((a, b) => a.eta - b.eta);

  const assigned = available[0];
  await assignJob(job.id, assigned.tech.id);

  await sendSMS(assigned.tech.phone,
    `EMERGENCY: ${job.address} — ${job.jobType}. ETA: ${assigned.eta / 60} min. Tap to confirm.`
  );

  await sendSMS(job.customer.phone,
    `${assigned.tech.name} is on the way. ETA approx ${Math.round(assigned.eta / 60)} minutes.`
  );
}
```

---

## 6. Revenue Agent: Quote-to-Cash Architecture

### 6.1 Service Catalog Schema

```sql
CREATE TABLE service_catalog (
  id            UUID PRIMARY KEY,
  business_id   UUID REFERENCES businesses(id),
  job_type      TEXT NOT NULL,
  description   TEXT,
  flat_rate     NUMERIC(10,2),
  duration_mins INT,
  materials_est NUMERIC(10,2),
  labor_burden  NUMERIC(5,4),  -- e.g. 0.35 = 35% burden on top of wage
  category      TEXT,  -- 'emergency' | 'repair' | 'installation' | 'maintenance'
  is_active     BOOLEAN DEFAULT true
);

-- Pre-loaded with 75 common plumbing jobs at onboarding.
-- Owner confirms/adjusts prices in onboarding flow.
-- AI auto-suggests price adjustments based on local market data quarterly.
```

### 6.2 Quote Generation

```typescript
async function generateQuote(jobId: string, customerId: string) {
  const job      = await getJob(jobId);
  const customer = await getCustomer(customerId);
  const history  = await getCustomerHistory(customerId);
  const catalog  = await getServiceCatalog(job.businessId);

  // Claude selects matching line items from catalog
  const lineItems = await claude.complete({
    system: QUOTE_BUILDER_PROMPT,
    user: `Job type: ${job.jobType}\nNotes: ${job.notes}\n
           Customer history: ${history.summary}\n
           Service catalog: ${JSON.stringify(catalog)}`
    // Returns: [{serviceId, quantity, unitPrice, description}]
  });

  const quote = await createQuote({
    jobId, customerId, lineItems,
    expiresAt: addDays(new Date(), 7),
    paymentLink: await stripe.createPaymentLink(...)  // deposit only
  });

  await sendSMS(customer.phone, formatQuoteSMS(quote));
  return quote;
}
```

### 6.3 Auto-Invoice on Job Close

```typescript
async function onJobComplete(jobId: string, techId: string, completionData: any) {
  const job = await getJob(jobId);

  // 1. Generate invoice
  const invoice = await createInvoice({
    jobId,
    lineItems:  completionData.lineItems || job.quotedLineItems,
    laborMins:  completionData.actualMins,
    photoUrls:  completionData.photos,   // stored in S3
    invoicedAt: new Date()
  });

  // 2. Sync to QuickBooks
  await quickbooks.createInvoice(invoice);

  // 3. Send to customer immediately
  const payLink = await stripe.createPaymentLink({
    amount:   invoice.total,
    metadata: { invoiceId: invoice.id },
  });
  await sendEmail(job.customer.email, formatInvoiceEmail(invoice, payLink));
  await sendSMS(job.customer.phone,
    `Invoice for today's job: $${invoice.total}. Pay here: ${payLink}`
  );

  // 4. Schedule reminders
  await jobQueue.add('invoice_reminder', { invoiceId: invoice.id, tone: 'friendly' }, { delay: days(3) });
  await jobQueue.add('invoice_reminder', { invoiceId: invoice.id, tone: 'firm' },     { delay: days(7) });
  await jobQueue.add('invoice_reminder', { invoiceId: invoice.id, tone: 'escalate' }, { delay: days(14) });
}
```

---

## 7. Core Data Model

### 7.1 Entity Relationships

```
businesses ──< technicians
           ──< customers ──< jobs ──< invoices ──< payments
           ──< service_catalog              ──< line_items
           ──< action_log                   ──< photos (S3)
           ──< owner_alerts
           ──< maintenance_plans ──< plan_jobs
           ──< upsell_prompts
```

### 7.2 Core Table Schemas

```sql
CREATE TABLE businesses (
  id                UUID PRIMARY KEY,
  name              TEXT NOT NULL,
  phone             TEXT,            -- the forwarded business number
  pipeai_number     TEXT,            -- Twilio number PipeAI answers
  owner_cell        TEXT NOT NULL,   -- where alerts go
  owner_cell_backup TEXT,
  service_area_zips TEXT[],
  timezone          TEXT DEFAULT 'America/Chicago',
  business_hours    JSONB,           -- {mon: {open:'8:00',close:'17:00'}, ...}
  qbo_realm_id      TEXT,            -- QuickBooks company ID
  qbo_access_token  TEXT,            -- encrypted AES-256
  stripe_account_id TEXT,            -- Stripe Connect account
  plan              TEXT,            -- 'solo' | 'pro' | 'growth'
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE customers (
  id             UUID PRIMARY KEY,
  business_id    UUID REFERENCES businesses(id),
  name           TEXT,
  phone          TEXT,
  email          TEXT,
  address        TEXT,
  lat            FLOAT,
  lng            FLOAT,
  notes          TEXT,           -- AI-maintained context about this customer
  lifetime_value NUMERIC(12,2) DEFAULT 0,
  job_count      INT DEFAULT 0,
  last_job_at    TIMESTAMPTZ,
  on_plan        BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE action_log (
  id             UUID PRIMARY KEY,
  business_id    UUID REFERENCES businesses(id),
  agent_name     TEXT,
  action_type    TEXT,
  description    TEXT,
  input_data     JSONB,
  output_data    JSONB,
  was_overridden BOOLEAN DEFAULT false,
  override_by    TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
-- Every autonomous action is logged here.
-- Powers owner transparency view and morning briefing.
```

---

## 8. Integration Architecture

### 8.1 QuickBooks Online

```typescript
// Uses intuit-oauth npm package
// OAuth2 flow runs once during onboarding

// What PipeAI syncs TO QuickBooks:
// - New customer  → QBO Customer
// - New invoice   → QBO Invoice (with line items, job reference)
// - Payment via Stripe → QBO Payment applied to invoice
// - Tech time entry   → QBO Time Activity (for job costing)

// Sync rules:
// - PipeAI is write-only to QBO for jobs
// - QBO is source of truth for existing customer/financial data
// - Sync on each event (not batch) to keep QBO live
```

### 8.2 Twilio SMS

```typescript
// Each business gets a dedicated Twilio number at onboarding

app.post('/webhooks/twilio/sms', async (req, res) => {
  const { From, To, Body } = req.body;

  const business = await getBusinessByPipeAINumber(To);
  const isOwner  = From === business.ownerCell;
  const customer = await findOrCreateCustomer(business.id, From);

  if (isOwner) {
    await handleOwnerCommand(business, Body);     // Command Parser
  } else {
    await handleCustomerSMS(business, customer, Body);  // Customer Agent
  }

  res.send('<Response></Response>');  // Empty TwiML = no auto-reply
});
```

### 8.3 Stripe Connect

```typescript
// Stripe Connect (Standard accounts)
// PipeAI takes application_fee_amount on each charge
// Business connects their Stripe account at onboarding

async function createPaymentLink(invoice: Invoice, business: Business) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount:                 Math.round(invoice.total * 100),
    currency:               'usd',
    application_fee_amount: Math.round(invoice.total * 0.019 * 100), // 1.9%
    transfer_data: { destination: business.stripeAccountId },
    metadata: { invoiceId: invoice.id, businessId: business.id }
  }, { stripeAccount: business.stripeAccountId });

  return `${BASE_URL}/pay/${paymentIntent.id}`;
}

// Webhook handler
app.post('/webhooks/stripe', async (req, res) => {
  const event = stripe.webhooks.constructEvent(
    req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET
  );
  if (event.type === 'payment_intent.succeeded') {
    await handlePaymentReceived(event.data.object);
    // Marks invoice paid, syncs to QBO, sends receipt, alerts owner
  }
  res.json({ received: true });
});
```

---

## 9. Technician Mobile App

### 9.1 Tech Stack

**React Native (Expo managed workflow)**
- Single codebase for iOS and Android
- Offline-first with Expo SQLite
- Best choice for a 2-engineer team
- Rejected: PWA (no background location, unreliable push, poor Android camera UX)

### 9.2 Core Screens

| Screen | Key Features |
|--------|-------------|
| Today's Jobs | Ordered job list. Tap to open. Emergency jobs highlighted red. |
| Job Detail | Customer name, address (tap → Maps), job type, notes, equipment history, upsell prompt card. |
| Job Execution | Start/Pause/Complete buttons. Running timer. Photo capture (GPS + timestamp tagged). Parts checklist. |
| Upsell Prompt | Pre-written recommendation: "Water heater is 11 years old — consider recommending replacement." One-tap to add to quote. |
| Clock In/Out | Simple tap. GPS-verified. Feeds time tracking and payroll. |

### 9.3 Offline Architecture

```typescript
// Optimistic updates + background sync
// Critical: schedule and job data available even without signal

// Local SQLite schema (Expo SQLite)
CREATE TABLE local_jobs (
  id          TEXT PRIMARY KEY,
  data        TEXT,         -- JSON blob of full job
  sync_status TEXT,         -- 'synced' | 'pending' | 'conflict'
  updated_at  INTEGER       -- Unix timestamp
);

CREATE TABLE local_actions (
  id          TEXT PRIMARY KEY,
  action_type TEXT,         -- 'start_job' | 'complete_job' | 'add_photo'
  payload     TEXT,         -- JSON
  created_at  INTEGER,
  synced      BOOLEAN DEFAULT 0
);

// Sync strategy:
// 1. All actions write to local_actions immediately (optimistic)
// 2. Background task syncs pending actions when connection available
// 3. Server resolves conflicts (server wins for scheduling; tech wins for completion data)
// 4. Photos upload to S3 with exponential backoff retry
```

---

## 10. Infrastructure & Deployment

### 10.1 Hosting

| Component | Where | Notes |
|-----------|-------|-------|
| API Server (Node.js / Fastify) | Railway or Render | Auto-scaling, zero DevOps overhead. Migrate to AWS ECS at Series A. |
| Background jobs | BullMQ on Redis (Upstash) | Handles reminders, briefings, follow-up sequences, crons. |
| Database | Supabase (managed Postgres) | Point-in-time recovery. Row-level security for multi-tenant isolation. |
| File storage | AWS S3 | Call recordings + tech job photos. Pre-signed URLs. |
| Edge / CDN | Vercel Edge | Owner web dashboard + customer payment pages. |
| Cache | Upstash Redis | Business context, tech locations, open schedule windows. |

### 10.2 Security Requirements

> **Build for SOC 2 Type II from day one.** Plumbing businesses share customer home addresses, payment data, and business financials with PipeAI.

- **Multi-tenancy:** Row-level security (RLS) on ALL Supabase tables. `businessId` on every query. Enforced at DB level, not application level.
- **Encryption at rest:** Supabase encrypts all data at rest. S3 server-side encryption on all files.
- **Encryption in transit:** TLS 1.3 everywhere. HSTS enforced.
- **API keys:** All vendor credentials in environment variables (Railway secrets). Never in code or logs.
- **QuickBooks tokens:** Encrypted with AES-256 before storage. Decrypted in-memory only.
- **PII handling:** Customer data stored only in the business's tenant. Anonymized for cross-tenant analytics.
- **Call recordings:** S3 with business-scoped access only. Auto-deleted after 90 days unless opted in.
- **Audit log:** Every data access event logged (timestamp, agent, action).
- **Integration tests:** Automated cross-tenant isolation tests run on every PR.

### 10.3 Observability

| Concern | Tool |
|---------|------|
| Error tracking | Sentry — catches exceptions across API, agents, mobile app |
| API performance | Datadog APM (or OpenTelemetry + Grafana). P99 latency monitored per endpoint. Voice latency must stay <500ms. |
| LLM call logging | **Langfuse** — logs every Claude call with input, output, latency, token count. Critical for debugging agent behavior. |
| Business health metrics | Custom dashboard: calls answered, bookings created, invoices sent, payments received |
| Uptime monitoring | Better Uptime — 30s checks on all critical webhooks. SMS alert to on-call engineer if webhook fails. |

---

## 11. MVP Build Plan: 90 Days to First Customer

### 11.1 MVP Scope

The MVP proves exactly one thing: **PipeAI can answer a plumbing emergency call after hours, book a job, and notify the owner — better than voicemail.**

**In scope:**
- Intake Agent: voice answering, emergency routing, basic booking via SMS confirmation
- Dispatch Agent: manual schedule input by owner; PipeAI sends tech SMS briefings and ETA notifications
- Revenue Agent: auto-invoice on job close, email delivery
- Owner SMS interface: daily briefing, emergency alerts, basic commands
- Tech mobile app: job list, start/complete, photo upload — iOS only
- QuickBooks sync: invoice sync only

**Out of scope for MVP:** Stripe payments integration, Customer Agent, Intelligence Agent, upsell engine, Android app, web dashboard.

### 11.2 Sprint Plan

| Sprint | Focus | Key Deliverables |
|--------|-------|-----------------|
| Sprint 1 (Wks 1–2) | Foundation | Supabase schema, auth, multi-tenant RLS, API scaffold (Fastify), Twilio number provisioning, onboarding form |
| Sprint 2 (Wks 3–4) | Voice AI Core | Vapi integration, intake system prompt, emergency detection, basic booking flow. **First real call answered by AI.** |
| Sprint 3 (Wks 5–6) | Scheduling & Dispatch | Job data model, tech profiles, morning briefing SMS, ETA notification on job start, Google Maps integration |
| Sprint 4 (Wks 7–8) | Revenue Core | Auto-invoice generation, email delivery via Resend, QuickBooks invoice sync, quote generation via SMS |
| Sprint 5 (Wks 9–10) | Tech Mobile App | React Native app: job list, job detail, start/complete, photo upload. iOS TestFlight release. |
| Sprint 6 (Wks 11–12) | Owner Interface & Launch | Owner SMS command parser, daily briefing, action log, onboarding polish. **First 5 pilot customers live.** |

### 11.3 Team Requirements

| Role | Responsibility |
|------|---------------|
| Full-Stack Engineer #1 (backend) | API server, agent orchestration, Vapi/Twilio integrations, Supabase schema, QuickBooks sync |
| Full-Stack Engineer #2 (frontend/mobile) | React Native tech app, owner web dashboard, onboarding flow, Stripe payment pages |
| Founder / PM | Product decisions, customer interviews, prompt engineering for agents |
| Part-time domain advisor | Validate job types, pricing, dispatch logic, tech UX. Ideally a current/former plumbing business owner. |

### 11.4 MVP Success Metrics

- 5 pilot customers live at 90 days
- 90% of calls answered without escalation
- At least 1 emergency job captured after hours
- All pilots would recommend to peers

---

## 12. Technical Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Voice AI latency spikes causing awkward pauses | High | Use Vapi's built-in filler phrases during processing. Pre-cache business context in Redis. Set 400ms LLM timeout with fallback response. |
| LLM hallucinates job prices or availability | High | Tool calls are ground-truth only — AI cannot invent prices, only retrieve from catalog. Booking requires explicit `get_available_slots` call before confirming. |
| Vapi or Twilio outage during business hours | High | Fallback: if Vapi webhook fails, Twilio forwards call to owner's cell directly. Never goes to voicemail. |
| QuickBooks API rate limits (500 req/min) | Medium | Batch non-urgent syncs. Use webhook-driven sync (not polling). Cache QBO customer IDs after first creation. |
| Multi-tenant data leakage bug | Critical | RLS on every table at DB level (not application level). Automated integration tests verify cross-tenant isolation on every PR. |
| Tech refuses to use the mobile app | Medium | SMS-first fallback for everything. Tech can text job updates and receive schedule via SMS. App is enhancement, not requirement. |
| AI books job outside service area | Medium | Service area validation is a hard-coded check (zip code list), not an AI decision. AI cannot override it. |
| Google Maps API cost at scale | Low | Cache distance matrix results for common route pairs. Est. ~$75/month at 500 customers. |

---

## 13. Build Priority Order

The single highest-leverage build sequence:

| Priority | Milestone | Why |
|----------|-----------|-----|
| 1 | AI answers a real call (Week 4) | This is the demo that sells the product. Every other feature is secondary until this works perfectly. |
| 2 | Books a job automatically (Week 4) | Completing the intake loop — answer, understand, book, confirm — is the entire value prop for 68% of the market. |
| 3 | Sends the owner an alert (Week 4) | Owner needs to trust PipeAI is working. Instant SMS on every booking is the trust mechanism. |
| 4 | Auto-invoice on job close (Week 8) | Directly attacks the #2 pain: late payment. Owner sees money faster within weeks of going live. |
| 5 | Morning briefing (Week 10) | Replaces the mental overhead of "what's happening today." Creates operational dependency — and that's the retention flywheel. |

---

*The build principle: every decision in this document optimises for the moment a plumbing owner hears PipeAI answer a real emergency call at midnight and book the job by the time they've poured their coffee. When that moment happens, retention is locked in. Everything else is iteration.*
