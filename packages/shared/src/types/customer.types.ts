export interface Customer {
  id: string;
  business_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  lifetime_value: number;
  job_count: number;
  last_job_at: string | null;
  on_plan: boolean;
  created_at: string;
}
