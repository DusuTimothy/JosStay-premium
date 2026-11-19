import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "../config/env.js";
import { HttpError } from "../lib/http.js";
import { db, isSupabaseEnabled } from "../lib/supabase.js";
import { users } from "./demoStore.js";
import { mapProfile } from "./mappers.js";

const ROLES = new Set(["guest", "host", "admin"]);
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

export const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "josstay-invalid-password",
  BCRYPT_ROUNDS,
);

export const publicUser = (user) =>
  user
    ? {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    : null;

export const findUserByEmail = async (email) => {
  const normalized = normalizeEmail(email);

  if (!isSupabaseEnabled) {
    return users.find((user) => user.email === normalized) ?? null;
  }

  const { data, error } = await db()
    .from("profiles")
    .select("id, email, password_hash, full_name, role")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    throw new HttpError(503, "Account service is temporarily unavailable");
  }

  return data
    ? {
        id: data.id,
        email: data.email,
        passwordHash: data.password_hash,
        name: data.full_name,
        role: data.role,
      }
    : null;
};

export const findUserById = async (id) => {
  if (!isSupabaseEnabled) {
    return users.find((user) => String(user.id) === String(id)) ?? null;
  }

  const { data, error } = await db()
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new HttpError(503, "Account service is temporarily unavailable");
  }

  return mapProfile(data);
};

export const createUser = async ({ name, email, password, role = "guest" }) => {
  if (!ROLES.has(role)) {
    throw new HttpError(400, "Invalid account role");
  }

  const normalized = normalizeEmail(email);
  const fullName = name?.trim() || normalized.split("@")[0];

  if (!isSupabaseEnabled) {
    if (users.some((user) => user.email === normalized)) {
      throw new HttpError(409, "Email already registered");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const nextId = users.reduce((max, user) => Math.max(max, Number(user.id) || 0), 0) + 1;
    const user = {
      id: nextId,
      name: fullName,
      email: normalized,
      passwordHash,
      role,
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    return publicUser(user);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const { data, error } = await db()
    .from("profiles")
    .insert({
      email: normalized,
      password_hash: passwordHash,
      full_name: fullName,
      role,
    })
    .select("id, email, full_name, role")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new HttpError(409, "Email already registered");
    }
    throw new HttpError(503, "Account service is temporarily unavailable");
  }

  return mapProfile(data);
};

export const touchLastLogin = async (id) => {
  if (!isSupabaseEnabled) return;

  const { error } = await db()
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.warn("[auth] Could not update last_login_at");
  }
};
