import { z } from "zod";

const reason = z.enum([
  "change_of_plans",
  "booking_cancelled",
  "duplicate_charge",
  "property_not_as_described",
  "host_cancelled",
  "payment_issue",
  "other",
]);

export const RefundRequestIdSchema = z.string().uuid("Invalid refund request id");

export const RefundRequestCreateSchema = z
  .object({
    reason,
    details: z.string().trim().max(1000).optional(),
  })
  .strict();

export const RefundReviewSchema = z
  .object({
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

export const RefundRejectSchema = z
  .object({
    note: z.string().trim().min(1, "A rejection note is required").max(1000),
  })
  .strict();

export const RefundMarkRefundedSchema = z
  .object({
    refundReference: z.string().trim().min(1).max(120),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();
