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
import { findBookingByReference, markBookingPaymentByReference } from "../store/bookingStore.js";

const sampleData = DATA_BACKEND === "demo";

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

  if (["cancelled", "completed", "no_show"].includes(booking.status)) {
    throw new HttpError(409, "Booking is not payable in its current state");
  }

  const expectedKobo = Math.round(Number(booking.total || 0) * 100);
  if (expectedKobo > 0 && Number.isFinite(amountKobo) && amountKobo !== expectedKobo) {
    throw new HttpError(409, "Payment amount does not match booking total");
  }

  // Idempotent success: if already paid for this booking, require same reference/provider context.
  if (booking.paymentStatus === "paid") {
    if (booking.paymentReference && paymentReference && booking.paymentReference !== paymentReference) {
      throw new HttpError(409, "Booking is already paid with a different payment reference");
    }
    return booking;
  }

  await upsertPaymentRecord({
    provider,
    bookingId: booking.id || null,
    bookingReference,
    reference: paymentReference,
    amount: booking.total || Math.round((amountKobo || 0) / 100),
    currency: booking.currency || "NGN",
    status: "paid",
    channel: channel || null,
    customerEmail: booking.guest?.email || null,
    metadata: { bookingReference },
    paidAt: paidAt || new Date().toISOString(),
    rawVerify: rawVerify || {},
    lastEvent: rawEvent || {},
  });

  const updated = await markBookingPaymentByReference({
    bookingReference,
    paymentStatus: "paid",
    paymentReference,
    paymentProvider: provider,
    paidAt: paidAt || new Date().toISOString(),
    bookingStatus: "upcoming",
  });

  // Best-effort confirmation notification for first successful payment.
  try {
    await sendBookingConfirmationEmail(updated || booking);
  } catch {}

  return updated;
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
    const updated = await confirmSuccessfulPayment({
      provider: "paystack",
      paymentReference: reference,
      bookingReference,
      amountKobo: Number(transaction?.amount),
      channel: transaction?.channel || null,
      paidAt: transaction?.paid_at || null,
      rawVerify: transaction,
    });

    return res.json({ data: { booking: updated, payment: { reference, status: "paid", provider: "paystack" } }, sampleData });
  }

  // Non-success: record state but do not confirm booking or regress a paid booking.
  if (booking.paymentStatus !== "paid") {
    await upsertPaymentRecord({
      provider: "paystack",
      bookingId: booking.id || null,
      bookingReference,
      reference,
      amount: booking.total || Math.round(Number(transaction?.amount || 0) / 100),
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
      await confirmSuccessfulPayment({
        provider: "paystack",
        paymentReference: reference,
        bookingReference,
        amountKobo: Number(data.amount),
        channel: data.channel || null,
        paidAt: data.paid_at || null,
        rawEvent: event,
      });
    } catch (error) {
      // Acknowledge signature-valid webhook to avoid endless retries for business conflicts;
      // operational errors should be surfaced via logs/monitoring.
      if (!(error instanceof HttpError)) {
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
          amount: booking?.total || Math.round(Number(data.amount || 0) / 100),
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
