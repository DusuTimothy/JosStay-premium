import crypto from "node:crypto";
import {
  AUTH_COOKIE_SAMESITE,
  AUTH_COOKIE_SECURE,
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_EXPIRES_IN_DAYS,
} from "../config/env.js";
import { getClient, isDatabaseEnabled, query } from "./db.js";
import { HttpError } from "./http.js";

const REFRESH_COOKIE_PATH = "/api/auth";

const parseCookies = (header) => {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
};

export const getRefreshTokenFromRequest = (req) => {
  const cookies = parseCookies(req.headers?.cookie);
  const token = cookies[REFRESH_TOKEN_COOKIE_NAME];
  return token ? String(token) : null;
};

export const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

export const generateRefreshToken = () => crypto.randomBytes(48).toString("base64url");

const refreshExpiryDate = () =>
  new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

const requestMeta = (req) => ({
  userAgent: req?.get?.("user-agent")?.slice(0, 500) || null,
  ipAddress: req?.ip || null,
});

export const createRefreshSession = async ({ userId, req }) => {
  const token = generateRefreshToken();
  const tokenHash = hashToken(token);
  const expiresAt = refreshExpiryDate();

  if (!isDatabaseEnabled) {
    // Demo/non-DB mode cannot persist refresh sessions; access-token-only flow applies.
    return { token: null, expiresAt: null };
  }

  const meta = requestMeta(req);
  await query(
    `insert into public.refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
     values ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, expiresAt.toISOString(), meta.userAgent, meta.ipAddress],
  );

  return { token, expiresAt };
};

export const rotateRefreshSession = async ({ token, req }) => {
  if (!token) throw new HttpError(401, "Authentication required");
  if (!isDatabaseEnabled) throw new HttpError(503, "Session service is unavailable");

  const tokenHash = hashToken(token);
  const meta = requestMeta(req);
  const { rows } = await query(
    `select id, user_id, expires_at, revoked_at
     from public.refresh_tokens
     where token_hash = $1
     limit 1`,
    [tokenHash],
  );

  const row = rows[0];
  if (!row) throw new HttpError(401, "Invalid or expired session");
  if (row.revoked_at) throw new HttpError(401, "Session has been revoked");
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw new HttpError(401, "Session has expired");
  }

  const nextToken = generateRefreshToken();
  const nextHash = hashToken(nextToken);
  const nextExpiresAt = refreshExpiryDate();

  const client = await getClient();
  try {
    await client.query("begin");

    const { rows: updated } = await client.query(
      `update public.refresh_tokens
       set revoked_at = now(),
           replaced_by_token_hash = $2,
           last_used_at = now()
       where id = $1 and revoked_at is null
       returning id`,
      [row.id, nextHash],
    );

    if (!updated.length) {
      throw new HttpError(401, "Session is no longer valid");
    }

    await client.query(
      `insert into public.refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
       values ($1, $2, $3, $4, $5)`,
      [row.user_id, nextHash, nextExpiresAt.toISOString(), meta.userAgent, meta.ipAddress],
    );

    await client.query("commit");
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {}
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "Session service is temporarily unavailable");
  } finally {
    client.release();
  }

  return { userId: row.user_id, token: nextToken, expiresAt: nextExpiresAt };
};

export const revokeRefreshSession = async (token) => {
  if (!token || !isDatabaseEnabled) return;
  const tokenHash = hashToken(token);
  try {
    await query(
      `update public.refresh_tokens
       set revoked_at = now(), last_used_at = now()
       where token_hash = $1 and revoked_at is null`,
      [tokenHash],
    );
  } catch {
    // Best-effort revoke; caller may still clear cookie.
  }
};

export const refreshCookieOptions = (expiresAt) => ({
  httpOnly: true,
  secure: AUTH_COOKIE_SECURE,
  sameSite: AUTH_COOKIE_SAMESITE,
  path: REFRESH_COOKIE_PATH,
  expires: expiresAt instanceof Date ? expiresAt : undefined,
});

export const setRefreshCookie = (res, token, expiresAt) => {
  if (!token) return;
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, refreshCookieOptions(expiresAt));
};

export const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    ...refreshCookieOptions(undefined),
    expires: new Date(0),
  });
};
