import { AMENITIES } from "@josstay/shared";
import { DATA_BACKEND } from "../config/env.js";

export const getMeta = (_req, res) => {
  res.json({
    amenities: AMENITIES,
    areas: ["Jos North", "Jos South", "Rayfield", "Bukuru"],
    currency: { base: "NGN", usdRate: 1550 },
    backend: DATA_BACKEND,
    sampleData: DATA_BACKEND === "demo",
  });
};
