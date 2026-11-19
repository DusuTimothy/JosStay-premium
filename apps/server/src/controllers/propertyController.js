import { DATA_BACKEND } from "../config/env.js";
import { HttpError, asyncHandler } from "../lib/http.js";
import {
  getPropertyAvailability as loadAvailability,
  getPropertyContext,
  listProperties as loadProperties,
} from "../store/propertyStore.js";
import { PropertyQuerySchema } from "../validators/propertySchemas.js";

const sampleData = DATA_BACKEND === "demo";

export const listProperties = asyncHandler(async (req, res) => {
  const query = PropertyQuerySchema.parse(req.query);
  const results = await loadProperties(query);

  res.json({
    count: results.length,
    currency: "NGN",
    sampleData,
    data: results,
  });
});

export const getPropertyBySlug = asyncHandler(async (req, res) => {
  const context = await getPropertyContext(req.params.slug);
  if (!context) {
    throw new HttpError(404, "Property not found");
  }

  res.json({ data: context.property, sampleData });
});

export const getPropertyAvailability = asyncHandler(async (req, res) => {
  const availability = await loadAvailability(req.params.slug);
  if (!availability) {
    throw new HttpError(404, "Property not found");
  }

  res.json({ ...availability, sampleData: availability.sampleData ?? sampleData });
});
