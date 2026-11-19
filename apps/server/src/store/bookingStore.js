import { nightsBetween, quoteStay, toIso } from "@josstay/shared";
import { HttpError } from "../lib/http.js";
import { getClient, isDatabaseEnabled, query } from "../lib/postgres.js";
import { bookings, createReference } from "./demoStore.js";
import { findHostByUserId } from "./hostStore.js";
import { mapBookingRow } from "./mappers.js";

const ACTIVE_STATUSES = ["upcoming", "confirmed"];

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
    jsonb_build_object('slug', p.slug, 'name', p.name, 'host_id', p.host_id) as properties,
    jsonb_build_object('code', r.code, 'name', r.name) as rooms
  from public.bookings b
  join public.properties p on p.id = b.property_id
  join public.rooms r on r.id = b.room_id
`;

const isActive = (status) => ACTIVE_STATUSES.includes(status);

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

const overlapsDemoBooking = (context, room, payload) =>
  bookings.some(
    (booking) =>
      booking.propertySlug === context.property.slug &&
      booking.roomId === room.code &&
      isActive(booking.status) &&
      booking.checkIn < payload.checkOut &&
      booking.checkOut > payload.checkIn,
  );

export const createBookingRecord = async ({ userId, context, payload }) => {
  const room = payload.roomId
    ? context.rooms.find((candidate) => candidate.code === payload.roomId)
    : context.rooms[0];

  validateStay(context, room, payload);

  const quote = quoteStay(context.property, payload.checkIn, payload.checkOut, {
    roomId: room.code,
    airportPickup: payload.airportPickup,
  });

  if (!isDatabaseEnabled) {
    if (overlapsDemoBooking(context, room, payload)) {
      throw new HttpError(409, "Those dates are no longer available");
    }

    const booking = {
      reference: nextDemoReference(),
      userId,
      propertySlug: context.property.slug,
      roomId: room.code,
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
      guests: payload.guests,
      airportPickup: payload.airportPickup,
      paymentMethod: payload.paymentMethod,
      requests: payload.requests,
      guest: payload.guest,
      status: "upcoming",
      total: quote.total,
      currency: "NGN",
      quote,
      createdAt: new Date().toISOString(),
      sampleData: true,
    };

    bookings.unshift(booking);
    return booking;
  }

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
          status, total, currency, quote
        ) values (
          $1::uuid, $2::uuid, $3::uuid, $4::date, $5::date, $6::int,
          $7::boolean, $8::public.payment_method, $9::text,
          $10::text, $11::text, $12::text, $13::text,
          'upcoming', $14::int, 'NGN', $15::jsonb
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
      return mapBookingRow(rows[0]);
    } catch (error) {
      try {
        await client.query("rollback");
      } catch {}
      if (error?.code === "23505") continue;
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

const demoVisibleBookings = (auth) => {
  if (auth.role === "admin") return bookings;
  return bookings.filter((booking) => String(booking.userId) === String(auth.userId));
};

export const listBookingRecords = async (auth, queryParams = {}) => {
  if (!isDatabaseEnabled) {
    return demoVisibleBookings(auth).filter(
      (booking) => !queryParams.status || booking.status === queryParams.status,
    );
  }

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
    return booking;
  }

  try {
    const { rows } = await query(
      `${BOOKING_SELECT_SQL} where b.reference = $1 limit 1`,
      [reference],
    );
    const booking = rows[0];
    if (!booking) throw new HttpError(404, "Booking not found");

    let authorised = auth.role === "admin";

    if (!authorised && String(booking.user_id) === String(auth.userId)) {
      authorised = true;
    }

    if (!authorised && auth.role === "host") {
      const host = await findHostByUserId(auth.userId);
      const bookingProperty = Array.isArray(booking.properties)
        ? booking.properties[0]
        : booking.properties;
      authorised = Boolean(host && bookingProperty?.host_id === host.id);
    }

    if (!authorised) throw new HttpError(404, "Booking not found");
    if (!isActive(booking.status)) {
      throw new HttpError(409, "Only upcoming bookings can be cancelled");
    }

    const updated = await query(
      `update public.bookings
       set status = 'cancelled'::public.booking_status,
           cancelled_at = now()
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