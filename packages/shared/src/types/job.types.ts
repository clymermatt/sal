import type { TechSkill } from "./technician.types.js";

export type JobStatus =
  | "booked"
  | "en_route"
  | "in_progress"
  | "complete"
  | "cancelled";

export interface Job {
  id: string;
  business_id: string;
  customer_id: string;
  tech_id: string | null;
  status: JobStatus;
  job_type: string;
  required_skills: TechSkill[];
  address: string;
  lat: number | null;
  lng: number | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  estimated_mins: number | null;
  is_emergency: boolean;
  notes: string | null;
  flat_rate: number | null;
  created_at: string;
}
