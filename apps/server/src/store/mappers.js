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
        emailVerified: Boolean(row.email_verified),
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

export const mapBookingRow = (row, { includeInternal = false } = {}) => {
  const property = first(row.properties) || {};
  const room = first(row.rooms) || {};

  const paymentStatus = row.payment_status || row.paymentStatus || null;
  const paymentReference = row.payment_reference || row.paymentReference || null;
  const paymentProvider = row.payment_provider || row.paymentProvider || null;
  const paidAt = row.paid_at || row.paidAt || null;

  return {
    ...(includeInternal && row.id ? { id: row.id } : {}),
    reference: row.reference,
    propertySlug: property.slug || row.propertySlug,
    propertyName: property.name || row.propertyName,
    roomId: room.code || row.roomId,
    roomName: room.name || row.roomName,
    checkIn: toDateString(row.check_in || row.checkIn),
    checkOut: toDateString(row.check_out || row.checkOut),
    guests: row.guests,
    airportPickup: row.airport_pickup ?? row.airportPickup ?? false,
    paymentMethod: row.payment_method || row.paymentMethod,
    ...(row.requests ? { requests: row.requests } : {}),
    status: row.status,
    total: row.total,
    paymentFee: Math.max(0, Math.round(Number(row.payment_fee ?? row.paymentFee ?? 0) || 0)),
    currency: row.currency || "NGN",
    quote: row.quote,
    createdAt: toDateTimeString(row.created_at || row.createdAt),
    ...(row.cancelled_at || row.cancelledAt
      ? { cancelledAt: toDateTimeString(row.cancelled_at || row.cancelledAt) }
      : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(paymentReference ? { paymentReference } : {}),
    ...(paymentProvider ? { paymentProvider } : {}),
    ...(paidAt ? { paidAt: toDateTimeString(paidAt) } : {}),
    guest: row.guest || {
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

export const mapHostEarningRow = (row) => ({
  id: row.id,
  bookingId: row.booking_id,
  bookingReference: row.booking_reference,
  gross: Number(row.gross || 0),
  commission: Number(row.commission || 0),
  net: Number(row.net || 0),
  currency: row.currency || "NGN",
  status: row.status,
  availableAt: toDateTimeString(row.available_at),
  reservedAmount: Number(row.reserved_amount || 0),
  paidAmount: Number(row.paid_amount || 0),
  reversedAt: toDateTimeString(row.reversed_at),
  createdAt: toDateTimeString(row.created_at),
});

export const mapBankAccountRow = (row) => ({
  id: row.id,
  bankCode: row.bank_code,
  bankName: row.bank_name,
  accountNumberMasked: row.account_number_masked,
  accountName: row.account_name,
  provider: row.provider,
  status: row.status,
  verifiedAt: toDateTimeString(row.verified_at),
  createdAt: toDateTimeString(row.created_at),
});

export const mapPayoutRequestRow = (row) => ({
  id: row.id,
  reference: row.reference,
  amount: Number(row.amount || 0),
  currency: row.currency || "NGN",
  status: row.status,
  hostNote: row.host_note || null,
  reviewNote: row.review_note || null,
  settlementNote: row.settlement_note || null,
  bank: row.bank_snapshot && typeof row.bank_snapshot === "object" ? row.bank_snapshot : {},
  provider: row.provider || null,
  providerReference: row.provider_reference || null,
  host: row.host_name || row.host_email
    ? {
        id: row.host_id || null,
        name: row.host_name || null,
        email: row.host_email || null,
      }
    : null,
  earnings: Array.isArray(row.earnings) ? row.earnings : [],
  reviewedBy: row.reviewed_by || null,
  reviewedAt: toDateTimeString(row.reviewed_at),
  settledBy: row.settled_by || null,
  settledAt: toDateTimeString(row.settled_at),
  createdAt: toDateTimeString(row.created_at),
  updatedAt: toDateTimeString(row.updated_at),
});
