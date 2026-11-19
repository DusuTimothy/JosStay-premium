import { createClient } from "@supabase/supabase-js";
import {
  DATA_BACKEND,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "../config/env.js";

export const isSupabaseEnabled = DATA_BACKEND === "supabase";

export const supabase = isSupabaseEnabled
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        headers: { "X-Client-Info": "josstay-api/1.1" },
      },
    })
  : null;

export const db = () => {
  if (!supabase) {
    throw new Error("Supabase is not configured for this environment");
  }
  return supabase;
};
