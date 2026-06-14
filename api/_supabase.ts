import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

let supabase: any = null;
if (isSupabaseConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log("Supabase client initialized successfully.");
  } catch (error) {
    console.error("Supabase failed initialization:", error);
  }
}

export function getSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Database connection failed: Supabase credentials are not configured.");
  }
  return supabase;
}
