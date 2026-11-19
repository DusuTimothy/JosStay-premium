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

const start = async () => {
  if (USES_DATABASE) {
    const dbCheck = await checkDatabaseConnection();
    if (!dbCheck.ok) {
      console.error(
        `[startup] PostgreSQL check failed: ${dbCheck.reason}. Run migrations and verify connection/CA cert settings.`,
      );
      process.exit(1);
    }
  }

  if (HAS_REDIS_CONFIG) {
    try {
      await connectRedis();
      const redisCheck = await checkRedisConnection();
      if (!redisCheck.ok) {
        console.warn(`[startup] Redis check failed: ${redisCheck.reason}`);
      }
    } catch (error) {
      console.warn(
        `[startup] Redis connection failed: ${error instanceof Error ? error.message : String(error)}`,
      );
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

  const shutdown = async (signal) => {
    console.log(`[shutdown] ${signal} received, closing server`);
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
