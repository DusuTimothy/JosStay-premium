import express from "express";
import cors from "cors";
import helmet from "helmet";
import {
  TRUST_PROXY,
  corsOrigins,
} from "./config/env.js";
import healthRoutes from "./routes/healthRoutes.js";
import metaRoutes from "./routes/metaRoutes.js";
import propertyRoutes from "./routes/propertyRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import hostRoutes from "./routes/hostRoutes.js";
import currencyRoutes from "./routes/currencyRoutes.js";
import { HttpError } from "./lib/http.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandlers.js";
import { apiLimiter, authLimiter } from "./middleware/rateLimit.js";
import { requestContext } from "./middleware/requestContext.js";

const app = express();

if (TRUST_PROXY > 0) {
  app.set("trust proxy", TRUST_PROXY);
}
app.disable("x-powered-by");

app.use(requestContext);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "no-referrer" },
  }),
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new HttpError(403, "Origin not allowed"));
    },
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
    credentials: false,
    maxAge: 600,
  }),
);
app.use(express.json({ limit: "100kb", strict: true }));

app.use("/", healthRoutes);
app.use("/api", apiLimiter);
app.use("/api/meta", metaRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/host", hostRoutes);
app.use("/api/currency", currencyRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
