import crypto from "node:crypto";
import { DATA_BACKEND, CLIENT_ORIGIN, PAYSTACK_SECRET_KEY, corsOrigins } from "../config/env.js";
import { HttpError, asyncHandler } from "../lib/http.js";
import {
  beginIdempotency,
  completeIdempotency,
  failIdempotency,
  getIdempotencyKey,
  hashIdempotencyPayload,
} from "../lib/idempotency.js";
import { initializePaystackTransaction, toKobo } from "../lib/paystack.js";
import { isDatabaseEnabled, query } from "../lib/postgres.js";
import {
  cancelBookingRecord,
  createBookingRecord,
  findReusablePaymentForBooking,
  getBookingRecord,
  listBookingRecords,
  markBookingPaymentByReference,
} from "../store/bookingStore.js";
import { sendBookingConfirmationEmail } from "../lib/notifications.js";
import { getPropertyContext } from "../store/propertyStore.js";
import {
  BookingListQuerySchema,
  BookingReferenceSchema,
  BookingSchema,
} from "../validators/bookingSchemas.js";

const sampleData = DATA_BACKEND === "demo";

const buildPaymentReference = (bookingReference) => {
  const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${bookingReference}-${Date.now().toString(36).toUpperCase()}-${suffix}`;
};

const resolveCallbackBaseUrl = () => {
  const origin = Array.isArray(corsOrigins) ? corsOrigins[0] : CLIENT_ORIGIN;
  return String(origin || "").replace(/\/+$/, "");
};

const upsertPaymentForBooking = async ({
  booking,
  paymentReference,
  amount,
  currency = "NGN",
  status = "initialized",
  authorizationUrl = null,
  accessCode = null,
  channel = null,
  customerEmail = null,
  rawInitialize = {},
}) => {
  if (!isDatabaseEnabled) return;

  await query(
    `insert into public.payments (
      booking_id, booking_reference, provider, reference, amount, currency, status,
      channel, authorization_url, access_code, customer_email, metadata,
      initialized_at, raw_initialize
    ) values (
      $1::uuid, $2, 'paystack', $3, $4, $5, $6::public.payment_status,
      $7, $8, $9, $10, $11::jsonb,
      now(), $12::jsonb
    )
    on conflict (provider, reference) do update set
      booking_id = coalesce(excluded.booking_id, public.payments.booking_id),
      booking_reference = coalesce(excluded.booking_reference, public.payments.booking_reference),
      amount = excluded.amount,
      currency = excluded.currency,
      status = excluded.status,
      authorization_url = coalesce(excluded.authorization_url, public.payments.authorization_url),
      access_code = coalesce(excluded.access_code, public.payments.access_code),
      customer_email = coalesce(excluded.customer_email, public.payments.customer_email),
      raw_initialize = case when excluded.raw_initialize = '{}'::jsonb then public.payments.raw_initialize else excluded.raw_initialize end,
      updated_at = now()`,
    [
      booking.id || null,
      booking.reference,
      paymentReference,
      amount,
      currency,
      status,
      channel,
      authorizationUrl,
      accessCode,
      customerEmail,
      JSON.stringify({ bookingReference: booking.reference }),
      JSON.stringify(rawInitialize || {}),
    ],
  );
};

const shouldUsePaystack = () => Boolean(PAYSTACK_SECRET_KEY);

export const createBooking = asyncHandler(async (req, res) => {
  const payload = BookingSchema.parse(req.body);
  const context = await getPropertyContext(payload.propertySlug);
  if (!context) {
    throw new HttpError(404, "Property not found");
  }

  const idempotencyKey = getIdempotencyKey(req);
  const requestHash = hashIdempotencyPayload({
    userId: req.auth.userId,
    payload,
  });
  const scope = `user:${req.auth.userId}:booking:create`;

  let idem = { type: "skipped" };
  if (isDatabaseEnabled) {
    if (!idempotencyKey) {
      throw new HttpError(400, "Idempotency-Key header is required for booking requests");
    }
    idem = await beginIdempotency({
      scope,
      key: idempotencyKey,
      operation: "booking.create",
      requestHash,
    });
    if (idem.type === "replay") {
      return res.status(idem.status || 200).json(idem.body);
    }
  } else if (idempotencyKey) {
    // Demo mode: no persistent replay store, but accept the key.
    idem = { type: "claimed-demo" };
  }

  try {
    let booking;
    let payment = null;

    if (shouldUsePaystack()) {
      // Create a pending booking reservation, then initialize Paystack.
      booking = await createBookingRecord({
        userId: req.auth.userId,
        context,
        payload,
        payment: {
          status: "pending",
          bookingStatus: "upcoming",
          provider: "paystack",
        },
      });

      const paymentReference = buildPaymentReference(booking.reference);
      const callbackBase = resolveCallbackBaseUrl();
      const callbackUrl = callbackBase
        ? `${callbackBase}/confirmation/${encodeURIComponent(booking.reference)}`
        : undefined;

      const init = await initializePaystackTransaction({
        email: booking.guest?.email || payload.guest.email,
        amountKobo: toKobo(booking.total),
        reference: paymentReference,
        callbackUrl,
        metadata: {
          bookingReference: booking.reference,
          userId: req.auth.userId,
          propertySlug: booking.propertySlug || payload.propertySlug,
        },
      });

      await upsertPaymentForBooking({
        booking,
        paymentReference,
        amount: booking.total,
        currency: booking.currency || "NGN",
        status: "initialized",
        authorizationUrl: init.authorization_url || null,
        accessCode: init.access_code || null,
        customerEmail: booking.guest?.email || null,
        rawInitialize: init,
      });

      booking = await markBookingPaymentByReference({
        bookingReference: booking.reference,
        paymentStatus: "initialized",
        paymentReference,
        paymentProvider: "paystack",
        bookingStatus: "upcoming",
      });

      payment = {
        provider: "paystack",
        reference: paymentReference,
        status: "initialized",
        authorizationUrl: init.authorization_url || null,
        accessCode: init.access_code || null,
        amount: booking.total,
        amountKobo: toKobo(booking.total),
        currency: booking.currency || "NGN",
        email: booking.guest?.email || payload.guest.email,
      };
    } else if (sampleData) {
      // Demo mode only: create a non-real-payment booking for local/demo continuity.
      booking = await createBookingRecord({
        userId: req.auth.userId,
        context,
        payload,
        payment: {
          status: "paid",
          bookingStatus: "upcoming",
          provider: "demo",
          reference: `DEMO-${Date.now()}`,
        },
      });
      payment = {
        provider: "demo",
        status: "paid",
        reference: booking.paymentReference || null,
        amount: booking.total,
        currency: booking.currency || "NGN",
      };
      // Best-effort confirmation notification for demo-paid bookings.
      try {
        await sendBookingConfirmationEmail(booking);
      } catch {}
    } else {
      throw new HttpError(503, "Payment service is not configured");
    }

    const responseBody = { data: { booking, payment }, sampleData };
    if (idem.type === "claimed") {
      await completeIdempotency({ scope, key: idempotencyKey, status: 201, body: responseBody });
    }
    return res.status(201).json(responseBody);
  } catch (error) {
    if (idem.type === "claimed") {
      const status = error instanceof HttpError ? error.status : 500;
      await failIdempotency({
        scope,
        key: idempotencyKey,
        status,
        body: { error: error.message || "Booking failed" },
      }).catch(() => {});
    }
    throw error;
  }
});

export const getBooking = asyncHandler(async (req, res) => {
  const reference = BookingReferenceSchema.parse(req.params.reference);
  const booking = await getBookingRecord(reference, req.auth);
  res.json({ data: booking, sampleData });
});

export const listBookings = asyncHandler(async (req, res) => {
  const queryParams = BookingListQuerySchema.parse(req.query);
  const results = await listBookingRecords(req.auth, queryParams);

  res.json({
    count: results.length,
    data: results,
    sampleData,
  });
});

export const initializeBookingPayment = asyncHandler(async (req, res) => {
  const reference = BookingReferenceSchema.parse(req.params.reference);
  const booking = await getBookingRecord(reference, req.auth);

  if (!booking) {
    throw new HttpError(404, "Booking not found");
  }

  if (["cancelled", "completed", "no_show"].includes(booking.status)) {
    throw new HttpError(409, "This booking cannot be paid for");
  }

  if (booking.paymentStatus === "paid") {
    throw new HttpError(409, "Booking is already paid");
  }

  if (!shouldUsePaystack()) {
    throw new HttpError(503, "Payment service is not configured");
  }

  const idempotencyKey = getIdempotencyKey(req);
  const requestHash = hashIdempotencyPayload({ userId: req.auth.userId, reference, operation: "payment.initialize" });
  const scope = `user:${req.auth.userId}:booking:payment-init:${reference}`;
  let idem = { type: "skipped" };
  if (isDatabaseEnabled) {
    if (!idempotencyKey) {
      throw new HttpError(400, "Idempotency-Key header is required for payment requests");
    }
    idem = await beginIdempotency({
      scope,
      key: idempotencyKey,
      operation: "booking.payment.initialize",
      requestHash,
    });
    if (idem.type === "replay") {
      return res.status(idem.status || 200).json(idem.body);
    }
  }

  try {
    if (booking.paymentStatus === "paid") {
      throw new HttpError(409, "Booking is already paid");
    }

    // Reuse an existing active Paystack transaction to avoid creating multiple
    // payable checkout links for the same booking.
    const reusable = await findReusablePaymentForBooking(booking.id);
    if (reusable?.reference) {
      const updatedBooking =
        (await markBookingPaymentByReference({
          bookingReference: booking.reference,
          paymentStatus: "initialized",
          paymentReference: reusable.reference,
          paymentProvider: "paystack",
          bookingStatus: booking.status === "confirmed" ? "confirmed" : "upcoming",
        })) || booking;

      const payment = {
        provider: "paystack",
        reference: reusable.reference,
        status: "initialized",
        authorizationUrl: reusable.authorization_url || null,
        accessCode: reusable.access_code || null,
        amount: updatedBooking?.total ?? booking.total,
        amountKobo: toKobo(updatedBooking?.total ?? booking.total),
        currency: updatedBooking?.currency || booking.currency || "NGN",
        email:
          updatedBooking?.guest?.email ||
          reusable.customer_email ||
          booking.guest?.email ||
          null,
        reused: true,
      };

      const responseBody = { data: { booking: updatedBooking, payment }, sampleData };
      if (idem.type === "claimed") {
        await completeIdempotency({ scope, key: idempotencyKey, status: 200, body: responseBody });
      }
      return res.json(responseBody);
    }

    const paymentReference = buildPaymentReference(booking.reference);
    const callbackBase = resolveCallbackBaseUrl();
    const callbackUrl = callbackBase
      ? `${callbackBase}/confirmation/${encodeURIComponent(booking.reference)}`
      : undefined;

    const init = await initializePaystackTransaction({
      email: booking.guest?.email,
      amountKobo: toKobo(booking.total),
      reference: paymentReference,
      callbackUrl,
      metadata: {
        bookingReference: booking.reference,
        userId: req.auth.userId,
        propertySlug: booking.propertySlug,
        retry: true,
      },
    });

    await upsertPaymentForBooking({
      booking,
      paymentReference,
      amount: booking.total,
      currency: booking.currency || "NGN",
      status: "initialized",
      authorizationUrl: init.authorization_url || null,
      accessCode: init.access_code || null,
      customerEmail: booking.guest?.email || null,
      rawInitialize: init,
    });

    const updatedBooking = await markBookingPaymentByReference({
      bookingReference: booking.reference,
      paymentStatus: "initialized",
      paymentReference,
      paymentProvider: "paystack",
      bookingStatus: booking.status === "confirmed" ? "confirmed" : "upcoming",
    });

    const payment = {
      provider: "paystack",
      reference: paymentReference,
      status: "initialized",
      authorizationUrl: init.authorization_url || null,
      accessCode: init.access_code || null,
      amount: updatedBooking?.total ?? booking.total,
      amountKobo: toKobo(updatedBooking?.total ?? booking.total),
      currency: updatedBooking?.currency || booking.currency || "NGN",
      email: updatedBooking?.guest?.email || booking.guest?.email || null,
    };

    const responseBody = { data: { booking: updatedBooking, payment }, sampleData };
    if (idem.type === "claimed") {
      await completeIdempotency({ scope, key: idempotencyKey, status: 200, body: responseBody });
    }
    return res.json(responseBody);
  } catch (error) {
    if (idem.type === "claimed") {
      const status = error instanceof HttpError ? error.status : 500;
      await failIdempotency({
        scope,
        key: idempotencyKey,
        status,
        body: { error: error.message || "Could not initialize payment" },
      }).catch(() => {});
    }
    throw error;
  }
});

export const cancelBooking = asyncHandler(async (req, res) => {
  const reference = BookingReferenceSchema.parse(req.params.reference);
  const booking = await cancelBookingRecord(reference, req.auth);

  res.json({ data: booking, message: "Booking cancelled", sampleData });
});
