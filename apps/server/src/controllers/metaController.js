import { AMENITIES } from "@josstay/shared";

export const getMeta = (_req, res) => {
  res.json({
    amenities: AMENITIES,
    areas: ["Jos North", "Jos South", "Rayfield", "Bukuru"],
    currency: { base: "NGN", usdRate: 1550 },
    sampleData: true,
  });
};
