import { asyncHandler } from "../lib/http.js";
import {
  approveRefundRequest,
  listAdminRefundRequests,
  markRefundRequestRefunded,
  rejectRefundRequest,
} from "../store/refundStore.js";
import {
  RefundMarkRefundedSchema,
  RefundRejectSchema,
  RefundRequestIdSchema,
  RefundReviewSchema,
} from "../validators/refundSchemas.js";

export const getRefundRequests = asyncHandler(async (req, res) => {
  const result = await listAdminRefundRequests({
    status: req.query.status ? String(req.query.status) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json(result);
});

export const approveRefund = asyncHandler(async (req, res) => {
  const requestId = RefundRequestIdSchema.parse(req.params.id);
  const payload = RefundReviewSchema.parse(req.body || {});
  const result = await approveRefundRequest({
    requestId,
    reviewerUserId: req.auth.userId,
    note: payload.note,
  });
  res.json({ data: result.data, sampleData: result.sampleData });
});

export const rejectRefund = asyncHandler(async (req, res) => {
  const requestId = RefundRequestIdSchema.parse(req.params.id);
  const payload = RefundRejectSchema.parse(req.body || {});
  const result = await rejectRefundRequest({
    requestId,
    reviewerUserId: req.auth.userId,
    note: payload.note,
  });
  res.json({ data: result.data, sampleData: result.sampleData });
});

export const markRefundRefunded = asyncHandler(async (req, res) => {
  const requestId = RefundRequestIdSchema.parse(req.params.id);
  const payload = RefundMarkRefundedSchema.parse(req.body || {});
  const result = await markRefundRequestRefunded({
    requestId,
    refundedByUserId: req.auth.userId,
    refundReference: payload.refundReference,
    note: payload.note,
  });
  res.json({ data: result.data, sampleData: result.sampleData });
});
