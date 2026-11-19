import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "../config/env.js";
import { HttpError } from "../lib/http.js";
import { isDatabaseEnabled, query } from "../lib/postgres.js";
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

  if (!isDatabaseEnabled) {
    return users.find((user) => user.email === normalized) ?? null;
  }

  try {
    const { rows } = await query(
      `select id, email, password_hash, full_name, role
       from public.profiles
       where lower(email) = lower($1)
       limit 1`,
      [normalized],
    );

    const data = rows[0];
    return data
      ? {
          id: data.id,
          email: data.email,
          passwordHash: data.password_hash,
          name: data.full_name,
          role: data.role,
        }
      : null;
  } catch {
    throw new HttpError(503, "Account service is temporarily unavailable");
  }
};

export const findUserById = async (id) => {
  if (!isDatabaseEnabled) {
    return users.find((user) => String(user.id) === String(id)) ?? null;
  }

  try {
    const { rows } = await query(
      `select id, email, full_name, role
       from public.profiles
       where id = $1::uuid
       limit 1`,
      [id],
    );
    return mapProfile(rows[0] || null);
  } catch {
    throw new HttpError(503, "Account service is temporarily unavailable");
  }
};

export const createUser = async ({ name, email, password, role = "guest" }) => {
  if (!ROLES.has(role)) {
    throw new HttpError(400, "Invalid account role");
  }

  const normalized = normalizeEmail(email);
  const fullName = name?.trim() || normalized.split("@")[0];

  if (!isDatabaseEnabled) {
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

  try {
    const { rows } = await query(
      `insert into public.profiles (email, password_hash, full_name, role)
       values ($1, $2, $3, $4::public.user_role)
       returning id, email, full_name, role`,
      [normalized, passwordHash, fullName, role],
    );
    return mapProfile(rows[0]);
  } catch (error) {
    if (error?.code === "23505") {
      throw new HttpError(409, "Email already registered");
    }
    throw new HttpError(503, "Account service is temporarily unavailable");
  }
};

export const touchLastLogin = async (id) => {
  if (!isDatabaseEnabled) return;

  try {
    await query(
      `update public.profiles
       set last_login_at = now()
       where id = $1::uuid`,
      [id],
    );
  } catch {
    console.warn("[auth] Could not update last_login_at");
  }
};