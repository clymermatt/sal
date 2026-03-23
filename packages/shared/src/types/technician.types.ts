export type TechSkill =
  | "drain_clearing"
  | "water_heater"
  | "repiping"
  | "gas"
  | "sewer"
  | "fixture_install"
  | "leak_detection"
  | "backflow"
  | "general";

export interface Technician {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  skills: TechSkill[];
  base_lat: number | null;
  base_lng: number | null;
  is_active: boolean;
}
