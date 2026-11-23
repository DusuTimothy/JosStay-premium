import app from "./app.js";
import {
  CLIENT_ORIGIN,
  DATA_BACKEND,
  HAS_REDIS_CONFIG,
  NODE_ENV,
  PORT,
  USES_DATABASE,
} from "./config/env.js";
import {
  checkDatabaseConnection,
  checkRedisConnection,
  closeDatabase,
  closeRedis,
  connectRedis,
} from "./lib/db.js";
import { expireStalePendingBookings } from "./store/bookingStore.js";

const start = async () => {
  if (USES_DATABASE) {
    let dbCheck = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok) break;
      if (attempt < 3) {
        console.warn(
          `[startup] PostgreSQL check failed (attempt ${attempt}/3): ${dbCheck.reason}. Retrying...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    if (!dbCheck?.ok) {
      console.error(
        `[startup] PostgreSQL check failed: ${dbCheck?.reason}. Run migrations and verify connection/CA cert settings.`,
      );
      process.exit(1);
    }
  }

  const server = app.listen(PORT, () => {
    console.log(`JosStay API running on http://localhost:${PORT}`);
    console.log(`CORS allowed origin: ${CLIENT_ORIGIN}`);
    console.log(
      USES_DATABASE
        ? "Persistence: PostgreSQL (Aiven-compatible, TLS CA supported)."
        : "Persistence: in-memory demo data. Set DATA_BACKEND=postgres for PostgreSQL.",
    );
    if (HAS_REDIS_CONFIG) {
      console.log("Redis: configured.");
    }
  });

  const runExpirySweep = async (reason) => {
    try {
      const count = await expireStalePendingBookings();
      if (count > 0) {
        console.info(`[bookings] Expiry sweep (${reason}) expired ${count} reservation(s)`);
      }
    } catch (error) {
      console.warn(
        `[bookings] Expiry sweep (${reason}) failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };

  // Redis is optional. Connect in the background so a missing/dead Redis
  // cannot prevent the API from serving requests (and health checks).
  if (HAS_REDIS_CONFIG) {
    void (async () => {
      try {
        await connectRedis();
        const redisCheck = await checkRedisConnection();
        if (!redisCheck.ok) {
          console.warn(`[startup] Redis check failed: ${redisCheck.reason}`);
        } else {
          console.log("[startup] Redis connected.");
        }
      } catch (error) {
        console.warn(
          `[startup] Redis connection failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    })();
  }

  void runExpirySweep("startup");
  const expiryInterval = setInterval(() => {
    void runExpirySweep("interval");
  }, 5 * 60 * 1000);
  expiryInterval.unref?.();

  const shutdown = async (signal) => {
    console.log(`[shutdown] ${signal} received, closing server`);
    clearInterval(expiryInterval);
    server.close(async () => {
      await Promise.allSettled([closeDatabase(), closeRedis()]);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  return server;
};

if (NODE_ENV !== "test") {
  if (!USES_DATABASE) {
    console.warn(
      "[security] Demo backend is active. Do not use it in production; set DATA_BACKEND=postgres.",
    );
  }
  console.log(`[startup] Backend: ${DATA_BACKEND}`);
  start().catch((error) => {
    console.error("[startup]", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

export default app;
