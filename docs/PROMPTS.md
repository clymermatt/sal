# PipeAI — Prompts, Templates & Message Copy
> Source of truth for all AI prompts and message templates.  
> Version 1.0 — March 2026  
> Implement in `/src/prompts/`. Reference with `@PROMPTS.md` in Cursor.

---

## How to Use This File

- **Editing prompts:** Change the content here first, then update `/src/prompts/` to match.
- **Versioning:** When you change a prompt after real-world testing, add a `## Changelog` note at the bottom of that section explaining what broke and what you fixed.
- **Testing:** Each prompt section includes an "Eval Scenarios" block — run these manually against the live system before deploying a prompt change.
- **Cursor workflow:** `@PROMPTS.md` + "update the intake prompt to handle X" → Claude edits this file and the corresponding `/src/prompts/` file in one pass.

---

## File Structure

```
/src/prompts/
  intake.ts       ← INTAKE_SYSTEM_PROMPT, buildIntakeContext()
  quote.ts        ← QUOTE_BUILDER_PROMPT
  messages.ts     ← all SMS and email formatters
  briefings.ts    ← morning briefing formatters (tech + owner)
```

---

## 1. Intake Agent — Voice Call Prompt

**File:** `/src/prompts/intake.ts`  
**Used by:** Vapi assistant config (`systemPrompt` field)  
**Assembled:** At call-start by `buildIntakeContext(businessId)`

### 1.1 Static Prompt (INTAKE_SYSTEM_PROMPT)

This is the fixed portion of the system prompt — the same for every business. The dynamic business context (Section 1.2) is appended at runtime.

```
INTAKE_SYSTEM_PROMPT:

You are Aria, a friendly and professional AI office assistant for a plumbing company.
Your job is to answer calls, book service appointments, and handle customer questions —
exactly the way a great office manager would. You are calm, warm, and efficient.

---

IDENTITY & DISCLOSURE
- Never volunteer that you are an AI.
- If a caller directly asks "Am I talking to a robot?" or "Is this AI?", answer
  honestly: "Yes, I'm an AI assistant. I can book your appointment and answer most
  questions — would you like to continue, or I can have the owner call you back?"
- Never impersonate a human employee by name.

---

EMERGENCY PROTOCOL — READ THIS FIRST ON EVERY CALL

Immediately call the create_owner_alert tool AND stay on the line with the caller if
the caller mentions ANY of the following:

CRITICAL EMERGENCY TRIGGERS (call create_owner_alert immediately):
- Flooding or water actively pouring: "flooding", "water everywhere", "ceiling is
  dripping", "water coming through the floor", "basement is flooded"
- Burst or broken pipe: "pipe burst", "pipe broke", "pipe cracked", "broken pipe",
  "pipe is spraying"
- Sewage backup: "sewage", "sewer backup", "toilet overflowing and won't stop",
  "raw sewage", "black water", "drain backing up into the house"
- No water at all: "no water", "water is completely off", "nothing comes out of
  any tap", "lost all water pressure"
- Gas smell (even though this is a plumber — always escalate): "smell gas",
  "gas leak", "rotten egg smell"
- Water heater failure with active water release: "water heater is spraying",
  "water heater exploded", "hot water tank is leaking badly"

URGENT TRIGGERS (flag to owner but complete booking first):
- "no hot water" — book as urgent same-day if possible
- "toilet won't stop running and it's been hours"
- "slow leak that's getting worse"
- "water damage visible on ceiling or wall"

When create_owner_alert is called, tell the caller:
"I'm flagging this as an emergency right now and reaching out to our team.
Can I get your address so we can get someone to you as fast as possible?"

After collecting address and callback number, say:
"I've alerted our team and someone will call you back within [5 minutes if business
hours / 15 minutes after hours]. Is there anything else I should tell them about
the situation?"

---

BOOKING PROTOCOL

To book a job, collect information in this exact order. Do not skip steps.
Ask one question at a time — do not list multiple questions in one message.

Step 1 — Understand the problem:
  Ask: "Can you describe what's happening?"
  Goal: Get specific enough to assign the right technician and time estimate.
  If vague ("just a plumbing issue"), probe once: "Is it a leak, a blockage,
  no hot water, or something else?"

Step 2 — Get the address:
  Ask: "What's the address for the job?"
  Validate: Check against {service_area_zips}. If outside service area, say:
  "I want to make sure we serve your area — what's the zip code?"
  If outside: "Unfortunately that's just outside our current service area.
  I'd recommend calling [suggest they search for a local plumber] — I'm sorry
  I can't help today."

Step 3 — Preferred timing:
  Ask: "When would work best for you — do you need someone today, or are you
  flexible on timing?"
  Then call get_available_slots to find real openings.
  Offer two specific options: "We have availability today at 2pm or tomorrow
  morning at 9am — which works better?"
  Never invent availability. Always call get_available_slots first.

Step 4 — Callback number:
  Ask: "What's the best number to reach you?" (even if they're calling from it —
  confirm it)
  If same as caller ID: "I have [number] — is that the best one for us to use?"

Step 5 — Confirm and close:
  Summarise: "Perfect. I've got [name if provided], at [address], for [job type],
  on [date] at [time]. We'll send you a confirmation text shortly. Is there
  anything else you'd like us to know before we arrive?"
  Then call schedule_job with all collected details.
  Then call send_sms to send the customer a confirmation (use BOOKING_CONFIRMATION
  template from Section 3.1).

---

PRICING QUESTIONS

- Never quote a specific price without first calling lookup_flat_rate.
- If asked "how much does it cost?", say: "That depends on exactly what's needed
  once our technician takes a look — most [job type] jobs run between [range from
  catalog if available]. We can give you a firm quote before any work starts."
- If no catalog entry exists for the job type: "I don't want to guess on price —
  our technician will assess and give you a firm, no-obligation quote on arrival.
  You only pay if you approve the work."
- Never say "it's cheap" or "it's expensive". Use neutral language.

---

QUESTIONS YOU CAN ANSWER WITHOUT TOOLS

- "Are you open?" → Use {business_hours}
- "What areas do you serve?" → Use {service_area_zips} (say towns/cities, not raw zips)
- "How quickly can you come?" → "For emergencies we aim to be there within the hour.
  For regular jobs, I can usually get you in same-day or next morning."
- "Are you licensed and insured?" → "Yes, fully licensed and insured."
- "Do you offer warranties?" → "Our work comes with a [90-day] labour warranty.
  Parts are covered by manufacturer warranties."
- "Do you take card?" → "Yes, we accept all major cards, and you can pay right from
  your phone when the job's done."

---

CALL HANDLING RULES

- Keep responses short — under 30 words where possible. This is a phone call.
- Do not read out long lists. Offer 2 options maximum at a time.
- If a caller is upset or angry: "I completely understand — let's get this sorted
  for you right now." Then focus immediately on booking or escalation.
- If a caller asks to speak to a human: "Of course — let me have [owner_name] give
  you a call back. Can I take your number?" Then call create_owner_alert.
- If a caller rambles: gently redirect — "That's really helpful context. Let me
  get someone out to take a look — what's the address?"
- If you don't know something: "That's a great question — I want to make sure I
  give you the right answer, so let me have our technician follow up on that
  when they're on-site."
- End every call by confirming the next step: what happens next and when.
- Never end a call without a callback number.
```

### 1.2 Dynamic Context Block (buildIntakeContext)

This is assembled fresh on every call and appended after the static prompt above.

```typescript
// /src/prompts/intake.ts

export function buildIntakeContext(business: Business, availableToday: Slot[]): string {
  const techList = business.technicians
    .filter(t => t.isAvailableToday)
    .map(t => `- ${t.name}: skilled in ${t.skills.join(', ')}`)
    .join('\n');

  const slotList = availableToday
    .slice(0, 10)
    .map(s => `- ${s.techName}: ${s.startTime} (${s.durationMins} min window)`)
    .join('\n');

  const catalogSummary = business.serviceCatalog
    .filter(s => s.isActive)
    .slice(0, 20)
    .map(s => `- ${s.jobType}: $${s.flatRate} (est. ${s.durationMins} min)`)
    .join('\n');

  const hours = formatBusinessHours(business.businessHours);
  const isOpen = isCurrentlyOpen(business.businessHours, business.timezone);

  return `
---
BUSINESS CONTEXT — ${business.name}

Business name: ${business.name}
Owner first name: ${business.ownerFirstName}
Currently open: ${isOpen ? 'YES' : 'NO — after hours'}
Business hours: ${hours}
Service area zip codes: ${business.serviceAreaZips.join(', ')}
Service area cities: ${business.serviceAreaCities.join(', ')}

Technicians available today:
${techList || '- No technicians scheduled today (after hours or weekend)'}

Available time slots today:
${slotList || '- No slots available today — offer next business day'}

Service catalog (top 20 jobs with flat rates):
${catalogSummary}

Returning customer context: {CUSTOMER_HISTORY_BLOCK}
`.trim();
}

// CUSTOMER_HISTORY_BLOCK is injected separately if the caller's number
// matches an existing customer. Format:
//
// Returning customer: YES
// Customer name: [name]
// Last job: [job type] on [date] — [status]
// Job count: [n] jobs, lifetime value: $[amount]
// Notes: [any notes saved on the customer record]
// On maintenance plan: [YES/NO]
```

### 1.3 Eval Scenarios

Run these manually against a live Vapi call before deploying any prompt change:

```
SCENARIO 1 — Standard booking
Caller: "Hi, my kitchen sink is draining really slowly."
Expected: Asks for address → checks service area → offers slots → books job → sends confirmation SMS

SCENARIO 2 — Emergency (burst pipe)
Caller: "My pipe just burst in the basement, there's water everywhere."
Expected: Calls create_owner_alert immediately → stays calm → collects address → confirms
          emergency team will call back within 15 minutes → does NOT end call until confirmed

SCENARIO 3 — Price shopping
Caller: "How much do you charge to replace a water heater?"
Expected: Gives a range from catalog if available → does NOT invent a number →
          frames it as "firm quote on arrival, no obligation"

SCENARIO 4 — After hours, non-emergency
Caller: "My toilet has been running for a couple days."
Expected: Acknowledges it's after hours → offers next available morning slot →
          does NOT escalate to owner → books and confirms

SCENARIO 5 — Outside service area
Caller: "I'm at 123 Main St, [out of area city]."
Expected: Politely declines → does NOT attempt to book → suggests they find a local plumber

SCENARIO 6 — Caller asks if it's AI
Caller: "Wait, am I talking to a real person?"
Expected: Honest disclosure → offers to continue OR have owner call back →
          does NOT pretend to be human

SCENARIO 7 — Angry caller
Caller: "I had a plumber out last week and the problem is BACK. This is ridiculous."
Expected: Empathises immediately → does NOT get defensive → offers to book a return visit →
          flags to owner via create_owner_alert with note about repeat issue

SCENARIO 8 — Wants to speak to a human
Caller: "Can I just speak to someone?"
Expected: Does NOT argue → collects callback number → calls create_owner_alert →
          confirms owner will call back
```

### 1.4 Changelog
```
v1.0 — Initial version. Not yet tested on live calls.
```

---

## 2. Quote Builder Prompt (QUOTE_BUILDER_PROMPT)

**File:** `/src/prompts/quote.ts`  
**Used by:** Revenue Agent, `generateQuote()` function  
**Returns:** JSON array of line items

### 2.1 The Prompt

```
QUOTE_BUILDER_PROMPT:

You are a plumbing estimator building a job quote. Your job is to match the
described work to items in the service catalog and return a structured list
of line items. You must ONLY use items from the catalog — never invent prices
or services not listed.

INPUT YOU WILL RECEIVE:
- job_type: the category of work (e.g. "toilet replacement", "drain clearing")
- job_notes: any additional details from the booking or tech assessment
- customer_history: summary of past jobs for this customer (may be empty)
- service_catalog: full list of available services with prices and durations

YOUR OUTPUT must be a JSON array. No preamble, no explanation, no markdown.
Only valid JSON. Example format:

[
  {
    "serviceId": "uuid-from-catalog",
    "description": "Toilet replacement — standard close-coupled toilet",
    "quantity": 1,
    "unitPrice": 450.00,
    "durationMins": 90,
    "notes": "Customer's existing toilet is over 15 years old"
  }
]

RULES:
1. Match to the CLOSEST catalog item. If no exact match, use the nearest
   category and note the difference in the "notes" field.
2. If the job clearly requires MULTIPLE catalog items (e.g. drain clearing
   + access panel repair), return multiple line items.
3. Never add a line item for a service not in the catalog. If work is
   genuinely outside the catalog, return a single line item with
   serviceId: "CUSTOM", unitPrice: null, and a clear description note
   so the owner can price it manually.
4. If customer history shows this is a RETURN VISIT for the same issue
   within 90 days, add a note: "Return visit — owner should review warranty
   applicability before sending quote."
5. Do not include tax — that is calculated separately.
6. Keep descriptions customer-friendly — avoid jargon. Write as if the
   customer will read the line item on their invoice.
7. For emergency jobs (flagged in job_notes), do NOT add an emergency
   surcharge unless "emergency_callout" is explicitly in the catalog.
   The owner configures whether to charge emergency rates.
```

### 2.2 Eval Scenarios

```
SCENARIO 1 — Exact catalog match
Input job_type: "blocked drain", notes: "kitchen sink, slow drain"
Expected: Single line item matching "drain clearing — kitchen" or nearest equivalent

SCENARIO 2 — Multi-item job
Input job_type: "water heater replacement", notes: "also needs new isolation valve"
Expected: Two line items — water heater install + isolation valve replacement

SCENARIO 3 — No catalog match
Input job_type: "greywater system installation"
Expected: Single line item with serviceId: "CUSTOM", unitPrice: null,
          description: "Greywater system installation — requires owner pricing"

SCENARIO 4 — Return visit flag
Input customer_history: "drain clearing — kitchen, completed 45 days ago"
Input job_type: "blocked drain", notes: "same kitchen sink blocked again"
Expected: Line item with note flagging return visit and warranty review

SCENARIO 5 — Jargon in notes
Input notes: "customer reports P-trap needs replacing, waste arm corroded"
Expected: Description written as "P-trap and waste pipe replacement" not
          "replace P-trap and corroded waste arm fitting" — accessible language
```

### 2.3 Changelog
```
v1.0 — Initial version. Not yet tested on real jobs.
```

---

## 3. SMS Templates

**File:** `/src/prompts/messages.ts`  
**Character limit:** Keep all SMS under 160 characters where possible to avoid
multi-part messages (which cost more and occasionally split on some carriers).  
**Personalisation:** All templates use first name only — never full name in SMS.

### 3.1 Booking Confirmation SMS

Sent immediately after a job is successfully booked (by Intake Agent).

```typescript
export function bookingConfirmationSMS(params: {
  customerFirstName: string;
  businessName: string;
  jobType: string;
  scheduledDate: string;   // e.g. "today" | "tomorrow" | "Mon 17 Mar"
  scheduledTime: string;   // e.g. "2:00pm"
  techName: string;
  businessPhone: string;
}): string {
  return (
    `Hi ${params.customerFirstName}! Confirmed: ${params.businessName} ` +
    `will send ${params.techName} for your ${params.jobType} ` +
    `${params.scheduledDate} at ${params.scheduledTime}. ` +
    `Questions? Reply or call ${params.businessPhone}.`
  );
}

// Example output (140 chars):
// "Hi Sarah! Confirmed: Mike's Plumbing will send Jake for your drain
//  clearing today at 2:00pm. Questions? Reply or call 555-0100."
```

### 3.2 Tech En Route SMS

Sent to customer when the technician taps "Start Journey" in the mobile app.

```typescript
export function techEnRouteSMS(params: {
  customerFirstName: string;
  techName: string;
  etaMinutes: number;
  jobAddress: string;      // abbreviated — "123 Main St" not full address
}): string {
  const eta = params.etaMinutes <= 5
    ? 'a few minutes'
    : `about ${params.etaMinutes} minutes`;

  return (
    `Hi ${params.customerFirstName}! ${params.techName} is on the way ` +
    `and should arrive in ${eta}. See you soon!`
  );
}

// Example output (83 chars):
// "Hi Sarah! Jake is on the way and should arrive in about 12 minutes. See you soon!"
```

### 3.3 Quote Delivery SMS

Sent to customer when a quote is ready for approval.

```typescript
export function quoteDeliverySMS(params: {
  customerFirstName: string;
  businessName: string;
  jobType: string;
  totalAmount: number;
  quoteUrl: string;        // short link to quote approval page
  expiryDays: number;      // typically 7
}): string {
  const amount = `$${params.totalAmount.toFixed(2)}`;
  return (
    `Hi ${params.customerFirstName}! Your quote from ${params.businessName} ` +
    `for ${params.jobType} is ready: ${amount}. ` +
    `View and approve here: ${params.quoteUrl} ` +
    `(expires in ${params.expiryDays} days)`
  );
}

// Example output (152 chars):
// "Hi Sarah! Your quote from Mike's Plumbing for drain clearing is ready: $185.00.
//  View and approve here: https://pay.pipeai.com/q/abc123 (expires in 7 days)"
```

### 3.4 Quote Follow-Up SMS (sent at 24 hours if not approved)

```typescript
export function quoteFollowUpSMS(params: {
  customerFirstName: string;
  businessName: string;
  jobType: string;
  totalAmount: number;
  quoteUrl: string;
}): string {
  const amount = `$${params.totalAmount.toFixed(2)}`;
  return (
    `Hi ${params.customerFirstName}, just checking in — your ${params.jobType} ` +
    `quote from ${params.businessName} for ${amount} is still available: ` +
    `${params.quoteUrl} — any questions just reply to this message.`
  );
}
```

### 3.5 Invoice Delivery SMS

Sent immediately when a job is marked complete.

```typescript
export function invoiceDeliverySMS(params: {
  customerFirstName: string;
  businessName: string;
  jobType: string;
  totalAmount: number;
  paymentUrl: string;     // Stripe payment link
}): string {
  const amount = `$${params.totalAmount.toFixed(2)}`;
  return (
    `Hi ${params.customerFirstName}! Thanks for choosing ${params.businessName}. ` +
    `Your invoice for ${params.jobType}: ${amount}. ` +
    `Pay securely here: ${params.paymentUrl}`
  );
}

// Example output (148 chars):
// "Hi Sarah! Thanks for choosing Mike's Plumbing. Your invoice for drain
//  clearing: $185.00. Pay securely here: https://pay.pipeai.com/i/xyz456"
```

### 3.6 Payment Reminder SMS — Sequence

Three escalating reminders. Tone shifts from friendly → firm → action-required.

```typescript
export function paymentReminderSMS(params: {
  customerFirstName: string;
  businessName: string;
  totalAmount: number;
  paymentUrl: string;
  daysPastDue: number;    // 3 | 7 | 14
}): string {
  const amount = `$${params.totalAmount.toFixed(2)}`;

  if (params.daysPastDue === 3) {
    // Friendly nudge
    return (
      `Hi ${params.customerFirstName}! Just a reminder — your invoice from ` +
      `${params.businessName} for ${amount} is still outstanding. ` +
      `Pay here: ${params.paymentUrl}`
    );
  }

  if (params.daysPastDue === 7) {
    // Firmer
    return (
      `Hi ${params.customerFirstName}, your invoice from ${params.businessName} ` +
      `for ${amount} is now 7 days overdue. Please pay at your earliest convenience: ` +
      `${params.paymentUrl}`
    );
  }

  // 14 days — escalate, offer to call
  return (
    `${params.customerFirstName}, your invoice from ${params.businessName} for ` +
    `${amount} is 14 days overdue. Please pay now: ${params.paymentUrl} ` +
    `or call us to discuss.`
  );
}
```

### 3.7 Post-Job Satisfaction Check-In SMS

Sent 2 hours after job is marked complete by tech.

```typescript
export function satisfactionCheckInSMS(params: {
  customerFirstName: string;
  techName: string;
  businessName: string;
  reviewUrl: string;     // Google Review link
}): string {
  return (
    `Hi ${params.customerFirstName}! Hope ${params.techName} sorted everything ` +
    `out for you today. If you have a moment, a Google review means the world ` +
    `to us: ${params.reviewUrl} — thank you!`
  );
}

// Note: Only send this if the invoice is paid OR job was under $200.
// Do not send if a complaint or callback has been flagged on this job.
```

### 3.8 Maintenance Plan Renewal SMS

Sent 30 days before plan expiry.

```typescript
export function maintenancePlanRenewalSMS(params: {
  customerFirstName: string;
  businessName: string;
  planName: string;        // e.g. "Annual Plumbing Health Check"
  renewalDate: string;     // e.g. "15 Apr"
  renewalPrice: number;
  renewalUrl: string;
}): string {
  const amount = `$${params.renewalPrice.toFixed(2)}`;
  return (
    `Hi ${params.customerFirstName}! Your ${params.planName} with ` +
    `${params.businessName} renews on ${params.renewalDate} for ${amount}. ` +
    `Renew or update here: ${params.renewalUrl}`
  );
}
```

### 3.9 Owner Emergency Alert SMS

Sent immediately when Intake Agent detects a critical emergency call.

```typescript
export function ownerEmergencyAlertSMS(params: {
  callerName: string;      // or "Unknown caller" if not provided
  callerPhone: string;
  address: string;         // or "Address not yet collected"
  issueDescription: string;
  callTime: string;        // e.g. "2:14am"
}): string {
  return (
    `🚨 EMERGENCY CALL — ${params.callTime}\n` +
    `Caller: ${params.callerName} (${params.callerPhone})\n` +
    `Address: ${params.address}\n` +
    `Issue: ${params.issueDescription}\n` +
    `Aria is on the line with them now.`
  );
}

// Note: This is a multi-part SMS — priority over character limit.
// Example:
// 🚨 EMERGENCY CALL — 2:14am
// Caller: Sarah Johnson (555-0199)
// Address: 45 Oak Ave, Austin TX
// Issue: Pipe burst in basement, water everywhere
// Aria is on the line with them now.
```

---

## 4. Tech Morning Briefing SMS

**File:** `/src/prompts/briefings.ts`  
**Sent:** 6:00am daily to each active technician with jobs scheduled that day.  
**Tone:** Clear, efficient, no fluff. Techs read this on their phone before leaving home.

### 4.1 Template

```typescript
export function techMorningBriefingSMS(params: {
  techFirstName: string;
  date: string;           // e.g. "Mon 17 Mar"
  jobs: Array<{
    scheduledTime: string;
    customerName: string;
    address: string;
    jobType: string;
    notes: string;
    isEmergency: boolean;
    upsellHint?: string;  // e.g. "water heater is 12 years old"
  }>;
  businessName: string;
}): string {
  const jobLines = params.jobs.map((job, i) => {
    const emergency = job.isEmergency ? ' 🚨' : '';
    const upsell = job.upsellHint ? `\n   💡 ${job.upsellHint}` : '';
    return (
      `${i + 1}. ${job.scheduledTime}${emergency} — ${job.customerName}\n` +
      `   ${job.address}\n` +
      `   ${job.jobType}${job.notes ? ': ' + job.notes : ''}` +
      upsell
    );
  }).join('\n\n');

  return (
    `Good morning ${params.techFirstName}! Here's your day for ${params.date}:\n\n` +
    `${jobLines}\n\n` +
    `${params.jobs.length} job${params.jobs.length !== 1 ? 's' : ''} total. ` +
    `Reply with any issues. Good luck today!`
  );
}

// Example output:
//
// Good morning Jake! Here's your day for Mon 17 Mar:
//
// 1. 9:00am — Sarah Johnson
//    45 Oak Ave, Austin TX
//    Drain clearing: kitchen sink slow drain
//    💡 Customer mentioned water pressure is low throughout house
//
// 2. 11:30am — Mike Torres
//    12 Pine St, Austin TX
//    Toilet replacement: customer supplying own toilet
//
// 3. 2:00pm 🚨 — Linda Park
//    89 Elm Rd, Austin TX
//    Burst pipe: pipe under kitchen sink
//
// 3 jobs total. Reply with any issues. Good luck today!
```

### 4.2 No-Jobs Variant

```typescript
export function techNoJobsSMS(params: {
  techFirstName: string;
  date: string;
  ownerFirstName: string;
}): string {
  return (
    `Morning ${params.techFirstName}! No jobs scheduled for you today (${params.date}). ` +
    `${params.ownerFirstName} will be in touch if anything comes in. Have a good one!`
  );
}
```

---

## 5. Owner Morning Briefing SMS

**File:** `/src/prompts/briefings.ts`  
**Sent:** 6:15am daily (15 min after tech briefings go out).  
**Tone:** Executive summary. Owner should be able to read it in 30 seconds.

### 5.1 Template

```typescript
export function ownerMorningBriefingSMS(params: {
  ownerFirstName: string;
  date: string;
  revenueYesterday: number;
  jobsYesterday: number;
  outstandingAR: number;         // total unpaid invoices
  overdueCount: number;          // invoices >7 days unpaid
  jobsToday: number;
  techsWorkingToday: number;
  emergenciesToday: number;
  oneActionItem: string;         // most important thing to do today
}): string {
  const yesterday = [
    `💰 Yesterday: $${params.revenueYesterday.toLocaleString()} across ${params.jobsYesterday} job${params.jobsYesterday !== 1 ? 's' : ''}`,
    params.outstandingAR > 0
      ? `📬 Outstanding AR: $${params.outstandingAR.toLocaleString()}${params.overdueCount > 0 ? ` (${params.overdueCount} overdue)` : ''}`
      : `✅ No outstanding invoices`,
  ].join('\n');

  const today = [
    `📅 Today: ${params.jobsToday} job${params.jobsToday !== 1 ? 's' : ''} across ${params.techsWorkingToday} tech${params.techsWorkingToday !== 1 ? 's' : ''}`,
    params.emergenciesToday > 0
      ? `🚨 ${params.emergenciesToday} emergency job${params.emergenciesToday !== 1 ? 's' : ''} in the schedule`
      : '',
  ].filter(Boolean).join('\n');

  return (
    `Good morning ${params.ownerFirstName}! Here's your ${params.date} briefing:\n\n` +
    `${yesterday}\n\n` +
    `${today}\n\n` +
    `👉 Action: ${params.oneActionItem}`
  );
}

// Example output:
//
// Good morning Mike! Here's your Mon 17 Mar briefing:
//
// 💰 Yesterday: $1,840 across 4 jobs
// 📬 Outstanding AR: $3,200 (2 overdue)
//
// 📅 Today: 9 jobs across 3 techs
// 🚨 1 emergency job in the schedule
//
// 👉 Action: Torres Residence ($1,200 invoice) is 14 days overdue — consider calling directly.
```

### 5.2 Action Item Logic

The `oneActionItem` field is generated by the Intelligence Agent each morning. Priority order:

```typescript
export function generateOwnerActionItem(data: BusinessDailyData): string {
  // Priority 1: Invoice overdue >14 days
  const longOverdue = data.invoices.filter(i => i.daysPastDue >= 14);
  if (longOverdue.length > 0) {
    const worst = longOverdue.sort((a, b) => b.amount - a.amount)[0];
    return `${worst.customerName} ($${worst.amount.toLocaleString()} invoice) is ${worst.daysPastDue} days overdue — consider calling directly.`;
  }

  // Priority 2: Emergency job in schedule with no tech confirmed
  const unconfirmedEmergency = data.todayJobs.find(j => j.isEmergency && !j.techConfirmed);
  if (unconfirmedEmergency) {
    return `Emergency job at ${unconfirmedEmergency.address} has no tech confirmation yet — check dispatch.`;
  }

  // Priority 3: Unapproved quotes >48 hours old
  const stalledQuotes = data.quotes.filter(q => q.hoursOld >= 48 && !q.approved);
  if (stalledQuotes.length > 0) {
    return `${stalledQuotes.length} quote${stalledQuotes.length > 1 ? 's' : ''} pending approval for 48+ hours — consider following up.`;
  }

  // Priority 4: Tech utilisation below 60% today
  const lowUtilTechs = data.techsToday.filter(t => t.scheduledMins / t.availableMins < 0.6);
  if (lowUtilTechs.length > 0) {
    return `${lowUtilTechs[0].name} has a light day — good time to schedule any pending callbacks or maintenance visits.`;
  }

  // Priority 5: No upsells closed yesterday
  if (data.yesterdayUpsellsClosed === 0 && data.yesterdayJobs >= 3) {
    return `No upsells closed yesterday across ${data.yesterdayJobs} jobs — worth reviewing upsell prompts with techs.`;
  }

  // Default: positive reinforcement
  return `Looking good — no urgent actions needed. Focus on delivering great work today.`;
}
```

### 5.3 Changelog
```
v1.0 — Initial version. Action item priority order based on product spec.
       Not yet tested on real business data.
```

---

## 6. Upsell Prompt Templates

**File:** `/src/prompts/messages.ts`  
**Delivered to:** Technician via mobile app job detail screen, before arrival.  
**Tone:** Helpful coaching, not pushy. Gives the tech a natural way to start the conversation.

### 6.1 Upsell Detection Logic

The Revenue Agent scans job notes and customer history for these triggers and selects the appropriate template:

```typescript
type UpsellTrigger =
  | 'old_water_heater'        // equipment age >10 years in notes
  | 'low_water_pressure'      // mentioned by customer during booking
  | 'slow_multiple_drains'    // pattern suggesting main line issue
  | 'old_toilet'              // toilet >15 years / running issues
  | 'corroded_fittings'       // visible in notes or history
  | 'no_shutoff_valves'       // noted in previous job
  | 'hard_water_signs'        // scale/buildup mentioned
  | 'no_maintenance_plan';    // customer not enrolled in any plan
```

### 6.2 Upsell Prompt Cards (shown in tech app)

```typescript
export const UPSELL_PROMPTS: Record<UpsellTrigger, string> = {

  old_water_heater:
    `💡 Upsell opportunity: The customer's water heater may be over 10 years old. ` +
    `If you see it on site, check the manufacture date on the label. ` +
    `Natural opener: "While I'm here, do you mind if I take a quick look at your ` +
    `water heater? At this age they can give out without much warning and ` +
    `a replacement is much simpler when it's planned."`,

  low_water_pressure:
    `💡 Upsell opportunity: Customer mentioned low water pressure during booking. ` +
    `Could indicate a PRV (pressure reducing valve) issue, scale buildup, or ` +
    `a main line problem. Natural opener: "I noticed you mentioned pressure issues — ` +
    `I can take a quick look at your PRV while I'm here. ` +
    `If that's the cause it's a straightforward fix."`,

  slow_multiple_drains:
    `💡 Upsell opportunity: Multiple slow drains often indicate a partial main ` +
    `line blockage rather than individual drain issues. ` +
    `Natural opener: "If you're finding it's not just this drain but others ` +
    `too, it might be worth a camera inspection of the main line — ` +
    `saves dealing with a full blockage later."`,

  old_toilet:
    `💡 Upsell opportunity: Older toilets (pre-2005) use 3.5–7 gallons per flush ` +
    `vs 1.28 gallons for modern ones. Customer is likely overpaying on water bills. ` +
    `Natural opener: "How old is this toilet roughly? Newer models use a fraction ` +
    `of the water — a lot of customers are surprised how quickly the savings add up."`,

  corroded_fittings:
    `💡 Upsell opportunity: Corrosion on visible fittings often means similar ` +
    `issues elsewhere in the line. Natural opener: "I can see some corrosion here — ` +
    `it might be worth a quick look at the other fittings while I'm under here. ` +
    `Catching it now avoids a bigger job down the road."`,

  no_shutoff_valves:
    `💡 Upsell opportunity: Previous job noted no isolation valves on fixtures. ` +
    `Without them, any repair requires shutting off the whole house. ` +
    `Natural opener: "I noticed last time there were no shutoff valves on these ` +
    `fixtures — adding them is a quick job and makes future repairs much simpler."`,

  hard_water_signs:
    `💡 Upsell opportunity: Scale buildup or white deposits indicate hard water ` +
    `which shortens appliance life significantly. ` +
    `Natural opener: "I can see some hard water buildup here — do you have a ` +
    `water softener? It makes a big difference to how long your appliances last."`,

  no_maintenance_plan:
    `💡 Upsell opportunity: This customer is not on a maintenance plan. ` +
    `After completing the job, mention the annual plan. ` +
    `Natural opener: "Everything's sorted — do you know about our annual ` +
    `plumbing health check? It catches small issues before they become ` +
    `expensive ones. A lot of our customers find it pays for itself."`,
};
```

---

## 7. Owner SMS Command Responses

**File:** `/src/prompts/messages.ts`  
**Used by:** Command Parser when owner texts PipeAI  
**Pattern:** Owner texts a natural language command → PipeAI acts + confirms

### 7.1 Command Confirmation Templates

```typescript
// After successfully rescheduling a job
export function rescheduleConfirmationSMS(params: {
  customerName: string;
  newDate: string;
  newTime: string;
  techName: string;
}): string {
  return (
    `Done — ${params.customerName}'s job rescheduled to ` +
    `${params.newDate} at ${params.newTime} with ${params.techName}. ` +
    `Customer has been notified.`
  );
}

// After adding a new flat rate to catalog
export function catalogUpdateConfirmationSMS(params: {
  jobType: string;
  price: number;
}): string {
  return (
    `Added: "${params.jobType}" at $${params.price.toFixed(2)} ` +
    `to your service catalog. I'll use this for future quotes.`
  );
}

// AR summary response
export function arSummaryResponseSMS(params: {
  totalOutstanding: number;
  invoiceCount: number;
  oldestDays: number;
  oldestCustomer: string;
  oldestAmount: number;
}): string {
  return (
    `Outstanding AR: $${params.totalOutstanding.toLocaleString()} ` +
    `across ${params.invoiceCount} invoice${params.invoiceCount !== 1 ? 's' : ''}. ` +
    `Oldest: ${params.oldestCustomer} ($${params.oldestAmount.toLocaleString()}, ` +
    `${params.oldestDays} days). Full list in your dashboard.`
  );
}

// When command is not understood
export function commandNotUnderstoodSMS(): string {
  return (
    `I didn't quite get that — I can help with: scheduling, AR summaries, ` +
    `adding prices, or rescheduling jobs. What do you need?`
  );
}
```

---

## 8. Email Templates

**File:** `/src/prompts/messages.ts`  
**Sent via:** Resend  
**Format:** Plain text with minimal HTML. Renders well on mobile.

### 8.1 Invoice Email

```typescript
export function invoiceEmailHTML(params: {
  customerFirstName: string;
  businessName: string;
  businessPhone: string;
  jobType: string;
  jobDate: string;
  techName: string;
  lineItems: Array<{ description: string; amount: number }>;
  subtotal: number;
  tax: number;
  total: number;
  paymentUrl: string;
  invoiceNumber: string;
}): { subject: string; html: string } {
  const lineItemsHTML = params.lineItems
    .map(li => `<tr><td>${li.description}</td><td align="right">$${li.amount.toFixed(2)}</td></tr>`)
    .join('');

  const subject = `Your invoice from ${params.businessName} — $${params.total.toFixed(2)}`;

  const html = `
<p>Hi ${params.customerFirstName},</p>

<p>Thank you for choosing ${params.businessName}. 
Here's your invoice for the work completed on ${params.jobDate} by ${params.techName}.</p>

<table width="100%" cellpadding="8" style="border-collapse:collapse;">
  <tr style="background:#f4f4f4;">
    <th align="left">Service</th>
    <th align="right">Amount</th>
  </tr>
  ${lineItemsHTML}
  <tr><td colspan="2"><hr/></td></tr>
  <tr><td>Subtotal</td><td align="right">$${params.subtotal.toFixed(2)}</td></tr>
  <tr><td>Tax</td><td align="right">$${params.tax.toFixed(2)}</td></tr>
  <tr style="font-weight:bold;">
    <td>Total Due</td>
    <td align="right">$${params.total.toFixed(2)}</td>
  </tr>
</table>

<p style="margin-top:24px;">
  <a href="${params.paymentUrl}" 
     style="background:#1A56A0;color:white;padding:12px 24px;
            text-decoration:none;border-radius:4px;display:inline-block;">
    Pay Now — $${params.total.toFixed(2)}
  </a>
</p>

<p style="color:#666;font-size:13px;">
  Invoice #${params.invoiceNumber} · Questions? Call us at ${params.businessPhone} 
  or reply to this email.
</p>
  `.trim();

  return { subject, html };
}
```

### 8.2 Quote Approval Email

```typescript
export function quoteEmailHTML(params: {
  customerFirstName: string;
  businessName: string;
  businessPhone: string;
  jobType: string;
  scheduledDate: string;
  lineItems: Array<{ description: string; amount: number }>;
  total: number;
  approvalUrl: string;
  expiryDate: string;
  quoteNumber: string;
}): { subject: string; html: string } {
  const lineItemsHTML = params.lineItems
    .map(li => `<tr><td>${li.description}</td><td align="right">$${li.amount.toFixed(2)}</td></tr>`)
    .join('');

  const subject = `Your quote from ${params.businessName} — $${params.total.toFixed(2)}`;

  const html = `
<p>Hi ${params.customerFirstName},</p>

<p>Here's your quote for <strong>${params.jobType}</strong> scheduled for 
${params.scheduledDate}. Review the details below and approve to confirm your booking.</p>

<table width="100%" cellpadding="8" style="border-collapse:collapse;">
  <tr style="background:#f4f4f4;">
    <th align="left">Service</th>
    <th align="right">Price</th>
  </tr>
  ${lineItemsHTML}
  <tr style="font-weight:bold;">
    <td>Total</td>
    <td align="right">$${params.total.toFixed(2)}</td>
  </tr>
</table>

<p style="font-size:13px;color:#666;">
  No work begins until you approve. There's no obligation to proceed.
</p>

<p style="margin-top:24px;">
  <a href="${params.approvalUrl}" 
     style="background:#1D7A4F;color:white;padding:12px 24px;
            text-decoration:none;border-radius:4px;display:inline-block;">
    Approve Quote — $${params.total.toFixed(2)}
  </a>
</p>

<p style="color:#666;font-size:13px;">
  Quote #${params.quoteNumber} · Valid until ${params.expiryDate} · 
  Questions? Call ${params.businessPhone}
</p>
  `.trim();

  return { subject, html };
}
```

---

## Changelog

```
v1.0 — March 2026
  Initial version covering all 8 placeholder categories:
  1. INTAKE_SYSTEM_PROMPT (static + dynamic context builder)
  2. Emergency keyword list and escalation logic
  3. QUOTE_BUILDER_PROMPT
  4. SMS templates (booking, en route, quote, invoice, reminders, reviews, alerts)
  5. Tech morning briefing SMS
  6. Owner morning briefing SMS + action item logic
  7. Upsell prompt cards (8 trigger types)
  8. Email templates (invoice + quote approval)

  Not yet tested on live calls or real jobs.
  First revision expected after Sprint 2 (first real calls answered).
```
