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
        emailVerified: Boolean(user.emailVerified ?? user.email_verified),
      }
    : null;

const mapAuthProfile = (row) =>
  row
    ? {
        id: row.id,
        email: row.email,
        passwordHash: row.password_hash ?? null,
        name: row.full_name,
        role: row.role,
        googleSub: row.google_sub ?? null,
        emailVerified: Boolean(row.email_verified),
      }
    : null;

export const findUserByEmail = async (email) => {
  const normalized = normalizeEmail(email);

  if (!isDatabaseEnabled) {
    return users.find((user) => user.email === normalized) ?? null;
  }

  try {
    const { rows } = await query(
      `select id, email, password_hash, full_name, role, google_sub, email_verified
       from public.profiles
       where lower(email) = lower($1)
       limit 1`,
      [normalized],
    );

    return mapAuthProfile(rows[0]);
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
      `select id, email, full_name, role, email_verified
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

export const findUserByGoogleSub = async (googleSub) => {
  if (!googleSub) return null;
  if (!isDatabaseEnabled) {
    return users.find((user) => user.googleSub === googleSub) ?? null;
  }

  try {
    const { rows } = await query(
      `select id, email, full_name, role, email_verified
       from public.profiles
       where google_sub = $1
       limit 1`,
      [googleSub],
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
      emailVerified: false,
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    return publicUser(user);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const { rows } = await query(
      `insert into public.profiles (email, password_hash, full_name, role, email_verified)
       values ($1, $2, $3, $4::public.user_role, false)
       returning id, email, full_name, role, email_verified`,
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

export const createOrLinkGoogleUser = async ({ email, name, googleSub }) => {
  if (!googleSub) throw new HttpError(400, "Google account identifier is required");
  const normalized = normalizeEmail(email);
  const fullName = name?.trim() || normalized.split("@")[0] || "Google User";

  if (!isDatabaseEnabled) {
    const bySub = users.find((user) => user.googleSub === googleSub);
    if (bySub) {
      bySub.emailVerified = true;
      return publicUser(bySub);
    }
    const byEmail = users.find((user) => user.email === normalized);
    if (byEmail) {
      byEmail.googleSub = byEmail.googleSub || googleSub;
      if (!byEmail.name && fullName) byEmail.name = fullName;
      // Google has already verified control of this inbox.
      byEmail.emailVerified = true;
      return publicUser(byEmail);
    }
    const nextId = users.reduce((max, user) => Math.max(max, Number(user.id) || 0), 0) + 1;
    const user = {
      id: nextId,
      name: fullName,
      email: normalized,
      passwordHash: null,
      role: "guest",
      googleSub,
      emailVerified: true,
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    return publicUser(user);
  }

  try {
    const bySub = await query(
      `select id, email, full_name, role, email_verified from public.profiles where google_sub = $1 limit 1`,
      [googleSub],
    );
    if (bySub.rows[0]) {
      const existing = bySub.rows[0];
      if (existing.email_verified) return mapProfile(existing);
      const verified = await query(
        `update public.profiles
         set email_verified = true,
             email_verified_at = coalesce(email_verified_at, now()),
             updated_at = now()
         where id = $1
         returning id, email, full_name, role, email_verified`,
        [existing.id],
      );
      return mapProfile(verified.rows[0] || existing);
    }

    const byEmail = await query(
      `select id, email, full_name, role, google_sub, email_verified from public.profiles where lower(email) = lower($1) limit 1`,
      [normalized],
    );
    if (byEmail.rows[0]) {
      const existing = byEmail.rows[0];
      if (existing.google_sub && existing.google_sub !== googleSub) {
        throw new HttpError(409, "This email is linked to a different Google account");
      }
      const linked = await query(
        `update public.profiles
         set google_sub = $2,
             full_name = case when coalesce(trim(full_name), '') = '' then $3 else full_name end,
             email_verified = true,
             email_verified_at = coalesce(email_verified_at, now()),
             updated_at = now()
         where id = $1
         returning id, email, full_name, role, email_verified`,
        [existing.id, googleSub, fullName],
      );
      return mapProfile(linked.rows[0]);
    }

    const created = await query(
      `insert into public.profiles (email, password_hash, full_name, role, google_sub, email_verified, email_verified_at)
       values ($1, null, $2, 'guest'::public.user_role, $3, true, now())
       returning id, email, full_name, role, email_verified`,
      [normalized, fullName, googleSub],
    );
    return mapProfile(created.rows[0]);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error?.code === "23505") {
      throw new HttpError(409, "Unable to link this Google account");
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