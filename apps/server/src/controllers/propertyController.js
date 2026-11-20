import { quoteStay } from "@josstay/shared";
import { z } from "zod";
import { DATA_BACKEND } from "../config/env.js";
import { HttpError, asyncHandler } from "../lib/http.js";
import {
  getPropertyAvailability as loadAvailability,
  getPropertyContext,
  listProperties as loadProperties,
} from "../store/propertyStore.js";
import { PropertyQuerySchema } from "../validators/propertySchemas.js";

const QuoteQuerySchema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  roomId: z.string().trim().min(1).max(120).optional(),
  guests: z.coerce.number().int().min(1).max(12).default(1),
  airportPickup: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => value === true || value === "true" || value === "1"),
  bundle: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => value === true || value === "true" || value === "1"),
});

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

export const getPropertyQuote = asyncHandler(async (req, res) => {
  const query = QuoteQuerySchema.parse(req.query);
  const context = await getPropertyContext(req.params.slug);
  if (!context) {
    throw new HttpError(404, "Property not found");
  }

  const room = query.roomId
    ? context.rooms.find((candidate) => candidate.code === query.roomId)
    : context.rooms[0];

  if (query.roomId && !room) {
    throw new HttpError(400, "Select a valid room for this property");
  }

  const capacity = Math.min(
    Number(context.maxGuests) || room?.capacity || 1,
    Number(room?.capacity) || Number(context.maxGuests) || 1,
  );
  if (query.guests > capacity) {
    throw new HttpError(400, `This room sleeps up to ${capacity} guests`);
  }

  const quote = quoteStay(context.property, query.checkIn, query.checkOut, {
    roomId: room?.code,
    airportPickup: Boolean(query.airportPickup),
    bundleDiscount: Boolean(query.bundle),
  });

  res.json({
    data: {
      quote,
      property: {
        slug: context.property.slug,
        name: context.property.name,
        currency: "NGN",
      },
      room: room ? { code: room.code, name: context.property.rooms?.find((r) => r.id === room.code)?.name || room.code } : null,
    },
    sampleData,
  });
});
