import { DATA_BACKEND } from "../config/env.js";

export const getHealth = (_req, res) => {
  res.json({
    status: "ok",
    service: "josstay-api",
    version: "1.1.0",
    backend: DATA_BACKEND,
    sampleData: DATA_BACKEND === "demo",
    time: new Date().toISOString(),
  });
};
