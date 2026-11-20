import { z } from "zod";
import { asyncHandler, HttpError } from "../lib/http.js";
import { createUploadSignature, isCloudinaryConfigured } from "../lib/cloudinary.js";

const SignatureSchema = z.object({
  folder: z.string().trim().min(1).max(120).optional(),
  publicId: z.string().trim().min(1).max(180).optional(),
  resourceType: z.enum(["image", "video", "raw", "auto"]).default("image"),
  tags: z.string().trim().max(300).optional(),
});

export const getCloudinaryUploadSignature = asyncHandler(async (req, res) => {
  if (!isCloudinaryConfigured()) {
    throw new HttpError(503, "Upload service is not configured");
  }

  const payload = SignatureSchema.parse(req.body || {});
  const data = createUploadSignature({
    folder: payload.folder,
    publicId: payload.publicId,
    resourceType: payload.resourceType === "auto" ? "auto" : payload.resourceType,
    tags: payload.tags,
    timestamp: Math.floor(Date.now() / 1000),
  });

  res.json({ data, sampleData: false });
});

export const getUploadConfig = asyncHandler(async (_req, res) => {
  res.json({
    data: {
      cloudinary: {
        configured: isCloudinaryConfigured(),
      },
    },
  });
});
