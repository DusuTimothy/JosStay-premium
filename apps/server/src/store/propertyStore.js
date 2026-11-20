import {
  addDays,
  getProperty as getDemoProperty,
  properties as demoProperties,
  toIso,
} from "@josstay/shared";
import { HttpError } from "../lib/http.js";
import { isDatabaseEnabled, query } from "../lib/postgres.js";
import { mapPropertyRow } from "./mappers.js";

const PROPERTY_DETAIL_SQL = `
  select
    p.*,
    to_jsonb(h) as hosts,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'url', pi.url,
          'alt', pi.alt,
          'position', pi.position
        ) order by pi.position
      )
      from public.property_images pi
      where pi.property_id = p.id
    ), '[]'::jsonb) as property_images,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'code', r.code,
          'name', r.name,
          'price', r.price,
          'capacity', r.capacity,
          'beds', r.beds,
          'size', r.size,
          'refundable', r.refundable
        ) order by r.price, r.code
      )
      from public.rooms r
      where r.property_id = p.id
    ), '[]'::jsonb) as rooms,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'amenity_id', pa.amenity_id,
          'amenities', jsonb_build_object('id', a.id, 'label', a.label)
        ) order by a.label
      )
      from public.property_amenities pa
      join public.amenities a on a.id = pa.amenity_id
      where pa.property_id = p.id
    ), '[]'::jsonb) as property_amenities,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'guest_name', pr.guest_name,
          'reviewed_on', pr.reviewed_on,
          'rating', pr.rating,
          'quote', pr.quote
        ) order by pr.reviewed_on desc, pr.created_at desc
      )
      from public.property_reviews pr
      where pr.property_id = p.id
    ), '[]'::jsonb) as property_reviews
  from public.properties p
  join public.hosts h on h.id = p.host_id
`;

const normalizeDestination = (value) => String(value || "").trim().toLowerCase();

const matchesDestination = (property, destination) => {
  if (!destination) return true;
  return [property.name, property.area, property.address]
    .join(" ")
    .toLowerCase()
    .includes(destination);
};

const sortProperties = (items, sort) => {
  const results = [...items];

  if (sort === "price-asc") results.sort((a, b) => a.price - b.price);
  else if (sort === "price-desc") results.sort((a, b) => b.price - a.price);
  else if (sort === "rating") results.sort((a, b) => b.rating - a.rating);
  else if (sort === "distance") results.sort((a, b) => a.distanceKm - b.distanceKm);
  else {
    results.sort(
      (a, b) =>
        Number(b.verified) - Number(a.verified) ||
        b.rating - a.rating ||
        b.reviewCount - a.reviewCount,
    );
  }

  return results;
};

const filterAndSort = (items, query) => {
  const destination = normalizeDestination(query.destination);
  const amenities = query.amenities || [];

  const filtered = items.filter(
    (property) =>
      matchesDestination(property, destination) &&
      (!query.type || property.type === query.type) &&
      property.price >= query.minPrice &&
      property.price <= query.maxPrice &&
      property.rating >= query.rating &&
      amenities.every((amenity) => property.amenities.includes(amenity)) &&
      (query.freeCancellation !== "true" || property.freeCancellation) &&
      (!query.maxDistance || property.distanceKm <= query.maxDistance),
  );

  return sortProperties(filtered, query.sort);
};

const paginate = (items, queryParams) =>
  items.slice(queryParams.offset, queryParams.offset + queryParams.limit);

const contextFromDemo = (property) => ({
  property,
  dbId: null,
  maxGuests: property.maxGuests,
  rooms: property.rooms.map((room) => ({
    code: room.id,
    dbId: null,
    price: room.price,
    capacity: room.capacity,
  })),
});

const contextFromRow = (row) => ({
  property: mapPropertyRow(row),
  dbId: row.id,
  maxGuests: row.max_guests,
  rooms: [...(row.rooms || [])]
    .sort((a, b) => a.price - b.price)
    .map((room) => ({
      code: room.code,
      dbId: room.id,
      price: room.price,
      capacity: room.capacity,
    })),
});

export const listProperties = async (queryParams) => {
  if (!isDatabaseEnabled) {
    return paginate(filterAndSort(demoProperties, queryParams), queryParams);
  }

  try {
    const where = ["p.is_published = true", "p.price >= $1", "p.price <= $2", "p.rating >= $3"];
    const params = [queryParams.minPrice, queryParams.maxPrice, queryParams.rating];

    if (queryParams.type) {
      params.push(queryParams.type);
      where.push(`p.type = $${params.length}`);
    }
    if (queryParams.freeCancellation === "true") {
      where.push("p.free_cancellation = true");
    }
    if (queryParams.maxDistance) {
      params.push(queryParams.maxDistance);
      where.push(`p.distance_km <= $${params.length}`);
    }

    const sql = `
      ${PROPERTY_DETAIL_SQL}
      where ${where.join(" and ")}
      order by p.legacy_id asc nulls last, p.created_at asc
      limit 500
    `;

    const { rows } = await query(sql, params);

    // Destination and multi-amenity matching are applied in memory. The demo
    // catalogue is small; move this into SQL/views when the catalogue grows.
    const mapped = rows.map(mapPropertyRow);
    return paginate(filterAndSort(mapped, queryParams), queryParams);
  } catch {
    throw new HttpError(503, "Property data is temporarily unavailable");
  }
};

export const getPropertyContext = async (slug) => {
  const cleanSlug = String(slug || "").trim();

  if (!isDatabaseEnabled) {
    const property = getDemoProperty(cleanSlug);
    return property ? contextFromDemo(property) : null;
  }

  try {
    const { rows } = await query(
      `${PROPERTY_DETAIL_SQL}
       where p.slug = $1 and p.is_published = true
       limit 1`,
      [cleanSlug],
    );

    const row = rows[0];
    return row ? contextFromRow(row) : null;
  } catch {
    throw new HttpError(503, "Property data is temporarily unavailable");
  }
};

const todayIso = () => toIso(new Date());

const eachDate = (startIso, endIso, callback) => {
  let cursor = startIso;
  let guard = 0;
  while (cursor < endIso && guard < 400) {
    callback(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
};

export const getPropertyAvailability = async (slug) => {
  const context = await getPropertyContext(slug);
  if (!context) return null;

  const start = todayIso();
  const end = addDays(start, 60);
  const nightly = context.rooms.length
    ? Math.min(...context.rooms.map((room) => Number(room.price) || 0))
    : 0;

  if (!isDatabaseEnabled) {
    const days = [];
    for (let i = 0; i < 60; i += 1) {
      const date = addDays(start, i);
      days.push({
        date,
        available: ![3, 9, 17, 26].includes(i),
        nightly,
      });
    }
    return { property: context.property.slug, days, sampleData: true };
  }

  // Best-effort: release stale unpaid reservations before computing availability.
  try {
    await query(
      `update public.bookings b
       set status = 'cancelled'::public.booking_status,
           cancelled_at = coalesce(b.cancelled_at, now()),
           payment_status = 'abandoned'::public.payment_status
       where b.status = 'upcoming'
         and b.paid_at is null
         and b.payment_status in ('pending', 'initialized')
         and b.updated_at < (now() - interval '30 minutes')`,
    );
  } catch {
    // Ignore expiry errors; availability should still be computed from current active bookings.
  }

  const roomIds = context.rooms.map((room) => room.dbId).filter(Boolean);
  const unavailable = new Set();

  if (roomIds.length) {
    try {
      const placeholders = roomIds.map((_, index) => `$${index + 1}::uuid`).join(", ");
      const params = [...roomIds, start, end];
      const startIndex = roomIds.length + 1;
      const endIndex = roomIds.length + 2;

      const { rows } = await query(
        `select check_in, check_out
         from public.bookings
         where room_id in (${placeholders})
           and status in ('upcoming', 'confirmed')
           and check_in < $${endIndex}::date
           and check_out > $${startIndex}::date`,
        params,
      );

      for (const booking of rows) {
        const checkIn = String(booking.check_in).slice(0, 10);
        const checkOut = String(booking.check_out).slice(0, 10);
        const from = checkIn > start ? checkIn : start;
        const to = checkOut < end ? checkOut : end;
        eachDate(from, to, (date) => unavailable.add(date));
      }
    } catch {
      throw new HttpError(503, "Availability is temporarily unavailable");
    }
  }

  // Host-managed availability blocks (property-wide or room-specific).
  if (context.dbId) {
    try {
      const params = [context.dbId, start, end];
      let roomFilter = "";
      if (roomIds.length) {
        const roomPlaceholders = roomIds.map((_, index) => `$${index + 4}::uuid`).join(", ");
        roomFilter = `and (b.room_id is null or b.room_id in (${roomPlaceholders}))`;
        params.push(...roomIds);
      } else {
        roomFilter = "and b.room_id is null";
      }

      const { rows } = await query(
        `select b.start_date, b.end_date
         from public.property_availability_blocks b
         where b.property_id = $1::uuid
           ${roomFilter}
           and b.start_date < $3::date
           and b.end_date > $2::date`,
        params,
      );

      for (const block of rows) {
        const blockStart = String(block.start_date).slice(0, 10);
        const blockEnd = String(block.end_date).slice(0, 10);
        const from = blockStart > start ? blockStart : start;
        const to = blockEnd < end ? blockEnd : end;
        eachDate(from, to, (date) => unavailable.add(date));
      }
    } catch {
      // If blocks table/query is unavailable, fall back to booking-based availability.
    }
  }

  const days = [];
  for (let i = 0; i < 60; i += 1) {
    const date = addDays(start, i);
    days.push({
      date,
      available: !unavailable.has(date),
      nightly,
    });
  }

  return { property: context.property.slug, days, sampleData: false };
};