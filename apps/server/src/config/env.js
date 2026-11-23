import "dotenv/config";
import crypto from "node:crypto";
import { z } from "zod";

const RawEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_ORIGIN: z.string().optional().default("http://localhost:3000"),
  DATA_BACKEND: z.enum(["demo", "postgres", "supabase"]).optional(),

  // Aiven / PostgreSQL
  DATABASE_URL: z.string().optional().default(""),
  PGHOST: z.string().optional().default(""),
  PGPORT: z.coerce.number().int().min(1).max(65535).optional(),
  PGDATABASE: z.string().optional().default(""),
  PGUSER: z.string().optional().default(""),
  PGPASSWORD: z.string().optional().default(""),
  DATABASE_CA_CERT_PATH: z.string().optional().default(""),
  DATABASE_SSL_REJECT_UNAUTHORIZED: z.string().optional().default(""),
  DB_FORCE_IPV4: z.string().optional().default(""),

  // Redis (Aiven)
  REDIS_URL: z.string().optional().default(""),
  REDIS_CA_CERT_PATH: z.string().optional().default(""),
  REDIS_TLS_REJECT_UNAUTHORIZED: z.string().optional().default(""),

  // Integrations
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: z.string().optional().default(""),
  PAYSTACK_SECRET_KEY: z.string().optional().default(""),
  BREVO_API_KEY: z.string().optional().default(""),
  BREVO_SENDER_EMAIL: z.string().optional().default(""),
  BREVO_SENDER_NAME: z.string().optional().default(""),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),
  CLOUDINARY_URL: z.string().optional().default(""),

  JWT_SECRET: z.string().optional().default(""),
  JWT_EXPIRES_IN: z.string().optional().default(""),
  ACCESS_TOKEN_EXPIRES_IN: z.string().optional().default(""),
  REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  REFRESH_TOKEN_COOKIE_NAME: z.string().optional().default("josstay_refresh"),
  AUTH_COOKIE_SECURE: z.string().optional().default(""),
  AUTH_COOKIE_SAMESITE: z.enum(["lax", "strict", "none", ""]).optional().default(""),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  API_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100000).default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1000).default(10),
  EMAIL_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1000).default(5),
  EMAIL_VERIFICATION_TTL_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .max(10080)
    .default(1440),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
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
const cleanBool = (value, fallback = true) => {
  const text = clean(value).toLowerCase();
  if (!text) return fallback;
  if (["1", "true", "yes", "on"].includes(text)) return true;
  if (["0", "false", "no", "off"].includes(text)) return false;
  return fallback;
};

export const DATABASE_URL = clean(raw.DATABASE_URL);
export const PGHOST = clean(raw.PGHOST);
export const PGPORT = raw.PGPORT;
export const PGDATABASE = clean(raw.PGDATABASE);
export const PGUSER = clean(raw.PGUSER);
export const PGPASSWORD = raw.PGPASSWORD;
export const DATABASE_CA_CERT_PATH = clean(raw.DATABASE_CA_CERT_PATH);
export const DATABASE_SSL_REJECT_UNAUTHORIZED = cleanBool(
  raw.DATABASE_SSL_REJECT_UNAUTHORIZED,
  true,
);
export const DB_FORCE_IPV4 = cleanBool(raw.DB_FORCE_IPV4, false);

export const REDIS_URL = clean(raw.REDIS_URL);
export const REDIS_CA_CERT_PATH = clean(raw.REDIS_CA_CERT_PATH);
export const REDIS_TLS_REJECT_UNAUTHORIZED = cleanBool(
  raw.REDIS_TLS_REJECT_UNAUTHORIZED,
  true,
);

const hasDatabaseConfig = Boolean(
  DATABASE_URL || (PGHOST && PGDATABASE && PGUSER),
);

const backendInput = raw.DATA_BACKEND === "supabase" ? "postgres" : raw.DATA_BACKEND;
export const DATA_BACKEND = backendInput || (hasDatabaseConfig ? "postgres" : "demo");
export const USES_DATABASE = DATA_BACKEND === "postgres";
export const HAS_DATABASE_CONFIG = hasDatabaseConfig;
export const HAS_REDIS_CONFIG = Boolean(REDIS_URL);



if (raw.DATA_BACKEND === "postgres" && !hasDatabaseConfig) {
  throw new Error(
    "DATA_BACKEND=postgres requires DATABASE_URL or PGHOST/PGDATABASE/PGUSER (and password/cert as needed)",
  );
}

if (IS_PRODUCTION && !USES_DATABASE) {
  throw new Error(
    "Production must use Postgres persistence. Set DATA_BACKEND=postgres and database connection variables.",
  );
}

if (IS_PRODUCTION && !hasDatabaseConfig) {
  throw new Error("Production requires PostgreSQL connection configuration");
}

if (IS_PRODUCTION && !HAS_REDIS_CONFIG) {
  console.warn(
    "[startup] REDIS_URL is not set in production. Redis-backed features/caching will be unavailable until configured.",
  );
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

const configuredAccessTokenExpiresIn =
  clean(raw.ACCESS_TOKEN_EXPIRES_IN) || clean(raw.JWT_EXPIRES_IN);

export const ACCESS_TOKEN_EXPIRES_IN =
  configuredAccessTokenExpiresIn || (IS_PRODUCTION ? "15m" : "7d");
// Backward-compatible export; prefer ACCESS_TOKEN_EXPIRES_IN for new code.
export const JWT_EXPIRES_IN = ACCESS_TOKEN_EXPIRES_IN;
export const JWT_ISSUER = "josstay-api";
export const JWT_AUDIENCE = "josstay-client";

export const REFRESH_TOKEN_EXPIRES_IN_DAYS = raw.REFRESH_TOKEN_EXPIRES_IN_DAYS;
export const REFRESH_TOKEN_COOKIE_NAME = clean(raw.REFRESH_TOKEN_COOKIE_NAME) || "josstay_refresh";
export const AUTH_COOKIE_SECURE = clean(raw.AUTH_COOKIE_SECURE)
  ? cleanBool(raw.AUTH_COOKIE_SECURE, IS_PRODUCTION)
  : IS_PRODUCTION;
const configuredSameSite = clean(raw.AUTH_COOKIE_SAMESITE).toLowerCase();
export const AUTH_COOKIE_SAMESITE =
  configuredSameSite === "lax" || configuredSameSite === "strict" || configuredSameSite === "none"
    ? configuredSameSite
    : (IS_PRODUCTION ? "none" : "lax");

export const GOOGLE_CLIENT_ID = clean(raw.GOOGLE_CLIENT_ID);

export const PAYSTACK_SECRET_KEY = clean(raw.PAYSTACK_SECRET_KEY);
export const PAYSTACK_PUBLIC_KEY = clean(raw.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY);

export const BREVO_API_KEY = clean(raw.BREVO_API_KEY);
export const BREVO_SENDER_EMAIL = clean(raw.BREVO_SENDER_EMAIL);
export const BREVO_SENDER_NAME = clean(raw.BREVO_SENDER_NAME) || "JosStay";

export const CLOUDINARY_CLOUD_NAME = clean(raw.CLOUDINARY_CLOUD_NAME);
export const CLOUDINARY_API_KEY = clean(raw.CLOUDINARY_API_KEY);
export const CLOUDINARY_API_SECRET = clean(raw.CLOUDINARY_API_SECRET);
export const CLOUDINARY_URL = clean(raw.CLOUDINARY_URL);

export const BCRYPT_ROUNDS = raw.BCRYPT_ROUNDS;

export const TRUST_PROXY = raw.TRUST_PROXY;
export const API_RATE_LIMIT_MAX = raw.API_RATE_LIMIT_MAX;
export const AUTH_RATE_LIMIT_MAX = raw.AUTH_RATE_LIMIT_MAX;
export const EMAIL_RATE_LIMIT_MAX = raw.EMAIL_RATE_LIMIT_MAX;
export const EMAIL_VERIFICATION_TTL_MINUTES = raw.EMAIL_VERIFICATION_TTL_MINUTES;
export const PASSWORD_RESET_TTL_MINUTES = raw.PASSWORD_RESET_TTL_MINUTES;

export const CLIENT_ORIGIN = clean(raw.CLIENT_ORIGIN) || "http://localhost:3000";
export const corsOrigins = CLIENT_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (IS_PRODUCTION && corsOrigins.includes("*")) {
  throw new Error("CLIENT_ORIGIN must not be a wildcard in production");
}

if (IS_PRODUCTION && TRUST_PROXY === 0) {
  console.warn(
    "[security] TRUST_PROXY is 0 in production. Set it to 1 if the API runs behind a load balancer.",
  );
}
