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
import adminRoutes from "./routes/adminRoutes.js";
import currencyRoutes from "./routes/currencyRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import bundleRoutes from "./routes/bundleRoutes.js";
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
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id", "Idempotency-Key", "X-JosStay-Request"],
    exposedHeaders: ["X-Request-Id"],
    credentials: true,
    maxAge: 600,
  }),
);
app.use(
  express.json({
    limit: "100kb",
    strict: true,
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const cookieAuthUnsafePaths = new Set(["/api/auth/refresh", "/api/auth/logout"]);
app.use((req, _res, next) => {
  if (!unsafeMethods.has(req.method)) return next();
  // Allow webhook signature-verified endpoints (no browser cookies required) to be handled by route/controller.
  if (req.path === "/api/payments/paystack/webhook") return next();

  const origin = req.get("origin");
  if (origin && !corsOrigins.includes(origin)) {
    return next(new HttpError(403, "Origin not allowed"));
  }

  // CSRF hardening for cookie-authenticated unsafe endpoints (refresh/logout rely on HttpOnly refresh cookie).
  if (cookieAuthUnsafePaths.has(req.path)) {
    const requestedWith = req.get("x-josstay-request");
    if (requestedWith !== "1" && !origin) {
      return next(new HttpError(403, "Cross-site request blocked"));
    }
    // Browsers will include Origin for cross-origin requests; require it to be allowed when present.
    if (!origin && !requestedWith) {
      return next(new HttpError(403, "Cross-site request blocked"));
    }
  }

  // Non-browser clients may omit Origin for other endpoints; auth/validation checks still apply.
  return next();
});


app.use("/", healthRoutes);
app.use("/api", apiLimiter);
app.use("/api/meta", metaRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/host", hostRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/currency", currencyRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/bundle", bundleRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
