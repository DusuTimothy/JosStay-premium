const first = (value) => (Array.isArray(value) ? value[0] : value);

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const toDateString = (value) => {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const toDateTimeString = (value) => {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

const monthLabel = (isoDate) => {
  if (!isoDate) return "";
  const date = toDateString(isoDate);
  const [year, month] = date.split("-");
  const index = Number(month) - 1;
  return months[index] ? `${months[index]} ${year}` : "";
};

export const mapProfile = (row) =>
  row
    ? {
        id: row.id,
        name: row.full_name,
        email: row.email,
        role: row.role,
      }
    : null;

export const mapPropertyRow = (row) => {
  const host = first(row.hosts) || {};

  const images = [...(row.property_images || [])]
    .sort((a, b) => a.position - b.position)
    .map((image) => image.url);

  const rooms = [...(row.rooms || [])]
    .sort((a, b) => a.price - b.price)
    .map((room) => ({
      id: room.code,
      name: room.name,
      price: room.price,
      capacity: room.capacity,
      beds: room.beds,
      size: room.size,
      refundable: Boolean(room.refundable),
    }));

  const amenities = (row.property_amenities || [])
    .map((entry) => first(entry.amenities)?.id || entry.amenity_id)
    .filter(Boolean);

  const reviews = [...(row.property_reviews || [])]
    .sort((a, b) => String(toDateString(b.reviewed_on)).localeCompare(String(toDateString(a.reviewed_on))))
    .map((review) => ({
      name: review.guest_name,
      date: monthLabel(review.reviewed_on),
      rating: review.rating,
      quote: review.quote,
    }));

  return {
    id: row.legacy_id ?? row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    area: row.area,
    address: row.address,
    price: row.price,
    cleaningFee: row.cleaning_fee,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    verified: row.verified,
    freeCancellation: row.free_cancellation,
    distanceKm: Number(row.distance_km),
    ...(row.badge ? { badge: row.badge } : {}),
    maxGuests: row.max_guests,
    summary: row.summary,
    description: row.description,
    amenities,
    images,
    host: {
      name: host.name || "",
      joined: host.joined_year ? String(host.joined_year) : "",
      superhost: Boolean(host.superhost),
    },
    rooms,
    houseRules: row.house_rules || [],
    reviews,
  };
};

export const mapBookingRow = (row) => {
  const property = first(row.properties) || {};
  const room = first(row.rooms) || {};

  return {
    reference: row.reference,
    propertySlug: property.slug,
    propertyName: property.name,
    roomId: room.code,
    roomName: room.name,
    checkIn: toDateString(row.check_in),
    checkOut: toDateString(row.check_out),
    guests: row.guests,
    airportPickup: row.airport_pickup,
    paymentMethod: row.payment_method,
    ...(row.requests ? { requests: row.requests } : {}),
    status: row.status,
    total: row.total,
    currency: row.currency,
    quote: row.quote,
    createdAt: toDateTimeString(row.created_at),
    ...(row.cancelled_at ? { cancelledAt: toDateTimeString(row.cancelled_at) } : {}),
    guest: {
      firstName: row.guest_first_name,
      lastName: row.guest_last_name,
      email: row.guest_email,
      phone: row.guest_phone,
    },
  };
};

export const mapPayoutRow = (row) => ({
  reference: row.reference,
  gross: row.gross,
  commission: row.commission,
  net: row.net,
  status: row.status,
  ...(row.scheduled_for ? { scheduledFor: toDateString(row.scheduled_for) } : {}),
  createdAt: toDateTimeString(row.created_at),
});
