// Morning briefing formatters — from PROMPTS.md sections 4 and 5

export function techMorningBriefingSMS(params: {
  techFirstName: string;
  date: string;
  jobs: Array<{
    scheduledTime: string;
    customerName: string;
    address: string;
    jobType: string;
    notes: string;
    isEmergency: boolean;
    upsellHint?: string;
  }>;
  businessName: string;
}): string {
  // Sort: emergencies first, then by scheduled time
  const sortedJobs = [...params.jobs].sort((a, b) => {
    if (a.isEmergency !== b.isEmergency) return a.isEmergency ? -1 : 1;
    return a.scheduledTime.localeCompare(b.scheduledTime);
  });

  const jobLines = sortedJobs
    .map((job, i) => {
      const emergency = job.isEmergency ? " 🚨" : "";
      const upsell = job.upsellHint ? `\n   💡 ${job.upsellHint}` : "";
      return (
        `${i + 1}. ${job.scheduledTime}${emergency} — ${job.customerName}\n` +
        `   ${job.address}\n` +
        `   ${job.jobType}${job.notes ? ": " + job.notes : ""}` +
        upsell
      );
    })
    .join("\n\n");

  return (
    `Good morning ${params.techFirstName}! Here's your day for ${params.date}:\n\n` +
    `${jobLines}\n\n` +
    `${params.jobs.length} job${params.jobs.length !== 1 ? "s" : ""} total. ` +
    `Reply with any issues. Good luck today!`
  );
}

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

export function ownerMorningBriefingSMS(params: {
  ownerFirstName: string;
  date: string;
  revenueYesterday: number;
  jobsYesterday: number;
  outstandingAR: number;
  overdueCount: number;
  jobsToday: number;
  techsWorkingToday: number;
  emergenciesToday: number;
  oneActionItem: string;
}): string {
  const yesterday = [
    `💰 Yesterday: $${params.revenueYesterday.toLocaleString()} across ${params.jobsYesterday} job${params.jobsYesterday !== 1 ? "s" : ""}`,
    params.outstandingAR > 0
      ? `📬 Outstanding AR: $${params.outstandingAR.toLocaleString()}${params.overdueCount > 0 ? ` (${params.overdueCount} overdue)` : ""}`
      : `✅ No outstanding invoices`,
  ].join("\n");

  const today = [
    `📅 Today: ${params.jobsToday} job${params.jobsToday !== 1 ? "s" : ""} across ${params.techsWorkingToday} tech${params.techsWorkingToday !== 1 ? "s" : ""}`,
    params.emergenciesToday > 0
      ? `🚨 ${params.emergenciesToday} emergency job${params.emergenciesToday !== 1 ? "s" : ""} in the schedule`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    `Good morning ${params.ownerFirstName}! Here's your ${params.date} briefing:\n\n` +
    `${yesterday}\n\n` +
    `${today}\n\n` +
    `👉 Action: ${params.oneActionItem}`
  );
}

export interface BusinessDailyData {
  invoices: Array<{ customerName: string; amount: number; daysPastDue: number }>;
  todayJobs: Array<{ address: string; isEmergency: boolean; techConfirmed: boolean }>;
  quotes: Array<{ hoursOld: number; approved: boolean }>;
  techsToday: Array<{ name: string; scheduledMins: number; availableMins: number }>;
  yesterdayUpsellsClosed: number;
  yesterdayJobs: number;
}

export function generateOwnerActionItem(data: BusinessDailyData): string {
  // Priority 1: Invoice overdue >14 days
  const longOverdue = data.invoices.filter((i) => i.daysPastDue >= 14);
  if (longOverdue.length > 0) {
    const worst = longOverdue.sort((a, b) => b.amount - a.amount)[0];
    return `${worst.customerName} ($${worst.amount.toLocaleString()} invoice) is ${worst.daysPastDue} days overdue — consider calling directly.`;
  }

  // Priority 2: Emergency job with no tech confirmed
  const unconfirmedEmergency = data.todayJobs.find(
    (j) => j.isEmergency && !j.techConfirmed,
  );
  if (unconfirmedEmergency) {
    return `Emergency job at ${unconfirmedEmergency.address} has no tech confirmation yet — check dispatch.`;
  }

  // Priority 3: Unapproved quotes >48 hours old
  const stalledQuotes = data.quotes.filter((q) => q.hoursOld >= 48 && !q.approved);
  if (stalledQuotes.length > 0) {
    return `${stalledQuotes.length} quote${stalledQuotes.length > 1 ? "s" : ""} pending approval for 48+ hours — consider following up.`;
  }

  // Priority 4: Tech utilisation below 60% — pick the lightest tech
  const lowUtilTechs = data.techsToday
    .filter((t) => t.scheduledMins / t.availableMins < 0.6)
    .sort((a, b) => a.scheduledMins / a.availableMins - b.scheduledMins / b.availableMins);
  if (lowUtilTechs.length > 0) {
    return `${lowUtilTechs[0].name} has a light day — good time to schedule any pending callbacks or maintenance visits.`;
  }

  // Priority 5: No upsells closed yesterday
  if (data.yesterdayUpsellsClosed === 0 && data.yesterdayJobs >= 3) {
    return `No upsells closed yesterday across ${data.yesterdayJobs} jobs — worth reviewing upsell prompts with techs.`;
  }

  // Default
  return `Looking good — no urgent actions needed. Focus on delivering great work today.`;
}
