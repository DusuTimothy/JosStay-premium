import { nightsBetween, quoteStay, toIso } from "@josstay/shared";
import { HttpError } from "../lib/http.js";
import { db, isSupabaseEnabled } from "../lib/supabase.js";
import { bookings, createReference } from "./demoStore.js";
import { findHostByUserId } from "./hostStore.js";
import { mapBookingRow } from "./mappers.js";

const ACTIVE_STATUSES = ["upcoming", "confirmed"];

const BOOKING_SELECT = `
  id,
  reference,
  user_id,
  check_in,
  check_out,
  guests,
  airport_pickup,
  payment_method,
  requests,
  status,
  total,
  currency,
  quote,
  cancelled_at,
  created_at,
  guest_first_name,
  guest_last_name,
  guest_email,
  guest_phone,
  properties ( slug, name, host_id ),
  rooms ( code, name )
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

  if (!isSupabaseEnabled) {
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

  const row = {
    user_id: userId,
    property_id: context.dbId,
    room_id: room.dbId,
    check_in: payload.checkIn,
    check_out: payload.checkOut,
    guests: payload.guests,
    airport_pickup: payload.airportPickup,
    payment_method: payload.paymentMethod,
    requests: payload.requests ?? null,
    guest_first_name: payload.guest.firstName,
    guest_last_name: payload.guest.lastName,
    guest_email: payload.guest.email,
    guest_phone: payload.guest.phone,
    status: "upcoming",
    total: quote.total,
    quote,
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await db()
      .from("bookings")
      .insert(row)
      .select(BOOKING_SELECT)
      .single();

    if (!error) return mapBookingRow(data);

    if (error.code === "23505") continue;
    if (error.code === "23P01") {
      throw new HttpError(409, "Those dates are no longer available");
    }

    throw new HttpError(503, "Booking service is temporarily unavailable");
  }

  throw new HttpError(503, "Could not allocate a booking reference. Try again.");
};

const demoVisibleBookings = (auth) => {
  if (auth.role === "admin") return bookings;
  return bookings.filter((booking) => String(booking.userId) === String(auth.userId));
};

export const listBookingRecords = async (auth, query = {}) => {
  if (!isSupabaseEnabled) {
    return demoVisibleBookings(auth).filter(
      (booking) => !query.status || booking.status === query.status,
    );
  }

  let request = db()
    .from("bookings")
    .select(BOOKING_SELECT)
    .order("created_at", { ascending: false })
    .limit(100);

  if (query.status) request = request.eq("status", query.status);

  if (auth.role === "host") {
    const host = await findHostByUserId(auth.userId);
    if (!host) return [];

    const { data: properties, error: propertyError } = await db()
      .from("properties")
      .select("id")
      .eq("host_id", host.id);

    if (propertyError) {
      throw new HttpError(503, "Booking service is temporarily unavailable");
    }

    const propertyIds = (properties || []).map((property) => property.id);
    if (!propertyIds.length) return [];
    request = request.in("property_id", propertyIds);
  } else if (auth.role !== "admin") {
    request = request.eq("user_id", auth.userId);
  }

  const { data, error } = await request;
  if (error) {
    throw new HttpError(503, "Booking service is temporarily unavailable");
  }

  return (data || []).map(mapBookingRow);
};

export const cancelBookingRecord = async (reference, auth) => {
  if (!isSupabaseEnabled) {
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

  const { data: booking, error } = await db()
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("reference", reference)
    .maybeSingle();

  if (error) {
    throw new HttpError(503, "Booking service is temporarily unavailable");
  }
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

  const { data, error: updateError } = await db()
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .in("status", ACTIVE_STATUSES)
    .select(BOOKING_SELECT)
    .single();

  if (updateError) {
    if (updateError.code === "PGRST116") {
      throw new HttpError(409, "Only upcoming bookings can be cancelled");
    }
    throw new HttpError(503, "Booking service is temporarily unavailable");
  }

  return mapBookingRow(data);
};
