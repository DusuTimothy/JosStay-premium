import express from "express";
import cors from "cors";
import helmet from "helmet";
import { corsOrigins } from "./config/env.js";
import healthRoutes from "./routes/healthRoutes.js";
import metaRoutes from "./routes/metaRoutes.js";
import propertyRoutes from "./routes/propertyRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import hostRoutes from "./routes/hostRoutes.js";
import currencyRoutes from "./routes/currencyRoutes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandlers.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: "1mb" }));

app.use("/", healthRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/host", hostRoutes);
app.use("/api/currency", currencyRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
