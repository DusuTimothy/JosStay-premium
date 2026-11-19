import "dotenv/config";

export const PORT = process.env.PORT || 4000;
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

export const corsOrigins = CLIENT_ORIGIN.split(",").map((o) => o.trim());
