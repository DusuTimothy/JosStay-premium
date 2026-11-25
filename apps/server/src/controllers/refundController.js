import { HttpError, asyncHandler } from "../lib/http.js";
import {
  beginIdempotency,
  completeIdempotency,
  failIdempotency,
  getIdempotencyKey,
  hashIdempotencyPayload,
} from "../lib/idempotency.js";
import { isDatabaseEnabled } from "../lib/postgres.js";
import {
  cancelRefundRequest,
  createRefundRequest,
  getRefundRequestForBooking,
} from "../store/refundStore.js";
import { BookingReferenceSchema } from "../validators/bookingSchemas.js";
import { RefundRequestCreateSchema } from "../validators/refundSchemas.js";

export const getBookingRefundRequest = asyncHandler(async (req, res) => {
  const reference = BookingReferenceSchema.parse(req.params.reference);
  const result = await getRefundRequestForBooking({
    auth: req.auth,
    bookingReference: reference,
  });
  res.json(result);
});

export const createBookingRefundRequest = asyncHandler(async (req, res) => {
  const reference = BookingReferenceSchema.parse(req.params.reference);
  const payload = RefundRequestCreateSchema.parse(req.body || {});
  const scope = `user:${req.auth.userId}:booking:${reference}:refund-request`;
  const idempotencyKey = getIdempotencyKey(req);
  const requestHash = hashIdempotencyPayload(payload);

  let idem = { type: "skipped" };
  if (isDatabaseEnabled) {
    if (!idempotencyKey) {
      throw new HttpError(400, "Idempotency-Key header is required for refund requests");
    }
    idem = await beginIdempotency({
      scope,
      key: idempotencyKey,
      operation: "booking.refund.request",
      requestHash,
    });
    if (idem.type === "replay") {
      return res.status(idem.status || 200).json(idem.body);
    }
  }

  try {
    const result = await createRefundRequest({
      auth: req.auth,
      bookingReference: reference,
      reason: payload.reason,
      details: payload.details,
    });
    const body = { data: result.data, sampleData: result.sampleData };
    if (idem.type === "claimed") {
      await completeIdempotency({ scope, key: idempotencyKey, status: 201, body });
    }
    return res.status(201).json(body);
  } catch (error) {
    if (idem.type === "claimed") {
      const status = error instanceof HttpError ? error.status : 500;
      await failIdempotency({
        scope,
        key: idempotencyKey,
        status,
        body: { error: error.message || "Could not create refund request" },
      }).catch(() => {});
    }
    throw error;
  }
});

export const cancelBookingRefundRequest = asyncHandler(async (req, res) => {
  const reference = BookingReferenceSchema.parse(req.params.reference);
  const result = await cancelRefundRequest({
    auth: req.auth,
    bookingReference: reference,
  });
  res.json({ data: result.data, sampleData: result.sampleData });
});
