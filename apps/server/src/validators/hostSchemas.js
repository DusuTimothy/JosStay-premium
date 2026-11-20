import { z } from "zod";

export const HostOnboardSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(32).optional(),
  type: z.string().trim().min(1).max(40).optional(),
  area: z.string().trim().min(1).max(80).optional(),
}).strict();

export const HostRegisterSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(72),
  phone: z.string().trim().min(7).max(32).optional(),
  type: z.string().trim().min(1).max(40).optional(),
  area: z.string().trim().min(1).max(80).optional(),
}).strict();

export const HostListingCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  type: z.string().trim().min(1).max(40),
  area: z.string().trim().min(1).max(80),
  price: z.coerce.number().int().min(5000).max(100000000),
  weekendPrice: z.coerce.number().int().min(5000).max(100000000).optional(),
  description: z.string().trim().max(2000).optional(),
  address: z.string().trim().max(240).optional(),
  photoCount: z.coerce.number().int().min(0).max(50).optional(),
  hasIdDocument: z.boolean().optional(),
  hasOwnershipDocument: z.boolean().optional(),
  idDocumentName: z.string().trim().max(200).optional(),
  ownershipDocumentName: z.string().trim().max(200).optional(),
  declaration: z.boolean().optional(),
}).strict();

export const HostListingPricingSchema = z.object({
  basePrice: z.coerce.number().int().min(1000).max(100000000).optional(),
  price: z.coerce.number().int().min(1000).max(100000000).optional(),
  weekendPrice: z.coerce.number().int().min(1000).max(100000000),
}).strict().refine((v) => v.basePrice != null || v.price != null, {
  message: "basePrice or price is required",
});

export const HostListingBlockSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  roomId: z.string().uuid().optional(),
  reason: z.string().trim().max(240).optional(),
}).strict();
