import Anthropic from "@anthropic-ai/sdk";
import type { ToolName } from "@pipeai/shared";
import { getSupabase } from "../db/client.js";
import { logger } from "../lib/logger.js";
import { sendSMS } from "../lib/twilio.js";
import { QUOTE_BUILDER_PROMPT } from "../prompts/quote.js";
import { quoteDeliverySMS, invoiceDeliverySMS } from "../prompts/messages.js";
import type { ToolDefinition } from "../orchestration/types.js";

export const createQuoteTool: ToolDefinition = {
  name: "create_quote" as ToolName,
  description:
    "Generate a quote for a job by matching work to the service catalog. Optionally sends the quote to the customer via SMS.",
  parameters: {
    type: "object" as const,
    properties: {
      customer_id: { type: "string", description: "Customer ID" },
      job_id: { type: "string", description: "Job ID (optional — for linking quote to existing job)" },
      job_type: { type: "string", description: "Type of plumbing work" },
      job_notes: { type: "string", description: "Additional details about the work needed" },
      send_to_customer: {
        type: "boolean",
        description: "Whether to send the quote to the customer via SMS (default true)",
      },
    },
    required: ["customer_id", "job_type"],
  },
  async execute(input, businessId) {
    const supabase = getSupabase();

    // Get active service catalog items only
    const { data: catalog } = await supabase
      .from("service_catalog")
      .select("id, job_type, flat_rate, duration_mins, category")
      .eq("business_id", businessId)
      .eq("is_active", true);

    if (!catalog || catalog.length === 0) {
      return { success: false, error: "No service catalog found for this business" };
    }

    // Get customer info
    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, phone")
      .eq("id", input.customer_id as string)
      .single();

    if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    // Get customer history for return-visit detection
    const { data: recentJobs } = await supabase
      .from("jobs")
      .select("job_type, scheduled_start")
      .eq("customer_id", customer.id)
      .order("scheduled_start", { ascending: false })
      .limit(5);

    const customerHistory = (recentJobs ?? [])
      .map((j) => `${j.job_type}, completed ${j.scheduled_start}`)
      .join("\n");

    // Call Claude to match work to catalog
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: QUOTE_BUILDER_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            `job_type: ${input.job_type}`,
            `job_notes: ${(input.job_notes as string) || "None"}`,
            `customer_history: ${customerHistory || "No previous jobs"}`,
            `service_catalog:\n${JSON.stringify(catalog, null, 2)}`,
          ].join("\n\n"),
        },
      ],
    });

    const responseText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let lineItems: Array<{
      serviceId: string;
      description: string;
      quantity: number;
      unitPrice: number | null;
      durationMins: number;
      notes?: string;
    }>;

    try {
      lineItems = JSON.parse(responseText);
    } catch {
      logger.error({ responseText }, "Failed to parse quote builder response");
      return { success: false, error: "Failed to generate quote — LLM returned invalid JSON" };
    }

    // Calculate total (skip CUSTOM items with null price)
    const total = lineItems.reduce(
      (sum, item) => sum + (item.unitPrice ?? 0) * (item.quantity ?? 1),
      0,
    );

    const hasCustomItems = lineItems.some((item) => item.serviceId === "CUSTOM");

    // Store quote in DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .insert({
        business_id: businessId,
        job_id: (input.job_id as string) || null,
        customer_id: customer.id,
        line_items: lineItems,
        total,
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();

    if (quoteError || !quote) {
      logger.error({ quoteError }, "Failed to store quote");
      return { success: false, error: "Failed to store quote" };
    }

    logger.info({ quoteId: quote.id, total, lineItemCount: lineItems.length }, "Quote created");

    // Send to customer via SMS if requested
    const shouldSend = (input.send_to_customer as boolean) !== false;
    let smsSent = false;

    if (shouldSend && customer.phone && !hasCustomItems) {
      const { data: business } = await supabase
        .from("businesses")
        .select("name")
        .eq("id", businessId)
        .single();

      const smsBody = quoteDeliverySMS({
        customerFirstName: customer.name.split(" ")[0],
        businessName: business?.name ?? "Your plumber",
        jobType: input.job_type as string,
        totalAmount: total,
        quoteUrl: `https://hiresal.com/quote/${quote.id}`, // TODO: build quote approval page
        expiryDays: 14,
      });

      const result = await sendSMS(customer.phone, smsBody);
      smsSent = result.success;
    }

    return {
      success: true,
      quote_id: quote.id,
      line_items: lineItems,
      total,
      expires_at: expiresAt.toISOString(),
      has_custom_items: hasCustomItems,
      sms_sent: smsSent,
      note: hasCustomItems
        ? "Quote contains custom items that need owner pricing before sending to customer"
        : undefined,
    };
  },
};

export const createInvoiceTool: ToolDefinition = {
  name: "create_invoice" as ToolName,
  description:
    "Generate an invoice for a completed job. Pulls line items from the job's quote or creates them from the job details.",
  parameters: {
    type: "object" as const,
    properties: {
      job_id: { type: "string", description: "ID of the completed job" },
      additional_notes: { type: "string", description: "Any additional notes for the invoice" },
    },
    required: ["job_id"],
  },
  async execute(input, businessId) {
    const supabase = getSupabase();

    // Get job details
    const { data: job } = await supabase
      .from("jobs")
      .select("id, customer_id, job_type, flat_rate, notes")
      .eq("id", input.job_id as string)
      .eq("business_id", businessId)
      .single();

    if (!job) {
      return { success: false, error: "Job not found" };
    }

    // Check if invoice already exists
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id")
      .eq("job_id", job.id)
      .single();

    if (existingInvoice) {
      return { success: false, error: "Invoice already exists for this job", invoice_id: existingInvoice.id };
    }

    // Try to pull line items from an approved quote
    const { data: quote } = await supabase
      .from("quotes")
      .select("line_items, total")
      .eq("job_id", job.id)
      .not("approved_at", "is", null)
      .single();

    let lineItems: unknown[];
    let subtotal: number;

    if (quote) {
      // Use approved quote line items
      lineItems = quote.line_items as unknown[];
      subtotal = Number(quote.total);
    } else {
      // Build from job details + service catalog
      const { data: catalogItem } = await supabase
        .from("service_catalog")
        .select("id, job_type, flat_rate, duration_mins")
        .eq("business_id", businessId)
        .eq("job_type", job.job_type)
        .single();

      if (catalogItem) {
        lineItems = [
          {
            serviceId: catalogItem.id,
            description: catalogItem.job_type,
            quantity: 1,
            unitPrice: Number(catalogItem.flat_rate),
          },
        ];
        subtotal = Number(catalogItem.flat_rate);
      } else {
        // Fallback: use job flat_rate if set
        const rate = Number(job.flat_rate) || 0;
        lineItems = [
          {
            serviceId: "manual",
            description: job.job_type,
            quantity: 1,
            unitPrice: rate,
          },
        ];
        subtotal = rate;
      }
    }

    // TODO: make tax rate configurable per business
    const taxRate = 0;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        business_id: businessId,
        job_id: job.id,
        customer_id: job.customer_id,
        line_items: lineItems,
        subtotal,
        tax,
        total,
        payment_status: "pending",
      })
      .select("id")
      .single();

    if (invoiceError || !invoice) {
      logger.error({ invoiceError }, "Failed to create invoice");
      return { success: false, error: "Failed to create invoice" };
    }

    logger.info({ invoiceId: invoice.id, jobId: job.id, total }, "Invoice created");

    return {
      success: true,
      invoice_id: invoice.id,
      job_id: job.id,
      line_items: lineItems,
      subtotal,
      tax,
      total,
    };
  },
};

export const sendPaymentRequestTool: ToolDefinition = {
  name: "send_payment_request" as ToolName,
  description:
    "Send a payment link to the customer for an invoice. Uses Stripe to generate a payment link and sends it via SMS.",
  parameters: {
    type: "object" as const,
    properties: {
      invoice_id: { type: "string", description: "ID of the invoice to request payment for" },
    },
    required: ["invoice_id"],
  },
  async execute(input, businessId) {
    const supabase = getSupabase();

    // Get invoice + customer details
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, customer_id, job_id, total, payment_status, payment_link")
      .eq("id", input.invoice_id as string)
      .eq("business_id", businessId)
      .single();

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    if (invoice.payment_status === "paid") {
      return { success: false, error: "Invoice is already paid" };
    }

    const { data: customer } = await supabase
      .from("customers")
      .select("name, phone")
      .eq("id", invoice.customer_id)
      .single();

    if (!customer || !customer.phone) {
      return { success: false, error: "Customer not found or has no phone number" };
    }

    const { data: job } = await supabase
      .from("jobs")
      .select("job_type")
      .eq("id", invoice.job_id)
      .single();

    // Generate payment link
    // TODO: Create real Stripe Checkout session / Payment Link
    // For now, use a placeholder URL that will be replaced with Stripe integration
    const paymentLink = invoice.payment_link ?? `https://hiresal.com/pay/${invoice.id}`;

    // Update invoice with payment link and status
    await supabase
      .from("invoices")
      .update({ payment_link: paymentLink, payment_status: "sent" })
      .eq("id", invoice.id);

    // Get business name for SMS
    const { data: business } = await supabase
      .from("businesses")
      .select("name")
      .eq("id", businessId)
      .single();

    // Send SMS
    const smsBody = invoiceDeliverySMS({
      customerFirstName: customer.name.split(" ")[0],
      businessName: business?.name ?? "Your plumber",
      jobType: job?.job_type ?? "plumbing service",
      totalAmount: Number(invoice.total),
      paymentUrl: paymentLink,
    });

    const smsResult = await sendSMS(customer.phone, smsBody);

    logger.info(
      { invoiceId: invoice.id, total: invoice.total, smsSent: smsResult.success },
      "Payment request sent",
    );

    return {
      success: true,
      invoice_id: invoice.id,
      payment_link: paymentLink,
      total: invoice.total,
      sms_sent: smsResult.success,
    };
  },
};

export const getArSummaryTool: ToolDefinition = {
  name: "get_ar_summary" as ToolName,
  description:
    "Get accounts receivable summary — total outstanding, overdue count, and breakdown by status.",
  parameters: {
    type: "object" as const,
    properties: {
      include_details: {
        type: "boolean",
        description: "Include individual invoice details (default false)",
      },
    },
    required: [],
  },
  async execute(input, businessId) {
    const supabase = getSupabase();

    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, customer_id, total, payment_status, invoiced_at, job_id")
      .eq("business_id", businessId)
      .in("payment_status", ["pending", "sent", "overdue"]);

    if (!invoices || invoices.length === 0) {
      return {
        total_outstanding: 0,
        invoice_count: 0,
        overdue_count: 0,
        breakdown: {},
        message: "No outstanding invoices",
      };
    }

    const now = new Date();
    let totalOutstanding = 0;
    let overdueCount = 0;
    const breakdown: Record<string, { count: number; total: number }> = {};

    for (const inv of invoices) {
      const amount = Number(inv.total);
      totalOutstanding += amount;

      // Check if overdue (more than 3 days since invoiced)
      const invoicedAt = new Date(inv.invoiced_at);
      const daysSince = Math.floor((now.getTime() - invoicedAt.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince > 3) overdueCount++;

      const status = inv.payment_status;
      if (!breakdown[status]) breakdown[status] = { count: 0, total: 0 };
      breakdown[status].count++;
      breakdown[status].total += amount;
    }

    const result: Record<string, unknown> = {
      total_outstanding: totalOutstanding,
      invoice_count: invoices.length,
      overdue_count: overdueCount,
      breakdown,
    };

    if (input.include_details) {
      // Enrich with customer names
      const customerIds = [...new Set(invoices.map((i) => i.customer_id))];
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name, phone")
        .in("id", customerIds);

      const customerMap = new Map((customers ?? []).map((c) => [c.id, c]));

      result.invoices = invoices.map((inv) => {
        const customer = customerMap.get(inv.customer_id);
        const invoicedAt = new Date(inv.invoiced_at);
        const daysSince = Math.floor((now.getTime() - invoicedAt.getTime()) / (1000 * 60 * 60 * 24));
        return {
          invoice_id: inv.id,
          customer_name: customer?.name ?? "Unknown",
          customer_phone: customer?.phone ?? "Unknown",
          total: inv.total,
          status: inv.payment_status,
          invoiced_at: inv.invoiced_at,
          days_outstanding: daysSince,
        };
      });
    }

    return result;
  },
};
