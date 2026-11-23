import crypto from "node:crypto";
import {
  EMAIL_VERIFICATION_TTL_MINUTES,
  PASSWORD_RESET_TTL_MINUTES,
} from "../config/env.js";
import { getClient, isDatabaseEnabled, query } from "../lib/postgres.js";
import { users } from "./demoStore.js";

export const AUTH_TOKEN_PURPOSES = Object.freeze({
  EMAIL_VERIFICATION: "email_verification",
  PASSWORD_RESET: "password_reset",
});

const TTL_MINUTES = {
  [AUTH_TOKEN_PURPOSES.EMAIL_VERIFICATION]: EMAIL_VERIFICATION_TTL_MINUTES,
  [AUTH_TOKEN_PURPOSES.PASSWORD_RESET]: PASSWORD_RESET_TTL_MINUTES,
};

// Prevent email-bombing a single address even when the caller rotates IPs.
const MIN_ISSUE_INTERVAL_SECONDS = 60;

const generateAuthToken = () => crypto.randomBytes(32).toString("base64url");

export const hashAuthToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

// Non-database demo mode keeps tokens in memory for local parity.
const demoTokens = new Map();

const requestMeta = (req) => ({
  ipAddress: req?.ip || null,
  userAgent: req?.get?.("user-agent")?.slice(0, 500) || null,
});

const isValidPurpose = (purpose) => Object.values(AUTH_TOKEN_PURPOSES).includes(purpose);

/**
 * Issue a single-use token for the given purpose.
 * Returns { token, expiresAt, ttlMinutes } or { token: null, throttled: true }.
 * Issuing a new token invalidates any previously active token for that purpose.
 */
export const issueAuthToken = async ({ userId, purpose, req }) => {
  if (!isValidPurpose(purpose)) {
    throw new Error(`Unsupported auth token purpose: ${purpose}`);
  }

  const ttlMinutes = TTL_MINUTES[purpose];
  const token = generateAuthToken();
  const tokenHash = hashAuthToken(token);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  const meta = requestMeta(req);

  if (!isDatabaseEnabled) {
    const now = Date.now();
    for (const [hash, record] of demoTokens) {
      if (record.userId !== userId || record.purpose !== purpose) continue;
      if (record.usedAt || record.expiresAt <= now) continue;
      if (record.createdAt > now - MIN_ISSUE_INTERVAL_SECONDS * 1000) {
        return { token: null, throttled: true };
      }
      record.usedAt = now;
    }

    demoTokens.set(tokenHash, {
      userId,
      purpose,
      expiresAt: expiresAt.getTime(),
      usedAt: null,
      createdAt: now,
    });

    return { token, expiresAt, ttlMinutes };
  }

  const client = await getClient();
  try {
    await client.query("begin");

    const recent = await client.query(
      `select 1
       from public.auth_tokens
       where user_id = $1::uuid
         and purpose = $2
         and used_at is null
         and expires_at > now()
         and created_at > now() - ($3::int * interval '1 second')
       limit 1`,
      [userId, purpose, MIN_ISSUE_INTERVAL_SECONDS],
    );

    if (recent.rows.length) {
      await client.query("rollback");
      return { token: null, throttled: true };
    }

    await client.query(
      `update public.auth_tokens
       set used_at = now()
       where user_id = $1::uuid
         and purpose = $2
         and used_at is null`,
      [userId, purpose],
    );

    await client.query(
      `insert into public.auth_tokens
         (user_id, purpose, token_hash, expires_at, requested_ip, user_agent)
       values ($1::uuid, $2, $3, $4, $5, $6)`,
      [userId, purpose, tokenHash, expiresAt.toISOString(), meta.ipAddress, meta.userAgent],
    );

    await client.query("commit");
    return { token, expiresAt, ttlMinutes };
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {}
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Atomically consume a token. Returns the owning user id, or null when the
 * token is missing, expired, already used, or issued for a different purpose.
 */
export const consumeAuthToken = async ({ token, purpose }) => {
  if (!token || !isValidPurpose(purpose)) return null;

  const tokenHash = hashAuthToken(token);

  if (!isDatabaseEnabled) {
    const record = demoTokens.get(tokenHash);
    if (
      !record ||
      record.purpose !== purpose ||
      record.usedAt ||
      record.expiresAt <= Date.now()
    ) {
      return null;
    }
    record.usedAt = Date.now();
    return record.userId;
  }

  const client = await getClient();
  try {
    await client.query("begin");

    const { rows } = await client.query(
      `select id, user_id
       from public.auth_tokens
       where token_hash = $1
         and purpose = $2
         and used_at is null
         and expires_at > now()
       for update`,
      [tokenHash, purpose],
    );

    const row = rows[0];
    if (!row) {
      await client.query("rollback");
      return null;
    }

    await client.query(
      `update public.auth_tokens set used_at = now() where id = $1::uuid`,
      [row.id],
    );

    await client.query("commit");
    return row.user_id;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {}
    throw error;
  } finally {
    client.release();
  }
};

export const markEmailVerified = async (userId) => {
  if (!isDatabaseEnabled) {
    const user = users.find((entry) => String(entry.id) === String(userId));
    if (user) user.emailVerified = true;
    return;
  }

  await query(
    `update public.profiles
     set email_verified = true,
         email_verified_at = coalesce(email_verified_at, now())
     where id = $1::uuid`,
    [userId],
  );
};

export const updateUserPassword = async (userId, passwordHash) => {
  if (!isDatabaseEnabled) {
    const user = users.find((entry) => String(entry.id) === String(userId));
    if (user) {
      user.passwordHash = passwordHash;
      user.emailVerified = true;
    }
    return;
  }

  // A successful reset proves control of the inbox, so the email is verified too.
  await query(
    `update public.profiles
     set password_hash = $2,
         password_updated_at = now(),
         email_verified = true,
         email_verified_at = coalesce(email_verified_at, now())
     where id = $1::uuid`,
    [userId, passwordHash],
  );
};
