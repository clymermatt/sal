import { getSupabase } from "../../db/client.js";
import { sendSMS } from "../../lib/twilio.js";
import { quoteFollowUpSMS } from "../../prompts/messages.js";
import { logger } from "../../lib/logger.js";

// Follow-up schedule: 24h, 72h, 7 days after quote sent
const FOLLOWUP_INTERVALS_HOURS = [24, 72, 168];

/**
 * Check for quotes needing follow-up and send reminders.
 * Should run on a schedule (e.g., every hour via BullMQ or cron).
 */
export async function processQuoteFollowups(): Promise<{
  checked: number;
  followed_up: number;
  expired: number;
}> {
  const supabase = getSupabase();
  const now = new Date();
  let followedUp = 0;
  let expired = 0;

  // Get all open/sent quotes that haven't been approved or expired
  const { data: quotes } = await supabase
    .from("quotes")
    .select(`
      id, business_id, customer_id, total, status, created_at,
      last_followup_at, followup_count, expires_at, job_id,
      customers!inner(name, phone),
      jobs(job_type)
    `)
    .in("status", ["open", "sent"])
    .lt("followup_count", FOLLOWUP_INTERVALS_HOURS.length);

  if (!quotes || quotes.length === 0) {
    return { checked: 0, followed_up: 0, expired: 0 };
  }

  for (const quote of quotes) {
    const createdAt = new Date(quote.created_at);
    const hoursSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    const expiresAt = new Date(quote.expires_at);

    // Check if quote has expired
    if (now > expiresAt) {
      await supabase
        .from("quotes")
        .update({ status: "expired" })
        .eq("id", quote.id);
      expired++;
      continue;
    }

    // Determine which follow-up we should be on
    const nextFollowupIndex = quote.followup_count;
    if (nextFollowupIndex >= FOLLOWUP_INTERVALS_HOURS.length) continue;

    const nextFollowupHours = FOLLOWUP_INTERVALS_HOURS[nextFollowupIndex];
    if (hoursSinceCreated < nextFollowupHours) continue;

    // Time to follow up
    const customer = quote.customers as unknown as { name: string; phone: string };
    const job = quote.jobs as unknown as { job_type: string } | null;

    if (!customer?.phone) continue;

    // Get business name
    const { data: business } = await supabase
      .from("businesses")
      .select("name")
      .eq("id", quote.business_id)
      .single();

    const smsBody = quoteFollowUpSMS({
      customerFirstName: customer.name.split(" ")[0],
      businessName: business?.name ?? "Your plumber",
      jobType: job?.job_type ?? "plumbing service",
      totalAmount: Number(quote.total),
      quoteUrl: `https://hiresal.com/quote/${quote.id}`,
    });

    const result = await sendSMS(customer.phone, smsBody);

    if (result.success) {
      await supabase
        .from("quotes")
        .update({
          followup_count: quote.followup_count + 1,
          last_followup_at: now.toISOString(),
          status: "sent", // move from open to sent on first contact
        })
        .eq("id", quote.id);

      followedUp++;

      logger.info(
        {
          quoteId: quote.id,
          followupNumber: quote.followup_count + 1,
          customerPhone: customer.phone,
        },
        "Quote follow-up SMS sent",
      );
    }
  }

  return { checked: quotes.length, followed_up: followedUp, expired };
}
