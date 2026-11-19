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

const buildPoolConfig = () => {
  const ssl = buildSslConfig();
  if (DATABASE_URL) {
    return {
      connectionString: DATABASE_URL,
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

export const checkDatabaseConnection = async () => {
  if (!pool) {
    return { ok: false, reason: "PostgreSQL is not configured" };
  }
  try {
    await pool.query("select 1 as ok");
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
};

export const closeDatabase = async () => {
  if (pool) await pool.end();
};

export const hasDatabaseConfig = HAS_DATABASE_CONFIG;