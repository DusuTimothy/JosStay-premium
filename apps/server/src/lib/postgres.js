import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import {
  DATABASE_CA_CERT_PATH,
  DATABASE_SSL_REJECT_UNAUTHORIZED,
  DATABASE_URL,
  HAS_DATABASE_CONFIG,
  IS_PRODUCTION,
  PGDATABASE,
  PGHOST,
  PGPASSWORD,
  PGPORT,
  PGUSER,
  USES_DATABASE,
} from "../config/env.js";

const { Pool } = pg;

export const isDatabaseEnabled = USES_DATABASE;

const readCaCert = (certPath) => {
  if (!certPath) return null;
  const resolved = path.isAbsolute(certPath)
    ? certPath
    : path.resolve(process.cwd(), certPath);
  return fs.readFileSync(resolved, "utf8");
};

const buildSslConfig = () => {
  if (!USES_DATABASE) return undefined;
  const ca = readCaCert(DATABASE_CA_CERT_PATH);
  if (ca) {
    return {
      ca,
      rejectUnauthorized: DATABASE_SSL_REJECT_UNAUTHORIZED,
    };
  }
  if (IS_PRODUCTION) {
    return { rejectUnauthorized: DATABASE_SSL_REJECT_UNAUTHORIZED };
  }
  return undefined;
};

const normalizeConnectionStringForSsl = (connectionString, ssl) => {
  if (!connectionString || !ssl) return connectionString;
  try {
    const url = new URL(connectionString);
    // When an explicit CA/SSL config is provided, let our ssl object be authoritative.
    url.searchParams.delete("sslmode");
    url.searchParams.delete("sslrootcert");
    url.searchParams.delete("sslcert");
    url.searchParams.delete("sslkey");
    url.searchParams.delete("sslpassword");
    url.searchParams.delete("uselibpqcompat");
    return url.toString();
  } catch {
    return connectionString;
  }
};

const buildPoolConfig = () => {
  const ssl = buildSslConfig();
  if (DATABASE_URL) {
    return {
      connectionString: normalizeConnectionStringForSsl(DATABASE_URL, ssl),
      ...(ssl ? { ssl } : {}),
    };
  }
  return {
    host: PGHOST || undefined,
    port: PGPORT || undefined,
    database: PGDATABASE || undefined,
    user: PGUSER || undefined,
    password: PGPASSWORD || undefined,
    ...(ssl ? { ssl } : {}),
  };
};

export const pool = isDatabaseEnabled ? new Pool(buildPoolConfig()) : null;

pool?.on("error", (error) => {
  console.error("[db] Unexpected PostgreSQL pool error:", error.message);
});

export const query = (text, params) => {
  if (!pool) {
    throw new Error("PostgreSQL is not configured for this environment");
  }
  return pool.query(text, params);
};

export const getClient = async () => {
  if (!pool) {
    throw new Error("PostgreSQL is not configured for this environment");
  }
  return pool.connect();
};

const formatErrorReason = (error) => {
  if (!(error instanceof Error)) return String(error);
  const parts = [error.message, error.code].filter(Boolean);
  if (Array.isArray(error.errors) && error.errors.length) {
    const inner = error.errors
      .map((entry) => (entry instanceof Error ? entry.message || entry.code : String(entry)))
      .filter(Boolean)
      .join("; ");
    if (inner) parts.push(inner);
  }
  return parts.join(" | ") || error.name || "Unknown database error";
};

export const checkDatabaseConnection = async () => {
  if (!pool) {
    return { ok: false, reason: "PostgreSQL is not configured" };
  }
  try {
    await pool.query("select 1 as ok");
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: formatErrorReason(error) };
  }
};

export const closeDatabase = async () => {
  if (pool) await pool.end();
};

export const hasDatabaseConfig = HAS_DATABASE_CONFIG;