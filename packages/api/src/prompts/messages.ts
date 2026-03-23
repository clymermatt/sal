// SMS Templates — all kept under 160 chars where possible

export function bookingConfirmationSMS(params: {
  customerFirstName: string;
  businessName: string;
  jobType: string;
  scheduledDate: string;
  scheduledTime: string;
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

export function techEnRouteSMS(params: {
  customerFirstName: string;
  techName: string;
  etaMinutes: number;
}): string {
  const eta =
    params.etaMinutes <= 5
      ? "a few minutes"
      : `about ${params.etaMinutes} minutes`;

  return (
    `Hi ${params.customerFirstName}! ${params.techName} is on the way ` +
    `and should arrive in ${eta}. See you soon!`
  );
}

export function quoteDeliverySMS(params: {
  customerFirstName: string;
  businessName: string;
  jobType: string;
  totalAmount: number;
  quoteUrl: string;
  expiryDays: number;
}): string {
  const amount = `$${params.totalAmount.toFixed(2)}`;
  return (
    `Hi ${params.customerFirstName}! Your quote from ${params.businessName} ` +
    `for ${params.jobType} is ready: ${amount}. ` +
    `View and approve here: ${params.quoteUrl} ` +
    `(expires in ${params.expiryDays} days)`
  );
}

export function invoiceDeliverySMS(params: {
  customerFirstName: string;
  businessName: string;
  jobType: string;
  totalAmount: number;
  paymentUrl: string;
}): string {
  const amount = `$${params.totalAmount.toFixed(2)}`;
  return (
    `Hi ${params.customerFirstName}! Thanks for choosing ${params.businessName}. ` +
    `Your invoice for ${params.jobType}: ${amount}. ` +
    `Pay securely here: ${params.paymentUrl}`
  );
}

export function paymentReminderSMS(params: {
  customerFirstName: string;
  businessName: string;
  totalAmount: number;
  paymentUrl: string;
  daysPastDue: number;
}): string {
  const amount = `$${params.totalAmount.toFixed(2)}`;

  if (params.daysPastDue === 3) {
    return (
      `Hi ${params.customerFirstName}! Just a reminder — your invoice from ` +
      `${params.businessName} for ${amount} is still outstanding. ` +
      `Pay here: ${params.paymentUrl}`
    );
  }

  if (params.daysPastDue === 7) {
    return (
      `Hi ${params.customerFirstName}, your invoice from ${params.businessName} ` +
      `for ${amount} is now 7 days overdue. Please pay at your earliest convenience: ` +
      `${params.paymentUrl}`
    );
  }

  return (
    `${params.customerFirstName}, your invoice from ${params.businessName} for ` +
    `${amount} is 14 days overdue. Please pay now: ${params.paymentUrl} ` +
    `or call us to discuss.`
  );
}

export function satisfactionCheckInSMS(params: {
  customerFirstName: string;
  techName: string;
  businessName: string;
  reviewUrl: string;
}): string {
  return (
    `Hi ${params.customerFirstName}! Hope ${params.techName} sorted everything ` +
    `out for you today. If you have a moment, a Google review means the world ` +
    `to us: ${params.reviewUrl} — thank you!`
  );
}

export function ownerEmergencyAlertSMS(params: {
  callerName: string;
  callerPhone: string;
  address: string;
  issueDescription: string;
  callTime: string;
}): string {
  return (
    `🚨 EMERGENCY CALL — ${params.callTime}\n` +
    `Caller: ${params.callerName} (${params.callerPhone})\n` +
    `Address: ${params.address}\n` +
    `Issue: ${params.issueDescription}\n` +
    `Aria is on the line with them now.`
  );
}

export function maintenancePlanRenewalSMS(params: {
  customerFirstName: string;
  businessName: string;
  planName: string;
  renewalDate: string;
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
