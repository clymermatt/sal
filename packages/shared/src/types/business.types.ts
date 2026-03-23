export interface BusinessHours {
  open: string; // "08:00"
  close: string; // "17:00"
}

export interface Business {
  id: string;
  name: string;
  phone: string | null;
  pipeai_number: string | null;
  owner_cell: string;
  owner_cell_backup: string | null;
  service_area_zips: string[];
  timezone: string;
  business_hours: Record<string, BusinessHours>;
  qbo_realm_id: string | null;
  stripe_account_id: string | null;
  plan: "solo" | "pro" | "growth";
  created_at: string;
}
