import { asyncHandler } from "../lib/http.js";
import {
  listRefundReviewPayments,
  resolveRefundReviewPayment,
} from "../store/paymentStore.js";

export const getRefundReviewPayments = asyncHandler(async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const result = await listRefundReviewPayments({ status, limit });
  res.json(result);
});

export const resolveRefundReview = asyncHandler(async (req, res) => {
  const { note } = req.body || {};
  const result = await resolveRefundReviewPayment({
    paymentReference: req.params.reference,
    resolvedByUserId: req.auth?.userId,
    note,
  });
  res.json(result);
});
