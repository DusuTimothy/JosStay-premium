import { HttpError } from "../lib/http.js";
import { isDatabaseEnabled, query } from "../lib/postgres.js";

export const findHostByUserId = async (userId) => {
  if (!isDatabaseEnabled) return null;

  try {
    const { rows } = await query(
      `select id, name
       from public.hosts
       where user_id = $1::uuid
       limit 1`,
      [userId],
    );
    return rows[0] || null;
  } catch {
    throw new HttpError(503, "Host service is temporarily unavailable");
  }
};