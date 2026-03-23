# PipeAI — Product Specification
> Autonomous AI Operations Platform for Plumbing Contractors  
> Version 1.0 — March 2026 | CONFIDENTIAL

---

## Quick Reference

| Stat | Value |
|------|-------|
| US plumbing businesses | 132,000+ |
| Emergencies after hours | 68% |
| US market size (2025) | $169.8B |
| Penetrated by premium software | <5% |
| Target customer size | 2–8 techs, $500K–$2M revenue |
| Pricing | $149 / $299 / $499 per month |

---

## 1. The Problem

Plumbing business owners are skilled tradespeople running complex small businesses with almost no back-office support. The average owner-operator with 2–8 technicians spends 3–5 hours every day on tasks that have nothing to do with plumbing.

### 1.1 The Daily Pain Stack

| Pain Point | Business Impact |
|------------|----------------|
| Missed after-hours calls | 68% of plumbing emergencies happen outside 9–5. Every unanswered call is a job lost to a competitor. |
| Manual quoting | Contractors spend hours weekly on estimates. Quoting over the phone risks underpricing. |
| Invoice chasing | 83% of contractors have filed liens due to late payment. 46% wait 60–90 days to get paid. |
| Scheduling chaos | Double-bookings, wasted drive time, and wrong-tech dispatches cost 30%+ of daily capacity. |
| No upsell system | Technicians complete jobs without recommending adjacent services. |
| Job costing blind spots | Labor burden miscalculations can inflate apparent profit by up to 50%. |
| Zero recurring revenue | Maintenance agreements and service plans remain massively underutilized. |

### 1.2 The Software Gap

| Tool | Problem for Small Plumbing Shops |
|------|----------------------------------|
| ServiceTitan | $200–500/tech/month + 5–8 week onboarding. Built for 15+ tech enterprises. Passive dashboard, not autonomous. |
| Jobber / Housecall Pro | Better priced but still passive tools. Owner must log in and manage everything manually. |
| Generic CRMs | No understanding of plumbing workflows, flat-rate pricing, permit logic, or emergency dispatch urgency. |
| Spreadsheets & paper | Still used by ~80% of shops under 5 techs. Zero automation, zero intelligence. |

> **The White Space:** There is no product that proactively *runs* a plumbing business for an owner-operator. Every existing tool waits for the owner to log in. PipeAI acts — on its own, around the clock.

---

## 2. The Product

PipeAI is not field service management software. It is an autonomous AI agent that operates the non-trade functions of a plumbing business — proactively, continuously, and without requiring the owner to log in and manage a dashboard.

**Positioning:** PipeAI is the first employee a plumbing owner hires, not the last software they buy.

### 2.1 Core Design Principles

- **Field-first UX:** Everything works via text, voice memo, or a 2-tap mobile action. No desktop dashboards required.
- **Zero-setup onboarding:** Owner answers 10 questions. PipeAI is live within 24 hours.
- **Proactive, not reactive:** PipeAI initiates actions. It does not wait to be told what to do.
- **Plumbing-native intelligence:** The AI understands flat-rate pricing, labor burden, lien rights, permit workflows, and emergency triage — out of the box.
- **Transparent control:** Every action is logged. Owner receives a morning briefing and can override any decision via text.

### 2.2 The Five Agents

#### Agent 1 — Intake Agent: "Never Miss a Job"

Answers every inbound call, text, and web inquiry — 24/7.

- Answers calls in under 5 seconds with a natural, conversational AI voice
- Detects urgency language in real time ("burst pipe", "flooding", "no hot water") and routes true emergencies to the owner's cell immediately
- For non-emergencies: collects job details, address, preferred time, and books directly into the schedule
- Sends confirmation SMS to customer with tech name, ETA window, and payment expectations
- Handles FAQ calls autonomously (hours, pricing, service areas) without escalating

**Revenue Impact:** Recovering 10 missed after-hours calls/week at $445 AOV = ~$231,400/year in captured revenue. PipeAI cost: $199–399/month.

#### Agent 2 — Dispatch Agent: "Right Tech, Right Job, Right Time"

Manages the daily schedule autonomously — optimizing routes, balancing workload, handling real-time changes.

- Builds the daily schedule each morning based on booked jobs, tech availability, and drive-time optimization
- Skill-based dispatching: matches job type to tech certification and experience
- Inserts emergency jobs into the live schedule with minimal disruption to committed appointments
- Sends techs their daily job list via SMS at 6am, with real-time updates
- Sends customers "on the way" texts with live ETA when tech departs
- Flags schedule conflicts, overtime risks, and capacity gaps to the owner each afternoon

#### Agent 3 — Revenue Agent: "Win More, Charge Right, Get Paid Fast"

Handles the entire financial workflow from quote to collected payment.

- Generates flat-rate quotes in minutes based on job type, local market rates, and historical pricing
- Sends professional, branded quote via SMS/email with one-tap approval and deposit collection
- Follows up on unsent or unapproved quotes after 24 hours
- Auto-generates invoice the moment a tech closes out a job
- Runs automated payment reminder sequences: same-day, 3-day, 7-day, 14-day
- Identifies upsell triggers from job notes and sends tech pre-written recommendations before arrival
- Proposes maintenance plan enrollment after every completed service job

| Financial Metric | With PipeAI |
|-----------------|-------------|
| Average days to invoice | 0 days (auto on job close vs. 3–7 day industry average) |
| Average days to payment | 8–12 days (vs. 45–60 day industry average) |
| Upsell attachment rate | Est. 15–25% of jobs (vs. 2–5% without prompting) |
| Maintenance plan conversion | Est. 10–18% of completed jobs |

#### Agent 4 — Customer Agent: "Build Loyalty on Autopilot"

Manages all outbound customer communication, reputation, and relationship workflows.

- Sends post-job satisfaction check-in within 2 hours of job completion
- Automatically requests Google Review from satisfied customers
- Manages maintenance plan renewals: sends reminder 30 days before expiry, books follow-up
- Runs seasonal outreach campaigns ("winter pipe freeze check", "summer water heater efficiency audit")
- Responds to inbound customer messages 24/7 using job history context
- Flags unhappy customers or complaints to the owner immediately

#### Agent 5 — Intelligence Agent: "Know Your Numbers Without Doing the Math"

Monitors business performance in real time. Delivers a morning briefing every day — no dashboard required.

- **Daily morning text:** jobs today, revenue yesterday, outstanding invoices, one action item
- **Weekly P&L summary:** revenue by job type, labor burden vs. estimate, margin by tech
- Flags cost overruns in real time as jobs close over budget
- Tracks technician utilization rate and identifies scheduling gaps costing revenue
- Generates monthly business health report with benchmarks vs. industry averages

---

## 3. User Experience

### 3.1 Onboarding: 24 Hours to Live

| Step | What Happens |
|------|-------------|
| 1. Sign Up (10 min) | Business name, service area zip codes, number of techs, billing rates, top 10 job types with flat-rate prices |
| 2. Phone Number Assigned (1 hr) | PipeAI provisions a local number. Owner forwards their business line. |
| 3. Tech Profiles (20 min) | Owner adds tech names, skills, availability. Can be done via text conversation with AI. |
| 4. QuickBooks Sync (15 min) | One-click integration with QuickBooks Online |
| 5. Go Live | PipeAI begins answering calls. Owner receives first morning briefing next day. |

### 3.2 Owner Interface: Text-First

Primary interface is SMS/text. The owner never needs to open an app or log into a dashboard.

**Daily Briefing (6:00 AM):** Today's schedule, yesterday's revenue, outstanding invoices, one recommended action.

**Owner can text PipeAI natural language commands:**
- "Who's closest to a job in Riverside right now?"
- "Reschedule Johnson to Thursday"
- "What's my outstanding AR this week?"
- "Add a $350 flat rate for toilet replacement"

### 3.3 Tech Interface: 3-Tap Mobile

Lightweight mobile app (React Native). Designed for dirty hands, poor cell coverage.

- Daily job list with addresses, job type, and customer notes at 6am
- One-tap job start/end for time tracking
- Photo upload for job documentation
- Pre-built upsell recommendations waiting when they open each job
- Offline mode for areas with no signal

### 3.4 Customer Experience

From the customer's perspective, PipeAI-powered companies feel like professionally run operations:
- Phone answered immediately, 24/7
- Booking confirmed via SMS within seconds
- Tech introduction text sent the morning of the job
- "On the way" notification with real ETA
- Quote received digitally, payable by card in one tap
- Invoice emailed immediately after job completion
- Follow-up message and review request within 2 hours

---

## 4. Business Model & Pricing

### 4.1 Pricing Tiers

| Feature | Solo ($149/mo) | Pro ($299/mo) | Growth ($499/mo) |
|---------|---------------|--------------|-----------------|
| Techs included | 1 | Up to 5 | Up to 15 |
| Intake Agent (24/7 answering) | ✓ | ✓ | ✓ |
| Dispatch Agent | ✓ | ✓ | ✓ |
| Revenue Agent (quotes & invoicing) | ✓ | ✓ | ✓ |
| Customer Agent | — | ✓ | ✓ |
| Intelligence Agent | — | ✓ | ✓ |
| Daily SMS briefing | ✓ | ✓ | ✓ |
| QuickBooks integration | ✓ | ✓ | ✓ |
| Maintenance plan management | — | ✓ | ✓ |
| Multi-location support | — | — | ✓ |
| Custom flat-rate pricebook | 50 items | Unlimited | Unlimited |
| Monthly calls handled | 500 | 2,000 | Unlimited |

### 4.2 Revenue Streams

| Stream | Detail |
|--------|--------|
| Subscription (primary) | Recurring monthly — target 80% of revenue |
| Payments processing | 1.9% + $0.20 per transaction on invoices paid through PipeAI |
| Financing facilitation | Revenue share on customer financing options at point of quote |
| Premium onboarding | Optional $299 white-glove setup |

### 4.3 Unit Economics

| Metric | Value |
|--------|-------|
| Target avg MRR/customer | $299 |
| Est. annual payments revenue/customer | $850 |
| Est. total annual revenue/customer | ~$4,450 |
| Target payback period on CAC | <30 days |
| Target gross revenue retention | >95% |

---

## 5. Go-to-Market

### 5.1 Beachhead Target Customer

| Characteristic | Profile |
|---------------|---------|
| Business size | 2–8 technicians, 1–2 office staff or none |
| Annual revenue | $500K – $2M |
| Current software | Jobber, Housecall Pro, QuickBooks, or spreadsheets |
| Geography (Phase 1) | Sun Belt: Texas, Florida, Arizona, Georgia |
| Owner profile | Trade-skilled, not tech-native. Values ROI and simplicity. |
| Primary pain | After-hours missed calls, invoice collection, scheduling chaos |

### 5.2 Acquisition Channels

1. **Trade Association & Supply House Partnerships** — Partner with Ferguson, Hajoca, Winsupply. Target local PHCC chapter speaking slots.
2. **Paid Search** — "plumbing answering service after hours", "ServiceTitan too expensive alternative"
3. **YouTube & Trades Content** — Sponsor "The Successful Contractor", "Contractor Freedom" podcasts
4. **Referral Program** — Free month for every referred customer who activates

### 5.3 Sales Motion

Self-serve, product-led growth. No sales calls required for Solo/Pro. Website demo = live simulation of PipeAI answering a fake burst-pipe call. Owner goes from landing page to live trial in under 5 minutes.

---

## 6. Competitive Positioning

| Dimension | ServiceTitan | Jobber / HCP | PipeAI |
|-----------|-------------|--------------|--------|
| Behavior | Passive dashboard | Passive dashboard | Autonomous agent |
| Setup time | 5–8 weeks | Days | <24 hours |
| Target size | 15+ techs | 2–20 techs | 1–15 techs |
| Price (5 techs) | $1,000–1,750/mo | $149–329/mo | $299/mo |
| After-hours coverage | No | No | Yes — core feature |
| Proactive dispatch | No (manual) | No (manual) | Yes — autonomous |
| Upsell prompting | Limited | None | Built-in every job |
| Owner interface | Desktop app | Mobile app | SMS/text-first |
| Plumbing-specific AI | Partial | No | Full |

---

## 7. Build Roadmap

### Phase 1 (Months 1–3): Foundation
Goal: First 50 paying customers. Prove core value proposition.

- Intake Agent (voice & SMS)
- Dispatch Agent (simple daily scheduling)
- Auto-invoice on job close
- QuickBooks Online sync
- Owner SMS daily briefing
- Basic tech mobile app (iOS)

### Phase 2 (Months 4–6): Revenue Engine
Goal: 200 paying customers.

- AI quote generation and delivery
- Upsell prompts on every job
- Post-job review automation
- Maintenance plan management
- Stripe payment processing (1.9% + $0.20)
- Web reporting dashboard

### Phase 3 (Months 7–12): Intelligence & Scale
Goal: 500+ customers.

- Intelligence Agent (margin monitoring, demand forecasting)
- Cross-company benchmarking data
- Multi-location support
- Customer financing at point of quote
- Supply chain integration (auto-order parts)
- Permit tracking agent

---

## 8. Financial Projections (3-Year)

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| Customers (end of year) | 500 | 2,000 | 6,000 |
| ARR | $1.5M | $6.7M | $23M |
| Gross Margin | 72% | 78% | 82% |
| Monthly Churn | 4.5% | 3.5% | 2.5% |
| Net Revenue Retention | 105% | 112% | 118% |
| LTV:CAC Ratio | 3.7x | 6.7x | 12.8x |

**Seed raise: $2M**
- Engineering & Product: $800K
- Sales & Marketing: $600K
- Operations & Customer Success: $300K
- Infrastructure & AI Costs: $200K
- G&A: $100K

---

## 9. Why Now

1. **Voice AI quality threshold crossed** — Conversational AI can now handle a plumbing emergency call with the naturalness required to earn customer trust. This was not true 18 months ago.
2. **Labor shortfall at crisis point** — Projected shortfall of 550,000 plumbers by 2027. Every owner-operator is stretched thin and desperate to eliminate admin work.
3. **ServiceTitan's IPO created a price/complexity ceiling** — ServiceTitan's December 2024 IPO hardened its enterprise positioning. The sub-$2M revenue plumbing shop is permanently unserved by the incumbent.
