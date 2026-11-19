import { z } from "zod";
import { AMENITIES } from "@josstay/shared";

const amenityIds = AMENITIES.map((amenity) => amenity.id);

const amenities = z
  .string()
  .optional()
  .default("")
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .refine((items) => items.every((item) => amenityIds.includes(item)), {
    message: "Unknown amenity",
  });

export const PropertyQuerySchema = z
  .object({
    destination: z.string().trim().max(80).optional().default(""),
    type: z
      .enum(["", "hotel", "apartment", "airbnb", "shortlet", "guesthouse"])
      .optional()
      .default(""),
    minPrice: z.coerce.number().int().min(0).max(100000000).optional().default(0),
    maxPrice: z.coerce
      .number()
      .int()
      .min(0)
      .max(100000000)
      .optional()
      .default(100000000),
    rating: z.coerce.number().min(0).max(5).optional().default(0),
    amenities,
    freeCancellation: z.enum(["true", "false"]).optional().default("false"),
    maxDistance: z.coerce.number().min(0).max(10000).optional().default(0),
    sort: z
      .enum(["recommended", "price-asc", "price-desc", "rating", "distance"])
      .optional()
      .default("recommended"),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).max(10000).optional().default(0),
  })
  .strict()
  .refine((data) => data.maxPrice >= data.minPrice, {
    message: "maxPrice must be greater than or equal to minPrice",
    path: ["maxPrice"],
  });
