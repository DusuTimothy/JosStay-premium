import crypto from "node:crypto";
import { DATA_BACKEND } from "../config/env.js";
import { HttpError, asyncHandler } from "../lib/http.js";
import { isDatabaseEnabled, query, getClient } from "../lib/postgres.js";
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} from "../lib/paystack.js";
import { sendBookingConfirmationEmail } from "../lib/notifications.js";
import {
  findBookingByReference,
  markBookingPaymentByReference,
  reactivateExpiredBooking,
} from "../store/bookingStore.js";

const sampleData = DATA_BACKEND === "demo";

// The amount charged through Paystack is the stay total plus the guest-borne
// processing fee. Commission and host earnings stay based on the stay total.
const chargedAmountFor = (booking) =>
  Math.max(0, Number(booking?.total || 0)) + Math.max(0, Number(booking?.paymentFee || 0));

const normalizePaystackStatus = (status) => String(status || "").toLowerCase();

const buildEventKey = (event, reference) => {
  // Prefer a stable key from payload when available; fall back to hash.
  const id = event?.id || event?.data?.id;
  if (id != null) return `${event?.event || "event"}:${id}`;
  if (reference) return `${event?.event || "event"}:${reference}`;
  const hash = crypto.createHash("sha256").update(JSON.stringify(event || {})).digest("hex");
  return `hash:${hash}`;
};

const recordWebhookEvent = async ({ provider, eventKey, eventType, reference, payload }) => {
  if (!isDatabaseEnabled) return { recorded: true, duplicate: false };
  const result = await query(
    `insert into public.payment_webhook_events (provider, event_key, event_type, reference, payload)
     values ($1, $2, $3, $4, $5::jsonb)
     on conflict (provider, event_key) do nothing
     returning id`,
    [provider, eventKey, eventType || null, reference || null, JSON.stringify(payload || {})],
  );
  return { recorded: result.rowCount === 1, duplicate: result.rowCount === 0 };
};

const deleteWebhookEvent = async ({ provider, eventKey }) => {
  if (!isDatabaseEnabled) return;
  try {
    await query(
      `delete from public.payment_webhook_events where provider = $1 and event_key = $2`,
      [provider, eventKey],
    );
  } catch (error) {
    console.error("[payments] Failed to clear webhook event for retry", {
      provider,
      eventKey,
      message: error?.message,
    });
  }
};

const logPaymentEvent = (level, event, details = {}) => {
  const payload = { event, ...details, at: new Date().toISOString() };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
};

const upsertPaymentRecord = async ({
  provider = "paystack",
  bookingId = null,
  bookingReference,
  reference,
  amount,
  currency = "NGN",
  status,
  channel = null,
  authorizationUrl = null,
  accessCode = null,
  customerEmail = null,
  metadata = {},
  initializedAt = null,
  paidAt = null,
  rawInitialize = null,
  rawVerify = null,
  lastEvent = null,
}) => {
  if (!isDatabaseEnabled) return null;

  await query(
    `insert into public.payments (
      booking_id, booking_reference, provider, reference, amount, currency, status,
      channel, authorization_url, access_code, customer_email, metadata,
      initialized_at, paid_at, raw_initialize, raw_verify, last_event
    ) values (
      $1::uuid, $2, $3, $4, $5, $6, $7::public.payment_status,
      $8, $9, $10, $11, $12::jsonb,
      $13::timestamptz, $14::timestamptz, $15::jsonb, $16::jsonb, $17::jsonb
    )
    on conflict (provider, reference) do update set
      booking_id = coalesce(excluded.booking_id, public.payments.booking_id),
      booking_reference = coalesce(excluded.booking_reference, public.payments.booking_reference),
      amount = case when excluded.amount > 0 then excluded.amount else public.payments.amount end,
      currency = coalesce(excluded.currency, public.payments.currency),
      status = excluded.status,
      channel = coalesce(excluded.channel, public.payments.channel),
      authorization_url = coalesce(excluded.authorization_url, public.payments.authorization_url),
      access_code = coalesce(excluded.access_code, public.payments.access_code),
      customer_email = coalesce(excluded.customer_email, public.payments.customer_email),
      metadata = case when excluded.metadata = '{}'::jsonb then public.payments.metadata else excluded.metadata end,
      initialized_at = coalesce(public.payments.initialized_at, excluded.initialized_at),
      paid_at = coalesce(excluded.paid_at, public.payments.paid_at),
      raw_initialize = case when excluded.raw_initialize = '{}'::jsonb then public.payments.raw_initialize else excluded.raw_initialize end,
      raw_verify = case when excluded.raw_verify = '{}'::jsonb then public.payments.raw_verify else excluded.raw_verify end,
      last_event = case when excluded.last_event = '{}'::jsonb then public.payments.last_event else excluded.last_event end,
      updated_at = now()`,
    [
      bookingId,
      bookingReference || null,
      provider,
      reference,
      amount ?? 0,
      currency,
      status,
      channel,
      authorizationUrl,
      accessCode,
      customerEmail,
      JSON.stringify(metadata || {}),
      initializedAt,
      paidAt,
      JSON.stringify(rawInitialize || {}),
      JSON.stringify(rawVerify || {}),
      JSON.stringify(lastEvent || {}),
    ],
  );
};

const confirmSuccessfulPayment = async ({
  provider = "paystack",
  paymentReference,
  bookingReference,
  amountKobo,
  channel,
  paidAt,
  rawVerify,
  rawEvent,
}) => {
  const booking = await findBookingByReference(bookingReference, { includeInternal: true });
  if (!booking) {
    throw new HttpError(404, "Booking not found for payment");
  }

  const paymentAmount = Math.round((Number(amountKobo) || 0) / 100);
  const paidAtValue = paidAt || new Date().toISOString();
  const expectedKobo = Math.round(chargedAmountFor(booking) * 100);

  const recordReviewPayment = async ({
    status = "paid",
    requiresRefund = false,
    refundReason = null,
    amount = paymentAmount || chargedAmountFor(booking) || 0,
  }) => {
    await upsertPaymentRecord({
      provider,
      bookingId: booking.id || null,
      bookingReference,
      reference: paymentReference,
      amount,
      currency: booking.currency || "NGN",
      status,
      channel: channel || null,
      customerEmail: booking.guest?.email || null,
      metadata: {
        bookingReference,
        ...(requiresRefund ? { requiresRefund: true, refundReason } : {}),
      },
      paidAt: status === "paid" ? paidAtValue : null,
      rawVerify: rawVerify || {},
      lastEvent: rawEvent || {},
    });
  };

  // Amount mismatch: record the provider charge for review/refund. Do not mark booking paid.
  if (expectedKobo > 0 && Number.isFinite(amountKobo) && amountKobo !== expectedKobo) {
    await recordReviewPayment({
      status: "paid",
      requiresRefund: true,
      refundReason: "amount_mismatch",
      amount: paymentAmount,
    }).catch((error) => {
      logPaymentEvent("error", "payment.amount_mismatch_record_failed", {
        provider,
        bookingReference,
        paymentReference,
        amountKobo,
        expectedKobo,
        message: error?.message,
      });
    });
    logPaymentEvent("error", "payment.amount_mismatch", {
      provider,
      bookingReference,
      paymentReference,
      amountKobo,
      expectedKobo,
    });
    throw new HttpError(409, "Payment amount does not match booking total");
  }

  // Already-paid booking: idempotent when same reference, but record different
  // successful references as paid-for-review so money capture is never invisible.
  if (booking.paymentStatus === "paid") {
    if (booking.paymentReference && paymentReference && booking.paymentReference !== paymentReference) {
      await recordReviewPayment({
        status: "paid",
        requiresRefund: true,
        refundReason: "duplicate_successful_charge",
      }).catch((error) => {
        logPaymentEvent("error", "payment.duplicate_record_failed", {
          provider,
          bookingReference,
          paymentReference,
          message: error?.message,
        });
      });
      logPaymentEvent("error", "payment.duplicate_successful_charge", {
        provider,
        bookingReference,
        paymentReference,
        existingPaymentReference: booking.paymentReference,
        amountKobo,
      });
      return {
        booking,
        outcome: "duplicate_paid",
        requiresRefund: true,
        refundReason: "duplicate_successful_charge",
      };
    }
    return { booking, outcome: "already_paid", requiresRefund: false };
  }

  // A successful charge arrived after the unpaid reservation expired/cancelled.
  // Reactivate only if the room is still available; otherwise flag for refund.
  if (["cancelled", "completed", "no_show"].includes(booking.status)) {
    if (booking.status === "cancelled" && booking.paymentStatus === "abandoned") {
      await recordReviewPayment({ status: "paid" }).catch(() => {});
      const reactivated = await reactivateExpiredBooking({
        bookingId: booking.id,
        paymentReference,
        paymentProvider: provider,
        paidAt: paidAtValue,
      });

      if (reactivated.ok) {
        logPaymentEvent("warn", "payment.reactivated_expired_booking", {
          provider,
          bookingReference,
          paymentReference,
          amountKobo,
        });
        try {
          await sendBookingConfirmationEmail(reactivated.booking);
        } catch {}
        return { booking: reactivated.booking, outcome: "reactivated", requiresRefund: false };
      }

      await recordReviewPayment({
        status: "paid",
        requiresRefund: true,
        refundReason: reactivated.reason || "stay_no_longer_available",
      }).catch(() => {});
      logPaymentEvent("error", "payment.late_success_requires_refund", {
        provider,
        bookingReference,
        paymentReference,
        amountKobo,
        reason: reactivated.reason,
      });
      return {
        booking,
        outcome: "late_payment_requires_refund",
        requiresRefund: true,
        refundReason: reactivated.reason || "stay_no_longer_available",
      };
    }

    await recordReviewPayment({
      status: "paid",
      requiresRefund: true,
      refundReason: `booking_${booking.status}`,
    }).catch(() => {});
    logPaymentEvent("error", "payment.success_for_unpayable_booking", {
      provider,
      bookingReference,
      paymentReference,
      bookingStatus: booking.status,
      amountKobo,
    });
    return {
      booking,
      outcome: "unpayable_requires_refund",
      requiresRefund: true,
      refundReason: `booking_${booking.status}`,
    };
  }

  await upsertPaymentRecord({
    provider,
    bookingId: booking.id || null,
    bookingReference,
    reference: paymentReference,
    amount: chargedAmountFor(booking) || paymentAmount,
    currency: booking.currency || "NGN",
    status: "paid",
    channel: channel || null,
    customerEmail: booking.guest?.email || null,
    metadata: { bookingReference },
    paidAt: paidAtValue,
    rawVerify: rawVerify || {},
    lastEvent: rawEvent || {},
  });

  const updated = await markBookingPaymentByReference({
    bookingReference,
    paymentStatus: "paid",
    paymentReference,
    paymentProvider: provider,
    paidAt: paidAtValue,
    bookingStatus: "upcoming",
  });

  logPaymentEvent("info", "payment.confirmed", {
    provider,
    bookingReference,
    paymentReference,
    amountKobo,
  });

  try {
    await sendBookingConfirmationEmail(updated || booking);
  } catch {}

  return { booking: updated, outcome: "paid", requiresRefund: false };
};

export const verifyPaystackPayment = asyncHandler(async (req, res) => {
  const reference = String(req.query.reference || req.query.trxref || "").trim();
  if (!reference) {
    throw new HttpError(400, "Payment reference is required");
  }

  const transaction = await verifyPaystackTransaction(reference);
  const status = normalizePaystackStatus(transaction?.status);
  const metadata = transaction?.metadata || {};
  const bookingReference = String(metadata.bookingReference || metadata.booking_reference || "").trim();

  if (!bookingReference) {
    throw new HttpError(400, "Payment is missing booking information");
  }

  const booking = await findBookingByReference(bookingReference, { auth: req.auth });
  if (!booking) {
    throw new HttpError(404, "Booking not found");
  }

  if (status === "success") {
    const result = await confirmSuccessfulPayment({
      provider: "paystack",
      paymentReference: reference,
      bookingReference,
      amountKobo: Number(transaction?.amount),
      channel: transaction?.channel || null,
      paidAt: transaction?.paid_at || null,
      rawVerify: transaction,
    });

    return res.json({
      data: {
        booking: result.booking,
        payment: {
          reference,
          status: result.booking?.paymentStatus === "paid" ? "paid" : "review",
          provider: "paystack",
          requiresRefund: Boolean(result.requiresRefund),
          refundReason: result.refundReason || null,
          outcome: result.outcome,
        },
      },
      sampleData,
    });
  }

  // Non-success: record state but do not confirm booking or regress a paid booking.
  if (booking.paymentStatus !== "paid") {
    await upsertPaymentRecord({
      provider: "paystack",
      bookingId: booking.id || null,
      bookingReference,
      reference,
      amount: chargedAmountFor(booking) || Math.round(Number(transaction?.amount || 0) / 100),
      currency: booking.currency || "NGN",
      status: status === "failed" ? "failed" : status === "abandoned" ? "abandoned" : "initialized",
      channel: transaction?.channel || null,
      customerEmail: booking.guest?.email || null,
      rawVerify: transaction || {},
    }).catch(() => {});
  }

  const freshBooking = await findBookingByReference(bookingReference, { auth: req.auth }) || booking;
  return res.json({
    data: {
      booking: freshBooking,
      payment: { reference, status: freshBooking.paymentStatus === "paid" ? "paid" : (status || "unknown"), provider: "paystack" },
    },
    sampleData,
  });
});

export const handlePaystackWebhook = asyncHandler(async (req, res) => {
  if (!verifyPaystackWebhookSignature(req)) {
    throw new HttpError(401, "Invalid webhook signature");
  }

  const event = req.body || {};
  const eventType = String(event.event || "");
  const data = event.data || {};
  const reference = String(data.reference || "").trim();
  const metadata = data.metadata || {};
  const bookingReference = String(metadata.bookingReference || metadata.booking_reference || "").trim();
  const eventKey = buildEventKey(event, reference);

  const { duplicate } = await recordWebhookEvent({
    provider: "paystack",
    eventKey,
    eventType,
    reference,
    payload: event,
  });

  if (duplicate) {
    return res.json({ received: true, duplicate: true });
  }

  if (eventType === "charge.success" && reference && bookingReference) {
    try {
      const result = await confirmSuccessfulPayment({
        provider: "paystack",
        paymentReference: reference,
        bookingReference,
        amountKobo: Number(data.amount),
        channel: data.channel || null,
        paidAt: data.paid_at || null,
        rawEvent: event,
      });
      if (result?.requiresRefund) {
        logPaymentEvent("error", "payment.webhook_requires_refund_review", {
          provider: "paystack",
          eventKey,
          bookingReference,
          paymentReference: reference,
          outcome: result.outcome,
          refundReason: result.refundReason,
        });
      }
    } catch (error) {
      if (error instanceof HttpError) {
        logPaymentEvent("warn", "payment.webhook_business_conflict", {
          provider: "paystack",
          eventKey,
          eventType,
          bookingReference,
          paymentReference: reference,
          status: error.status,
          message: error.message,
        });
      } else {
        // Allow Paystack to retry unexpected operational failures.
        await deleteWebhookEvent({ provider: "paystack", eventKey });
        throw error;
      }
    }
  } else if (reference && bookingReference) {
    try {
      const booking = await findBookingByReference(bookingReference, { includeInternal: true });
      if (booking?.paymentStatus !== "paid") {
        await upsertPaymentRecord({
          provider: "paystack",
          bookingId: booking?.id || null,
          bookingReference,
          reference,
          amount: chargedAmountFor(booking) || Math.round(Number(data.amount || 0) / 100),
          currency: booking?.currency || data.currency || "NGN",
          status: normalizePaystackStatus(data.status) === "failed" ? "failed" : "initialized",
          channel: data.channel || null,
          lastEvent: event,
        });
      }
    } catch {
      // Ignore non-critical webhook side-effects.
    }
  }

  return res.json({ received: true });
});
