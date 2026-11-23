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

const REDIS_CONNECT_TIMEOUT_MS = 5000;
const REDIS_MAX_RECONNECT_ATTEMPTS = 3;

const reconnectStrategy = (retries) => {
  if (retries > REDIS_MAX_RECONNECT_ATTEMPTS) {
    return new Error("Redis reconnect attempts exhausted");
  }
  return Math.min(retries * 250, 1000);
};

const buildSocketOptions = () => {
  const ca = readCaCert(REDIS_CA_CERT_PATH);
  const base = {
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    reconnectStrategy,
  };
  if (ca || isTlsUrl(REDIS_URL)) {
    return {
      ...base,
      tls: true,
      rejectUnauthorized: REDIS_TLS_REJECT_UNAUTHORIZED,
      ...(ca ? { ca } : {}),
    };
  }
  return base;
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
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Redis connection timed out after ${REDIS_CONNECT_TIMEOUT_MS}ms`)),
        REDIS_CONNECT_TIMEOUT_MS,
      );
      timer.unref?.();
    });

    connectPromise = Promise.race([redis.connect(), timeout])
      .catch((error) => {
        // Stop background reconnects so a dead/misconfigured Redis cannot
        // block process startup or keep retrying forever.
        try {
          redis.destroy();
        } catch {}
        throw error;
      })
      .finally(() => {
        if (timer) clearTimeout(timer);
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