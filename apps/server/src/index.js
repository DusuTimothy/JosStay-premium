import app from "./app.js";
import {
  CLIENT_ORIGIN,
  DATA_BACKEND,
  NODE_ENV,
  PORT,
  USES_SUPABASE,
} from "./config/env.js";
import { db } from "./lib/supabase.js";

const start = async () => {
  if (USES_SUPABASE) {
    const { error } = await db().from("properties").select("id").limit(1);
    if (error) {
      console.error(
        `[startup] Supabase check failed: ${error.message}. Run the migrations and seed first.`,
      );
      process.exit(1);
    }
  }

  const server = app.listen(PORT, () => {
    console.log(`JosStay API running on http://localhost:${PORT}`);
    console.log(`CORS allowed origin: ${CLIENT_ORIGIN}`);
    console.log(
      USES_SUPABASE
        ? "Persistence: Supabase Postgres (service-role key kept server-side)."
        : "Persistence: in-memory demo data. Set DATA_BACKEND=supabase for Postgres.",
    );
  });

  const shutdown = (signal) => {
    console.log(`[shutdown] ${signal} received, closing server`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return server;
};

if (NODE_ENV !== "test") {
  if (!USES_SUPABASE) {
    console.warn(
      "[security] Demo backend is active. Do not use it in production; set DATA_BACKEND=supabase.",
    );
  }
  start().catch((error) => {
    console.error("[startup]", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

export default app;
