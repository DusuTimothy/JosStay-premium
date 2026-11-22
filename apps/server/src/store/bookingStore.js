import crypto from "node:crypto";
import { nightsBetween, quoteStay, toIso } from "@josstay/shared";
import { HttpError } from "../lib/http.js";
import { getClient, isDatabaseEnabled, query } from "../lib/postgres.js";
import { bookings, createReference } from "./demoStore.js";
import { findHostByUserId } from "./hostStore.js";
import { mapBookingRow } from "./mappers.js";

const ACTIVE_STATUSES = ["upcoming", "confirmed"];
const PENDING_PAYMENT_TTL_MINUTES = Math.max(
  5,
  Number.parseInt(process.env.PAYMENT_PENDING_TTL_MINUTES || "30", 10) || 30,
);

const BOOKING_SELECT_SQL = `
  select
    b.id,
    b.reference,
    b.user_id,
    b.check_in,
    b.check_out,
    b.guests,
    b.airport_pickup,
    b.payment_method,
    b.requests,
    b.status,
    b.total,
    b.currency,
    b.quote,
    b.cancelled_at,
    b.created_at,
    b.guest_first_name,
    b.guest_last_name,
    b.guest_email,
    b.guest_phone,
    b.payment_status,
    b.payment_reference,
    b.payment_provider,
    b.paid_at,
    jsonb_build_object('slug', p.slug, 'name', p.name, 'host_id', p.host_id) as properties,
    jsonb_build_object('code', r.code, 'name', r.name) as rooms
  from public.bookings b
  join public.properties p on p.id = b.property_id
  join public.rooms r on r.id = b.room_id
`;

const isActive = (status) => ACTIVE_STATUSES.includes(status);

const isExpiredPendingDemoBooking = (booking, nowMs = Date.now()) => {
  if (!booking) return false;
  if (booking.status !== "upcoming") return false;
  if (booking.paymentStatus === "paid") return false;
  if (!["pending", "initialized"].includes(booking.paymentStatus)) return false;
  // Demo-paid fallback bookings are marked paid; only expire unpaid pending/initialized reservations.
  const basis = booking.updatedAt || booking.createdAt;
  if (!basis) return false;
  const ageMs = nowMs - new Date(basis).getTime();
  return Number.isFinite(ageMs) && ageMs >= PENDING_PAYMENT_TTL_MINUTES * 60 * 1000;
};

const expireStaleDemoBookings = ({ reference } = {}) => {
  if (isDatabaseEnabled) return 0;
  const nowIso = new Date().toISOString();
  let count = 0;
  for (const booking of bookings) {
    if (reference && booking.reference !== reference) continue;
    if (!isExpiredPendingDemoBooking(booking)) continue;
    booking.status = "cancelled";
    booking.cancelledAt = booking.cancelledAt || nowIso;
    booking.paymentStatus = "abandoned";
    booking.updatedAt = nowIso;
    count += 1;
  }
  return count;
};

export const expireStalePendingBookings = async ({ reference } = {}) => {
  if (!isDatabaseEnabled) {
    return expireStaleDemoBookings({ reference });
  }
  try {
    const params = [PENDING_PAYMENT_TTL_MINUTES];
    let whereRef = "";
    if (reference) {
      params.push(reference);
      whereRef = ` and b.reference = $${params.length}`;
    }
    const result = await query(
      `update public.bookings b
       set status = 'cancelled'::public.booking_status,
           cancelled_at = coalesce(b.cancelled_at, now()),
           payment_status = 'abandoned'::public.payment_status
       where b.status = 'upcoming'
         and b.paid_at is null
         and b.payment_status in ('pending', 'initialized')
         and b.updated_at < (now() - ($1::int * interval '1 minute'))
         ${whereRef}`,
      params,
    );
    if (result.rowCount > 0) {
      console.info(`[bookings] Expired ${result.rowCount} unpaid reservation(s)`);
    }
    return result.rowCount;
  } catch {
    // Best-effort expiry; core request paths should continue.
    return 0;
  }
};

/**
 * Reuse an existing Paystack transaction instead of creating a second payable
 * checkout link for the same booking. Paystack cannot cancel an initialized
 * transaction, so a booking must only ever expose one active link.
 */
export const findReusablePaymentForBooking = async (
  bookingId,
  { maxAgeMinutes = PENDING_PAYMENT_TTL_MINUTES } = {},
) => {
  if (!isDatabaseEnabled || !bookingId) return null;
  const { rows } = await query(
    `select reference, amount, currency, authorization_url, access_code,
            customer_email, initialized_at
     from public.payments
     where booking_id = $1::uuid
       and provider = 'paystack'
       and status = 'initialized'
       and authorization_url is not null
       and initialized_at is not null
       and initialized_at > (now() - ($2::int * interval '1 minute'))
     order by initialized_at desc
     limit 1`,
    [bookingId, maxAgeMinutes],
  );
  return rows[0] || null;
};

/**
 * A payment can succeed after the unpaid reservation was auto-expired.
 * If the room is still free, reactivate the booking. The DB exclusion
 * constraint rejects the update when another stay now overlaps, in which
 * case the caller must flag the charge for refund.
 */
export const reactivateExpiredBooking = async ({
  bookingId,
  paymentReference,
  paymentProvider = "paystack",
  paidAt,
}) => {
  if (!isDatabaseEnabled) return { ok: false, reason: "not_expired" };
  try {
    const updated = await query(
      `update public.bookings
       set status = 'upcoming'::public.booking_status,
           cancelled_at = null,
           payment_status = 'paid'::public.payment_status,
           payment_reference = $2,
           payment_provider = $3,
           paid_at = $4::timestamptz
       where id = $1::uuid
         and status = 'cancelled'
         and payment_status = 'abandoned'
       returning id`,
      [bookingId, paymentReference, paymentProvider, paidAt || new Date().toISOString()],
    );
    if (!updated.rows[0]) return { ok: false, reason: "not_expired" };

    const { rows } = await query(
      `${BOOKING_SELECT_SQL} where b.id = $1::uuid limit 1`,
      [updated.rows[0].id],
    );
    return { ok: true, booking: mapBookingRow(rows[0], { includeInternal: true }) };
  } catch (error) {
    if (error?.code === "23P01") return { ok: false, reason: "stay_no_longer_available" };
    if (error?.code === "23505") return { ok: false, reason: "payment_reference_conflict" };
    throw new HttpError(503, "Could not reactivate booking after payment");
  }
};

const validateStay = (context, room, payload) => {
  if (!room) {
    throw new HttpError(400, "Select a valid room for this property");
  }

  const capacity = Math.min(
    Number(context.maxGuests) || room.capacity,
    Number(room.capacity) || Number(context.maxGuests) || 1,
  );

  if (payload.guests > capacity) {
    throw new HttpError(400, `This room sleeps up to ${capacity} guests`);
  }

  const today = toIso(new Date());
  if (payload.checkIn < today) {
    throw new HttpError(400, "checkIn cannot be in the past");
  }

  const nights = nightsBetween(payload.checkIn, payload.checkOut);
  if (nights < 1) {
    throw new HttpError(400, "Stay must include at least one night");
  }
  if (nights > 30) {
    throw new HttpError(400, "Stays longer than 30 nights are not supported online");
  }

  return nights;
};

const nextDemoReference = () => {
  let reference = createReference();
  let guard = 0;
  while (bookings.some((booking) => booking.reference === reference) && guard < 20) {
    reference = createReference();
    guard += 1;
  }
  return reference;
};

const overlapsDemoBooking = (context, room, payload, { excludeReference } = {}) =>
  bookings.some(
    (booking) =>
      booking.reference !== excludeReference &&
      booking.propertySlug === context.property.slug &&
      booking.roomId === room.code &&
      isActive(booking.status) &&
      booking.checkIn < payload.checkOut &&
      booking.checkOut > payload.checkIn,
  );

const demoVisibleBookings = (auth) => {
  if (auth.role === "admin") return bookings;
  return bookings.filter((booking) => String(booking.userId) === String(auth.userId));
};

export const createBookingRecord = async ({
  userId,
  context,
  payload,
  payment = {},
} = {}) => {
  const room = payload.roomId
    ? context.rooms.find((candidate) => candidate.code === payload.roomId)
    : context.rooms[0];

  validateStay(context, room, payload);

  const quote = quoteStay(context.property, payload.checkIn, payload.checkOut, {
    roomId: room.code,
    airportPickup: payload.airportPickup,
  });

  const paymentStatus = payment.status || "pending";
  const bookingStatus = payment.bookingStatus || "upcoming";
  const paymentReference = payment.reference || null;
  const paymentProvider = payment.provider || null;

  if (!isDatabaseEnabled) {
    expireStaleDemoBookings();
    if (overlapsDemoBooking(context, room, payload)) {
      throw new HttpError(409, "Those dates are no longer available");
    }

    const nowIso = new Date().toISOString();
    const booking = {
      id: crypto.randomUUID ? crypto.randomUUID() : undefined,
      reference: nextDemoReference(),
      userId,
      propertySlug: context.property.slug,
      propertyName: context.property.name,
      roomId: room.code,
      roomName: room.name,
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
      guests: payload.guests,
      airportPickup: payload.airportPickup,
      paymentMethod: payload.paymentMethod,
      requests: payload.requests,
      guest: payload.guest,
      status: bookingStatus,
      total: quote.total,
      currency: "NGN",
      quote,
      createdAt: nowIso,
      updatedAt: nowIso,
      paymentStatus,
      ...(paymentReference ? { paymentReference } : {}),
      ...(paymentProvider ? { paymentProvider } : {}),
      ...(paymentStatus === "paid" ? { paidAt: nowIso } : {}),
      sampleData: true,
    };

    bookings.unshift(booking);
    return booking;
  }

  // Release stale unpaid holds before creating a new reservation.
  await expireStalePendingBookings();

  if (!context.dbId || !room.dbId) {
    throw new HttpError(503, "Booking service is temporarily unavailable");
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const client = await getClient();
    try {
      await client.query("begin");
      const insert = await client.query(
        `insert into public.bookings (
          user_id, property_id, room_id, check_in, check_out, guests,
          airport_pickup, payment_method, requests,
          guest_first_name, guest_last_name, guest_email, guest_phone,
          status, payment_status, payment_reference, payment_provider, paid_at,
          total, currency, quote
        ) values (
          $1::uuid, $2::uuid, $3::uuid, $4::date, $5::date, $6::int,
          $7::boolean, $8::public.payment_method, $9::text,
          $10::text, $11::text, $12::text, $13::text,
          $14::public.booking_status, $15::public.payment_status, $16, $17, $18::timestamptz,
          $19::int, 'NGN', $20::jsonb
        )
        returning id`,
        [
          userId,
          context.dbId,
          room.dbId,
          payload.checkIn,
          payload.checkOut,
          payload.guests,
          payload.airportPickup,
          payload.paymentMethod,
          payload.requests ?? null,
          payload.guest.firstName,
          payload.guest.lastName,
          payload.guest.email,
          payload.guest.phone,
          bookingStatus,
          paymentStatus,
          paymentReference,
          paymentProvider,
          paymentStatus === "paid" ? new Date().toISOString() : null,
          quote.total,
          JSON.stringify(quote),
        ],
      );

      const bookingId = insert.rows[0]?.id;
      const { rows } = await client.query(
        `${BOOKING_SELECT_SQL} where b.id = $1::uuid limit 1`,
        [bookingId],
      );
      await client.query("commit");
      return mapBookingRow(rows[0], { includeInternal: true });
    } catch (error) {
      try {
        await client.query("rollback");
      } catch {}
      if (error?.code === "23505") continue; // booking reference unique collision retry
      if (error?.code === "23P01") {
        throw new HttpError(409, "Those dates are no longer available");
      }
      throw new HttpError(503, "Booking service is temporarily unavailable");
    } finally {
      client.release();
    }
  }

  throw new HttpError(503, "Could not allocate a booking reference. Try again.");
};

export const listBookingRecords = async (auth, queryParams = {}) => {
  if (!isDatabaseEnabled) {
    expireStaleDemoBookings();
    return demoVisibleBookings(auth).filter(
      (booking) => !queryParams.status || booking.status === queryParams.status,
    );
  }

  await expireStalePendingBookings();

  try {
    const params = [];
    const where = [];

    if (queryParams.status) {
      params.push(queryParams.status);
      where.push(`b.status = $${params.length}::public.booking_status`);
    }

    if (auth.role === "host") {
      const host = await findHostByUserId(auth.userId);
      if (!host) return [];

      const { rows: properties } = await query(
        `select id from public.properties where host_id = $1::uuid`,
        [host.id],
      );
      const propertyIds = properties.map((property) => property.id);
      if (!propertyIds.length) return [];

      params.push(propertyIds);
      where.push(`b.property_id = any($${params.length}::uuid[])`);
    } else if (auth.role !== "admin") {
      params.push(auth.userId);
      where.push(`b.user_id = $${params.length}::uuid`);
    }

    let sql = `${BOOKING_SELECT_SQL}`;
    if (where.length) sql += ` where ${where.join(" and ")}`;
    sql += " order by b.created_at desc limit 100";

    const { rows } = await query(sql, params);
    return rows.map(mapBookingRow);
  } catch {
    throw new HttpError(503, "Booking service is temporarily unavailable");
  }
};

const authorizeBookingAccess = async (bookingRow, auth) => {
  if (!auth) return false;
  if (auth.role === "admin") return true;
  if (String(bookingRow.user_id) === String(auth.userId)) return true;

  if (auth.role === "host") {
    const host = await findHostByUserId(auth.userId);
    const bookingProperty = Array.isArray(bookingRow.properties)
      ? bookingRow.properties[0]
      : bookingRow.properties;
    return Boolean(host && bookingProperty?.host_id === host.id);
  }

  return false;
};

export const findBookingByReference = async (reference, { auth, includeInternal = false } = {}) => {
  if (!isDatabaseEnabled) {
    expireStaleDemoBookings({ reference });
    const booking = bookings.find((entry) => entry.reference === reference) || null;
    if (!booking) return null;
    if (includeInternal && !auth) return booking;
    if (auth) {
      const owned = String(booking.userId) === String(auth.userId);
      if (auth.role !== "admin" && !owned) return null;
    }
    return booking;
  }

  await expireStalePendingBookings({ reference });

  try {
    const { rows } = await query(
      `${BOOKING_SELECT_SQL} where b.reference = $1 limit 1`,
      [reference],
    );
    const row = rows[0];
    if (!row) return null;

    if (auth) {
      const allowed = await authorizeBookingAccess(row, auth);
      if (!allowed) return null;
    }

    return mapBookingRow(row, { includeInternal });
  } catch {
    throw new HttpError(503, "Booking service is temporarily unavailable");
  }
};

export const getBookingRecord = async (reference, auth) => {
  const booking = await findBookingByReference(reference, { auth, includeInternal: false });
  if (!booking) {
    throw new HttpError(404, "Booking not found");
  }
  return booking;
};

export const markBookingPaymentByReference = async ({
  bookingReference,
  paymentStatus,
  paymentReference,
  paymentProvider,
  paidAt,
  bookingStatus,
}) => {
  if (!isDatabaseEnabled) {
    const booking = bookings.find((entry) => entry.reference === bookingReference);
    if (!booking) throw new HttpError(404, "Booking not found");

    if (paymentStatus) booking.paymentStatus = paymentStatus;
    if (paymentReference) booking.paymentReference = paymentReference;
    if (paymentProvider) booking.paymentProvider = paymentProvider;
    if (paidAt) booking.paidAt = paidAt;
    if (bookingStatus) booking.status = bookingStatus;
    booking.updatedAt = new Date().toISOString();

    return booking;
  }

  try {
    const { rows } = await query(
      `update public.bookings
       set payment_status = coalesce($2::public.payment_status, payment_status),
           payment_reference = coalesce($3, payment_reference),
           payment_provider = coalesce($4, payment_provider),
           paid_at = coalesce($5::timestamptz, paid_at),
           status = coalesce($6::public.booking_status, status)
       where reference = $1
       returning reference`,
      [bookingReference, paymentStatus || null, paymentReference || null, paymentProvider || null, paidAt || null, bookingStatus || null],
    );
    if (!rows[0]) throw new HttpError(404, "Booking not found");

    const updated = await findBookingByReference(bookingReference, { includeInternal: true });
    return updated;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "Booking service is temporarily unavailable");
  }
};

export const cancelBookingRecord = async (reference, auth) => {
  if (!isDatabaseEnabled) {
    const booking = bookings.find((entry) => entry.reference === reference);
    if (!booking) throw new HttpError(404, "Booking not found");

    const owned = String(booking.userId) === String(auth.userId);
    if (auth.role !== "admin" && !owned) {
      throw new HttpError(404, "Booking not found");
    }
    if (!isActive(booking.status)) {
      throw new HttpError(409, "Only upcoming bookings can be cancelled");
    }

    booking.status = "cancelled";
    booking.cancelledAt = new Date().toISOString();
    if (booking.paymentStatus === "initialized" || booking.paymentStatus === "pending") {
      booking.paymentStatus = "cancelled";
    }
    return booking;
  }

  try {
    const { rows } = await query(
      `${BOOKING_SELECT_SQL} where b.reference = $1 limit 1`,
      [reference],
    );
    const booking = rows[0];
    if (!booking) throw new HttpError(404, "Booking not found");

    const allowed = await authorizeBookingAccess(booking, auth);
    if (!allowed) throw new HttpError(404, "Booking not found");
    if (!isActive(booking.status)) {
      throw new HttpError(409, "Only upcoming bookings can be cancelled");
    }

    const updated = await query(
      `update public.bookings
       set status = 'cancelled'::public.booking_status,
           cancelled_at = now(),
           payment_status = case
             when payment_status in ('initialized', 'pending') then 'cancelled'::public.payment_status
             else payment_status
           end
       where id = $1::uuid
         and status in ('upcoming', 'confirmed')
       returning id`,
      [booking.id],
    );

    if (!updated.rows[0]) {
      throw new HttpError(409, "Only upcoming bookings can be cancelled");
    }

    const { rows: freshRows } = await query(
      `${BOOKING_SELECT_SQL} where b.id = $1::uuid limit 1`,
      [booking.id],
    );
    return mapBookingRow(freshRows[0]);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "Booking service is temporarily unavailable");
  }
};
