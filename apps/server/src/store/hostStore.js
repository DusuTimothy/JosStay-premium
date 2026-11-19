import { HttpError } from "../lib/http.js";
import { db, isSupabaseEnabled } from "../lib/supabase.js";

export const findHostByUserId = async (userId) => {
  if (!isSupabaseEnabled) return null;

  const { data, error } = await db()
    .from("hosts")
    .select("id, name")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new HttpError(503, "Host service is temporarily unavailable");
  }

  return data;
};
