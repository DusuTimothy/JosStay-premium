import { z } from "zod";

const HttpsUrlSchema = z.string().trim().url().max(2048).refine((v) => v.startsWith("https://"), {
  message: "URL must use https",
});

const ListingImageSchema = z.object({
  url: HttpsUrlSchema,
  alt: z.string().trim().max(160).optional(),
  position: z.coerce.number().int().min(0).max(100).optional(),
  publicId: z.string().trim().max(240).optional(),
  resourceType: z.string().trim().max(40).optional(),
}).strict();

const VerificationDocumentSchema = z.object({
  documentType: z.enum(["government_id", "proof_of_ownership", "property_photo", "other"]),
  fileName: z.string().trim().max(200).optional(),
  fileUrl: HttpsUrlSchema.optional(),
  mimeType: z.string().trim().max(120).optional(),
  publicId: z.string().trim().max(240).optional(),
  status: z.enum(["submitted", "pending_review", "approved", "rejected"]).optional(),
  notes: z.string().trim().max(1000).optional(),
}).strict();

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
  images: z.array(ListingImageSchema).max(30).optional(),
  documents: z.array(VerificationDocumentSchema).max(20).optional(),
  submitForReview: z.boolean().optional(),
}).strict();

export const HostListingUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  type: z.string().trim().min(1).max(40).optional(),
  area: z.string().trim().min(1).max(80).optional(),
  price: z.coerce.number().int().min(5000).max(100000000).optional(),
  weekendPrice: z.coerce.number().int().min(5000).max(100000000).optional(),
  description: z.string().trim().max(2000).optional(),
  address: z.string().trim().max(240).optional(),
  images: z.array(ListingImageSchema).max(30).optional(),
  documents: z.array(VerificationDocumentSchema).max(20).optional(),
}).strict();

export const HostListingSubmitSchema = z.object({
  declaration: z.boolean().optional(),
}).strict().optional();

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
