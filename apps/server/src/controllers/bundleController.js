import { quoteStay } from "@josstay/shared";
import { z } from "zod";
import { asyncHandler, HttpError } from "../lib/http.js";
import { BUNDLE_CONFIG } from "../lib/bundleConfig.js";
import { getPropertyContext } from "../store/propertyStore.js";
import { DATA_BACKEND } from "../config/env.js";

const BundleQuoteSchema = z.object({
  propertySlug: z.string().trim().min(1),
  originId: z.string().trim().min(1),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  roomId: z.string().trim().min(1).max(120).optional(),
  guests: z.coerce.number().int().min(1).max(12).default(2),
  passengers: z.coerce.number().int().min(1).max(8).default(1),
  airportPickup: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => value === true || value === "true" || value === "1"),
});

export const getBundleConfig = asyncHandler(async (_req, res) => {
  res.json({ data: BUNDLE_CONFIG, sampleData: DATA_BACKEND === "demo" });
});

export const getBundleQuote = asyncHandler(async (req, res) => {
  const payload = BundleQuoteSchema.parse(req.body || {});
  const origin = BUNDLE_CONFIG.origins.find((item) => item.id === payload.originId);
  if (!origin) {
    throw new HttpError(400, "Select a valid departure city");
  }

  const context = await getPropertyContext(payload.propertySlug);
  if (!context) {
    throw new HttpError(404, "Property not found");
  }

  const room = payload.roomId
    ? context.rooms.find((candidate) => candidate.code === payload.roomId)
    : context.rooms[0];

  if (payload.roomId && !room) {
    throw new HttpError(400, "Select a valid room for this property");
  }

  const quote = quoteStay(context.property, payload.checkIn, payload.checkOut, {
    roomId: room?.code,
    airportPickup: Boolean(payload.airportPickup),
    bundleDiscount: true,
  });

  const flightTotal = origin.fare * payload.passengers;
  const stayTotal = quote.total;
  const savings = quote.discount || 0;
  const total = flightTotal + stayTotal;

  res.json({
    data: {
      origin,
      destination: BUNDLE_CONFIG.destination,
      property: {
        slug: context.property.slug,
        name: context.property.name,
        area: context.property.area,
        type: context.property.type,
        verified: Boolean(context.property.verified),
        freeCancellation: Boolean(context.property.freeCancellation),
        image: context.property.images?.[0] || null,
      },
      room: room ? { code: room.code, name: context.property.rooms?.find((r) => r.id === room.code)?.name || room.code } : null,
      quote,
      flight: {
        passengers: payload.passengers,
        farePerPassenger: origin.fare,
        total: flightTotal,
      },
      totals: {
        flight: flightTotal,
        stay: stayTotal,
        savings,
        total,
      },
      currency: "NGN",
    },
    sampleData: DATA_BACKEND === "demo",
  });
});
