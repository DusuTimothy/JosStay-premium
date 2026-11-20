import { AMENITIES, AREAS, PROPERTY_TYPES, USD_RATE } from "@josstay/shared";
import { DATA_BACKEND } from "../config/env.js";
import { BUNDLE_CONFIG } from "../lib/bundleConfig.js";
import { isCloudinaryConfigured } from "../lib/cloudinary.js";

export const getMeta = (_req, res) => {
  const payload = {
    amenities: AMENITIES,
    areas: AREAS,
    propertyTypes: PROPERTY_TYPES,
    currency: { base: "NGN", usdRate: USD_RATE },
    bundle: BUNDLE_CONFIG,
    uploads: {
      cloudinary: {
        configured: isCloudinaryConfigured(),
      },
    },
  };

  res.json({
    ...payload,
    data: payload,
    backend: DATA_BACKEND,
    sampleData: DATA_BACKEND === "demo",
  });
};
