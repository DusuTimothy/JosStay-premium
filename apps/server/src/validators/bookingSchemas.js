import { z } from "zod";

export const BookingSchema = z
  .object({
    propertySlug: z.string().min(1),
    roomId: z.string().optional(),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    guests: z.number().int().min(1).max(8),
    airportPickup: z.boolean().optional().default(false),
    paymentMethod: z.enum(["card", "bank", "ussd"]).default("card"),
    requests: z.string().max(500).optional(),
    guest: z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().min(10),
    }),
  })
  .refine((data) => data.checkOut > data.checkIn, {
    message: "checkOut must be after checkIn",
    path: ["checkOut"],
  });
