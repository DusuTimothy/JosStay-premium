import fs from "node:fs";
import path from "node:path";
import { createClient } from "redis";
import {
  HAS_REDIS_CONFIG,
  REDIS_CA_CERT_PATH,
  REDIS_TLS_REJECT_UNAUTHORIZED,
  REDIS_URL,
} from "../config/env.js";

const readCaCert = (certPath) => {
  if (!certPath) return null;
  const resolved = path.isAbsolute(certPath)
    ? certPath
    : path.resolve(process.cwd(), certPath);
  return fs.readFileSync(resolved, "utf8");
};

const isTlsUrl = (url) => /^rediss:\/\//i.test(url || "");

const buildSocketOptions = () => {
  const ca = readCaCert(REDIS_CA_CERT_PATH);
  if (ca || isTlsUrl(REDIS_URL)) {
    return {
      tls: true,
      rejectUnauthorized: REDIS_TLS_REJECT_UNAUTHORIZED,
      ...(ca ? { ca } : {}),
    };
  }
  return undefined;
};

let client = null;

export const getRedisClient = () => {
  if (!HAS_REDIS_CONFIG) return null;
  if (client) return client;

  const socket = buildSocketOptions();
  client = createClient({
    url: REDIS_URL,
    ...(socket ? { socket } : {}),
  });

  client.on("error", (error) => {
    console.error("[redis] Client error:", error.message);
  });

  return client;
};

let connectPromise = null;

export const connectRedis = async () => {
  const redis = getRedisClient();
  if (!redis) return null;
  if (redis.isOpen) return redis;
  if (!connectPromise) {
    connectPromise = redis.connect().finally(() => {
      connectPromise = null;
    });
  }
  await connectPromise;
  return redis;
};

export const checkRedisConnection = async () => {
  if (!HAS_REDIS_CONFIG) {
    return { ok: false, configured: false, reason: "REDIS_URL is not configured" };
  }
  try {
    const redis = await connectRedis();
    if (!redis) {
      return { ok: false, configured: false, reason: "Redis client unavailable" };
    }
    await redis.ping();
    return { ok: true, configured: true };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};

export const closeRedis = async () => {
  if (client?.isOpen) {
    await client.quit();
  }
};