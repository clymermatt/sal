import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../config.js";

let supabase: SupabaseClient;

export function initSupabase(config: Env): SupabaseClient {
  supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
  return supabase;
}

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error("Supabase client not initialized. Call initSupabase first.");
  }
  return supabase;
}
