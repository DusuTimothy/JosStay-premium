import { asyncHandler } from "../lib/http.js";
import {
  approvePayoutRequest,
  getPayoutRequestDetail,
  listAdminPayoutRequests,
  markPayoutRequestPaid,
  rejectPayoutRequest,
} from "../store/payoutStore.js";
import {
  PayoutMarkPaidSchema,
  PayoutRejectSchema,
  PayoutReviewSchema,
} from "../validators/payoutSchemas.js";

export const getPayoutRequests = asyncHandler(async (req, res) => {
  const result = await listAdminPayoutRequests({
    status: req.query.status ? String(req.query.status) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json(result);
});

export const getPayoutRequest = asyncHandler(async (req, res) => {
  const result = await getPayoutRequestDetail(req.params.id);
  res.json(result);
});

export const approvePayout = asyncHandler(async (req, res) => {
  const payload = PayoutReviewSchema.parse(req.body || {});
  const result = await approvePayoutRequest({
    requestId: req.params.id,
    reviewerUserId: req.auth.userId,
    note: payload.note,
  });
  res.json({ data: result.data, sampleData: result.sampleData });
});

export const rejectPayout = asyncHandler(async (req, res) => {
  const payload = PayoutRejectSchema.parse(req.body || {});
  const result = await rejectPayoutRequest({
    requestId: req.params.id,
    reviewerUserId: req.auth.userId,
    note: payload.note,
  });
  res.json({ data: result.data, sampleData: result.sampleData });
});

export const markPayoutPaid = asyncHandler(async (req, res) => {
  const payload = PayoutMarkPaidSchema.parse(req.body || {});
  const result = await markPayoutRequestPaid({
    requestId: req.params.id,
    settledByUserId: req.auth.userId,
    providerReference: payload.providerReference,
    note: payload.note,
  });
  res.json({ data: result.data, sampleData: result.sampleData });
});
