export type PaymentStatus = "pending" | "sent" | "paid" | "overdue" | "void";

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id: string;
  business_id: string;
  job_id: string;
  customer_id: string;
  line_items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  payment_status: PaymentStatus;
  payment_link: string | null;
  invoiced_at: string;
  paid_at: string | null;
  created_at: string;
}

export interface Quote {
  id: string;
  business_id: string;
  job_id: string;
  customer_id: string;
  line_items: LineItem[];
  total: number;
  expires_at: string;
  approved_at: string | null;
  payment_link: string | null;
  created_at: string;
}
