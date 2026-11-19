import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine(
    (value) => {
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    },
    { message: "Use a valid calendar date" },
  );

const guest = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().toLowerCase().email().max(254),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{7,32}$/, "Enter a valid phone number"),
  })
  .strict();

export const BookingSchema = z
  .object({
    propertySlug: z.string().trim().min(1).max(120),
    roomId: z.string().trim().min(1).max(60).optional(),
    checkIn: isoDate,
    checkOut: isoDate,
    guests: z.number().int().min(1).max(50),
    airportPickup: z.boolean().optional().default(false),
    paymentMethod: z.enum(["card", "bank", "ussd"]).default("card"),
    requests: z.string().trim().max(1000).optional(),
    guest,
  })
  .strict()
  .refine((data) => data.checkOut > data.checkIn, {
    message: "checkOut must be after checkIn",
    path: ["checkOut"],
  });

export const BookingReferenceSchema = z
  .string()
  .trim()
  .regex(/^JS-[A-Z0-9]{6}$/, "Invalid booking reference");

export const BookingListQuerySchema = z
  .object({
    status: z
      .enum(["upcoming", "confirmed", "completed", "cancelled", "no_show"])
      .optional(),
  })
  .strict();
