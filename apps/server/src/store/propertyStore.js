import {
  addDays,
  getProperty as getDemoProperty,
  properties as demoProperties,
  toIso,
} from "@josstay/shared";
import { HttpError } from "../lib/http.js";
import { db, isSupabaseEnabled } from "../lib/supabase.js";
import { mapPropertyRow } from "./mappers.js";

const PROPERTY_SELECT = `
  id,
  legacy_id,
  slug,
  name,
  type,
  area,
  address,
  price,
  cleaning_fee,
  rating,
  review_count,
  verified,
  free_cancellation,
  distance_km,
  badge,
  max_guests,
  summary,
  description,
  house_rules,
  is_published,
  hosts ( name, joined_year, superhost ),
  property_images ( url, position ),
  rooms ( id, code, name, price, capacity, beds, size, refundable ),
  property_amenities ( amenity_id, amenities ( id, label ) ),
  property_reviews ( guest_name, reviewed_on, rating, quote )
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

const paginate = (items, query) =>
  items.slice(query.offset, query.offset + query.limit);

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

export const listProperties = async (query) => {
  if (!isSupabaseEnabled) {
    return paginate(filterAndSort(demoProperties, query), query);
  }

  let request = db()
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("is_published", true)
    .gte("price", query.minPrice)
    .lte("price", query.maxPrice)
    .gte("rating", query.rating)
    .order("legacy_id", { ascending: true })
    .limit(500);

  if (query.type) request = request.eq("type", query.type);
  if (query.freeCancellation === "true") {
    request = request.eq("free_cancellation", true);
  }
  if (query.maxDistance) {
    request = request.lte("distance_km", query.maxDistance);
  }

  const { data, error } = await request;

  if (error) {
    throw new HttpError(503, "Property data is temporarily unavailable");
  }

  // Destination and multi-amenity matching are applied in memory. The demo
  // catalogue is small; move this into an RPC/view when the catalogue grows.
  const mapped = (data || []).map(mapPropertyRow);
  return paginate(filterAndSort(mapped, query), query);
};

export const getPropertyContext = async (slug) => {
  const cleanSlug = String(slug || "").trim();

  if (!isSupabaseEnabled) {
    const property = getDemoProperty(cleanSlug);
    return property ? contextFromDemo(property) : null;
  }

  const { data, error } = await db()
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("slug", cleanSlug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    throw new HttpError(503, "Property data is temporarily unavailable");
  }

  return data ? contextFromRow(data) : null;
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

  if (!isSupabaseEnabled) {
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

  const roomIds = context.rooms.map((room) => room.dbId).filter(Boolean);
  const unavailable = new Set();

  if (roomIds.length) {
    const { data, error } = await db()
      .from("bookings")
      .select("check_in, check_out")
      .in("room_id", roomIds)
      .in("status", ["upcoming", "confirmed"])
      .lt("check_in", end)
      .gt("check_out", start);

    if (error) {
      throw new HttpError(503, "Availability is temporarily unavailable");
    }

    for (const booking of data || []) {
      const from = booking.check_in > start ? booking.check_in : start;
      const to = booking.check_out < end ? booking.check_out : end;
      eachDate(from, to, (date) => unavailable.add(date));
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
