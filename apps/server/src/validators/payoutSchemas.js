import { z } from "zod";

export const PayoutRequestCreateSchema = z
  .object({
    amount: z.coerce.number().int().min(1000).max(100000000),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const PayoutMethodCreateSchema = z
  .object({
    bankCode: z.string().trim().min(1).max(12),
    bankName: z.string().trim().min(1).max(120).optional(),
    accountNumber: z
      .string()
      .trim()
      .regex(/^\d{10}$/, "Enter a 10-digit account number"),
  })
  .strict();

export const PayoutReviewSchema = z
  .object({
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const PayoutRejectSchema = z
  .object({
    note: z.string().trim().min(1, "A rejection note is required").max(500),
  })
  .strict();

export const PayoutMarkPaidSchema = z
  .object({
    providerReference: z.string().trim().min(1).max(120),
    note: z.string().trim().max(500).optional(),
  })
  .strict();
