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
    `Sal is on the line with them now.`
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

// --- Email Templates ---

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
    .join("");

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
    .join("");

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
  Quote #${params.quoteNumber} · Valid until ${params.expiryDate} · Questions? Call ${params.businessPhone}
  or reply to this email.
</p>
  `.trim();

  return { subject, html };
}
