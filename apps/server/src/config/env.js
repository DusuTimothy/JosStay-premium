import "dotenv/config";
import crypto from "node:crypto";
import { z } from "zod";

const RawEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_ORIGIN: z.string().optional().default("http://localhost:3000"),
  DATA_BACKEND: z.enum(["demo", "supabase"]).optional(),
  SUPABASE_URL: z.string().optional().default(""),
  SUPABASE_ANON_KEY: z.string().optional().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(""),
  JWT_SECRET: z.string().optional().default(""),
  JWT_EXPIRES_IN: z.string().optional().default("7d"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  API_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100000).default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1000).default(10),
});

const parsed = RawEnvSchema.safeParse(process.env);

if (!parsed.success) {
  const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`Invalid server environment: ${fields}`);
}

const raw = parsed.data;

export const NODE_ENV = raw.NODE_ENV;
export const IS_PRODUCTION = NODE_ENV === "production";
export const PORT = raw.PORT;

const clean = (value) => String(value || "").trim();

export const SUPABASE_URL = clean(raw.SUPABASE_URL).replace(/\/+$/, "");
export const SUPABASE_ANON_KEY = clean(raw.SUPABASE_ANON_KEY);
export const SUPABASE_SERVICE_ROLE_KEY = clean(raw.SUPABASE_SERVICE_ROLE_KEY);

const hasSupabaseCredentials = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const isHttpsSupabaseUrl = /^https:\/\/[a-z0-9.-]+$/i.test(SUPABASE_URL);
const isLocalSupabaseUrl =
  !IS_PRODUCTION &&
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d{2,5})?$/.test(SUPABASE_URL);

if (SUPABASE_URL && !isHttpsSupabaseUrl && !isLocalSupabaseUrl) {
  throw new Error(
    "SUPABASE_URL must be an https:// project URL (http://localhost is allowed in development)",
  );
}

if (raw.DATA_BACKEND === "supabase" && !hasSupabaseCredentials) {
  throw new Error(
    "DATA_BACKEND=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
  );
}

export const DATA_BACKEND =
  raw.DATA_BACKEND || (hasSupabaseCredentials ? "supabase" : "demo");

export const USES_SUPABASE = DATA_BACKEND === "supabase";

if (IS_PRODUCTION && !USES_SUPABASE) {
  throw new Error(
    "Production must use Supabase persistence. Set DATA_BACKEND=supabase, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
}

if (USES_SUPABASE && !hasSupabaseCredentials) {
  throw new Error("Supabase persistence is selected but credentials are missing");
}

const configuredJwtSecret = clean(raw.JWT_SECRET);

if (IS_PRODUCTION && configuredJwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production");
}

export const JWT_SECRET =
  configuredJwtSecret.length >= 32
    ? configuredJwtSecret
    : crypto.randomBytes(48).toString("base64url");

if (!configuredJwtSecret) {
  console.warn(
    "[security] JWT_SECRET is not set. Using an ephemeral development secret; tokens reset when the server restarts.",
  );
}

export const JWT_EXPIRES_IN = raw.JWT_EXPIRES_IN;
export const JWT_ISSUER = "josstay-api";
export const JWT_AUDIENCE = "josstay-client";
export const BCRYPT_ROUNDS = raw.BCRYPT_ROUNDS;

export const TRUST_PROXY = raw.TRUST_PROXY;
export const API_RATE_LIMIT_MAX = raw.API_RATE_LIMIT_MAX;
export const AUTH_RATE_LIMIT_MAX = raw.AUTH_RATE_LIMIT_MAX;

export const CLIENT_ORIGIN = clean(raw.CLIENT_ORIGIN) || "http://localhost:3000";
export const corsOrigins = CLIENT_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (IS_PRODUCTION && corsOrigins.includes("*")) {
  throw new Error("CLIENT_ORIGIN must not be a wildcard in production");
}

if (IS_PRODUCTION && TRUST_PROXY === 0) {
  console.warn(
    "[security] TRUST_PROXY is 0 in production. Set it to 1 if the API runs behind Render/a load balancer.",
  );
}
