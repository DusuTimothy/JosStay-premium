import crypto from "node:crypto";
import { HttpError } from "../lib/http.js";
import { getClient, isDatabaseEnabled, query } from "../lib/postgres.js";
import { findBookingByReference } from "./bookingStore.js";
import { mapRefundRequestRow } from "./mappers.js";

export const REFUND_REQUEST_STATUSES = [
  "pending_review",
  "approved",
  "refunded",
  "rejected",
  "cancelled",
];

export const REFUND_REQUEST_REASONS = [
  "change_of_plans",
  "booking_cancelled",
  "duplicate_charge",
  "property_not_as_described",
  "host_cancelled",
  "payment_issue",
  "other",
];

const OPEN_STATUSES = ["pending_review", "approved"];
const referenceAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateRefundReference = () => {
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += referenceAlphabet[crypto.randomInt(referenceAlphabet.length)];
  }
  return `JS-RF-${suffix}`;
};

const normalizeStatus = (status, allowed, fallback = null) => {
  const value = String(status || "").trim().toLowerCase();
  return allowed.includes(value) ? value : fallback;
};

const cleanDetails = (details) => {
  const value = String(details || "").trim();
  return value ? value.slice(0, 1000) : null;
};

const cleanNote = (note) => {
  const value = String(note || "").trim();
  return value ? value.slice(0, 1000) : null;
};

const refundAmount = (booking) =>
  Math.max(0, Math.round(Number(booking.total || 0) + Number(booking.paymentFee || 0)));

const refundStayAmount = (booking) => Math.max(0, Math.round(Number(booking.total || 0)));
const refundPaymentFee = (booking) => Math.max(0, Math.round(Number(booking.paymentFee || 0)));

const REFUND_REQUEST_SELECT = `
  select
    rr.*,
    b.status as booking_status,
    b.payment_status as booking_payment_status,
    b.check_in,
    b.check_out,
    b.total as booking_total,
    b.payment_fee as booking_payment_fee,
    b.payment_reference as booking_payment_reference,
    p.name as property_name,
    p.slug as property_slug,
    r.name as room_name,
    nullif(trim(concat_ws(' ', b.guest_first_name, b.guest_last_name)), '') as guest_name,
    b.guest_email,
    requester.full_name as requester_name,
    requester.email as requester_email,
    reviewer.full_name as reviewer_name,
    reviewer.email as reviewer_email,
    refunder.full_name as refunder_name,
    refunder.email as refunder_email
  from public.refund_requests rr
  join public.bookings b on b.id = rr.booking_id
  join public.properties p on p.id = b.property_id
  join public.rooms r on r.id = b.room_id
  left join public.profiles requester on requester.id = rr.user_id
  left join public.profiles reviewer on reviewer.id = rr.reviewed_by
  left join public.profiles refunder on refunder.id = rr.refunded_by
`;

const demoRefundRequests = [];

const demoSummary = (request) => ({
  id: request.id,
  reference: request.reference,
  status: request.status,
  amount: request.amount,
  reason: request.reason,
  refundReference: request.refundReference || null,
  createdAt: request.createdAt,
});

const attachDemoSummary = (request) => {
  const booking = request.__booking;
  if (booking) booking.refundRequest = demoSummary(request);
};

const findDemoBooking = async (auth, bookingReference) => {
  const booking = await findBookingByReference(bookingReference, { auth, includeInternal: true });
  if (!booking) throw new HttpError(404, "Booking not found");
  return booking;
};

const findDemoOpenRequest = (bookingId) =>
  demoRefundRequests.find(
    (request) => request.bookingId === bookingId && OPEN_STATUSES.includes(request.status),
  ) || null;

const buildDetailFromBooking = ({ booking, auth, reason, details, status = "pending_review" }) => ({
  id: crypto.randomUUID(),
  reference: generateRefundReference(),
  bookingId: booking.id || null,
  bookingReference: booking.reference,
  userId: auth.userId || null,
  paymentReference: booking.paymentReference || null,
  stayAmount: refundStayAmount(booking),
  paymentFee: refundPaymentFee(booking),
  amount: refundAmount(booking),
  currency: booking.currency || "NGN",
  reason,
  details: cleanDetails(details),
  status,
  adminNote: null,
  refundReference: null,
  booking: {
    reference: booking.reference,
    status: booking.status || null,
    paymentStatus: booking.paymentStatus || null,
    checkIn: booking.checkIn || null,
    checkOut: booking.checkOut || null,
    total: refundStayAmount(booking),
    paymentFee: refundPaymentFee(booking),
    paymentReference: booking.paymentReference || null,
    propertyName: booking.propertyName || null,
    propertySlug: booking.propertySlug || null,
    roomName: booking.roomName || null,
    guestName: booking.guest
      ? [booking.guest.firstName, booking.guest.lastName].filter(Boolean).join(" ")
      : null,
    guestEmail: booking.guest?.email || null,
  },
  requester: {
    id: auth.userId || null,
    name: null,
    email: auth.email || null,
  },
  reviewer: null,
  refunder: null,
  reviewedAt: null,
  refundedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const getRefundRequestDetail = async (requestId) => {
  if (!isDatabaseEnabled) {
    const request = demoRefundRequests.find((entry) => entry.id === requestId);
    if (!request) throw new HttpError(404, "Refund request not found");
    return { data: request, sampleData: true };
  }

  const { rows } = await query(
    `${REFUND_REQUEST_SELECT} where rr.id = $1::uuid limit 1`,
    [requestId],
  );
  if (!rows[0]) throw new HttpError(404, "Refund request not found");
  return { data: mapRefundRequestRow(rows[0]), sampleData: false };
};

export const getRefundRequestForBooking = async ({ auth, bookingReference }) => {
  const booking = await findBookingByReference(bookingReference, {
    auth,
    includeInternal: true,
  });
  if (!booking) throw new HttpError(404, "Booking not found");

  if (!isDatabaseEnabled) {
    const existing = booking.refundRequest || findDemoOpenRequest(booking.id);
    return { data: existing ? demoSummary(existing) : null, sampleData: true };
  }

  const { rows } = await query(
    `select id, reference, status, amount, reason, refund_reference, admin_note,
            reviewed_at, refunded_at, created_at
     from public.refund_requests
     where booking_id = $1::uuid
     order by created_at desc
     limit 1`,
    [booking.id],
  );

  if (!rows[0]) return { data: null, sampleData: false };
  const row = rows[0];
  return {
    data: {
      id: row.id,
      reference: row.reference,
      status: row.status,
      amount: Number(row.amount || 0),
      reason: row.reason,
      refundReference: row.refund_reference || null,
      adminNote: row.admin_note || null,
      reviewedAt: row.reviewed_at || null,
      refundedAt: row.refunded_at || null,
      createdAt: row.created_at,
    },
    sampleData: false,
  };
};

export const createRefundRequest = async ({ auth, bookingReference, reason, details }) => {
  if (!REFUND_REQUEST_REASONS.includes(reason)) {
    throw new HttpError(400, "Select a valid refund reason");
  }

  const booking = await findBookingByReference(bookingReference, {
    auth,
    includeInternal: true,
  });
  if (!booking) throw new HttpError(404, "Booking not found");
  if (booking.paymentStatus !== "paid") {
    throw new HttpError(400, "Only a paid booking can be refunded");
  }

  const amount = refundAmount(booking);
  if (amount <= 0) throw new HttpError(400, "This booking has no refundable amount");

  if (!isDatabaseEnabled) {
    if (findDemoOpenRequest(booking.id)) {
      throw new HttpError(409, "You already have an open refund request for this booking");
    }
    if (demoRefundRequests.some((request) => request.bookingId === booking.id && request.status === "refunded")) {
      throw new HttpError(409, "This booking has already been refunded");
    }

    const request = buildDetailFromBooking({ booking, auth, reason, details });
    Object.defineProperty(request, "__booking", { value: booking, enumerable: false });
    demoRefundRequests.unshift(request);
    attachDemoSummary(request);
    return { data: request, sampleData: true };
  }

  const client = await getClient();
  try {
    await client.query("begin");
    const locked = await client.query(
      `select id, user_id, reference, status, payment_status, total, payment_fee,
              payment_reference, currency
       from public.bookings
       where reference = $1
       limit 1
       for update`,
      [bookingReference],
    );
    const row = locked.rows[0];
    if (!row) throw new HttpError(404, "Booking not found");
    if (auth.role !== "admin" && String(row.user_id) !== String(auth.userId)) {
      throw new HttpError(404, "Booking not found");
    }
    if (row.payment_status !== "paid") {
      throw new HttpError(400, "Only a paid booking can be refunded");
    }

    const existing = await client.query(
      `select id, status from public.refund_requests
       where booking_id = $1::uuid
       order by created_at desc
       limit 1`,
      [row.id],
    );
    if (existing.rows[0]?.status === "refunded") {
      throw new HttpError(409, "This booking has already been refunded");
    }
    if (existing.rows[0] && OPEN_STATUSES.includes(existing.rows[0].status)) {
      throw new HttpError(409, "You already have an open refund request for this booking");
    }

    const stayAmount = Math.max(0, Math.round(Number(row.total || 0)));
    const paymentFee = Math.max(0, Math.round(Number(row.payment_fee || 0)));
    const totalAmount = stayAmount + paymentFee;
    if (totalAmount <= 0) {
      throw new HttpError(400, "This booking has no refundable amount");
    }

    const inserted = await client.query(
      `insert into public.refund_requests (
        reference, booking_id, booking_reference, user_id, payment_reference,
        stay_amount, payment_fee, amount, currency, reason, details, status
      ) values (
        $1, $2::uuid, $3, $4::uuid, $5, $6, $7, $8, $9, $10, $11, 'pending_review'
      )
      returning id`,
      [
        generateRefundReference(),
        row.id,
        row.reference,
        row.user_id,
        row.payment_reference || null,
        stayAmount,
        paymentFee,
        totalAmount,
        row.currency || "NGN",
        reason,
        cleanDetails(details),
      ],
    );

    await client.query("commit");
    return { data: (await getRefundRequestDetail(inserted.rows[0].id)).data, sampleData: false };
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {}
    if (error?.code === "23505") {
      throw new HttpError(409, "You already have an open refund request for this booking");
    }
    throw error;
  } finally {
    client.release();
  }
};

export const cancelRefundRequest = async ({ auth, bookingReference }) => {
  if (!isDatabaseEnabled) {
    const booking = await findDemoBooking(auth, bookingReference);
    const request = demoRefundRequests.find(
      (entry) => entry.bookingId === booking.id && entry.status === "pending_review",
    );
    if (!request) throw new HttpError(409, "No pending refund request to cancel");
    request.status = "cancelled";
    request.updatedAt = new Date().toISOString();
    attachDemoSummary(request);
    return { data: request, sampleData: true };
  }

  const { rows: bookings } = await query(
    `select b.id
     from public.bookings b
     where b.reference = $1
       and (b.user_id = $2::uuid or $3::boolean = true)
     limit 1`,
    [bookingReference, auth.userId, auth.role === "admin"],
  );
  if (!bookings[0]) throw new HttpError(404, "Booking not found");

  const { rows } = await query(
    `update public.refund_requests
     set status = 'cancelled'
     where booking_id = $1::uuid
       and status = 'pending_review'
     returning id`,
    [bookings[0].id],
  );
  if (!rows[0]) throw new HttpError(409, "No pending refund request to cancel");
  return { data: (await getRefundRequestDetail(rows[0].id)).data, sampleData: false };
};

export const listAdminRefundRequests = async ({ status, limit = 50 } = {}) => {
  const filter = normalizeStatus(status, REFUND_REQUEST_STATUSES);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

  if (!isDatabaseEnabled) {
    const data = demoRefundRequests
      .filter((request) => !filter || request.status === filter)
      .slice(0, safeLimit);
    return { data, count: data.length, sampleData: true };
  }

  const params = [];
  let where = "";
  if (filter) {
    params.push(filter);
    where = ` where rr.status = $${params.length}`;
  }
  params.push(safeLimit);

  const { rows } = await query(
    `${REFUND_REQUEST_SELECT}
     ${where}
     order by rr.created_at desc
     limit $${params.length}`,
    params,
  );

  const data = rows.map(mapRefundRequestRow);
  return { data, count: data.length, sampleData: false };
};

const findAdminRequest = async (requestId) => {
  const detail = await getRefundRequestDetail(requestId);
  return detail;
};

export const approveRefundRequest = async ({ requestId, reviewerUserId, note }) => {
  if (!isDatabaseEnabled) {
    const request = demoRefundRequests.find((entry) => entry.id === requestId);
    if (!request) throw new HttpError(404, "Refund request not found");
    if (request.status !== "pending_review") {
      throw new HttpError(409, "Only a pending request can be approved");
    }
    request.status = "approved";
    request.adminNote = cleanNote(note);
    request.reviewer = { id: reviewerUserId || null, name: null, email: null };
    request.reviewedAt = new Date().toISOString();
    request.updatedAt = request.reviewedAt;
    attachDemoSummary(request);
    return { data: request, sampleData: true };
  }

  const existing = await query(
    `select id, status from public.refund_requests where id = $1::uuid limit 1`,
    [requestId],
  );
  if (!existing.rows[0]) throw new HttpError(404, "Refund request not found");
  if (existing.rows[0].status !== "pending_review") {
    throw new HttpError(409, "Only a pending request can be approved");
  }

  await query(
    `update public.refund_requests
     set status = 'approved', reviewed_by = $2::uuid, reviewed_at = now(), admin_note = $3
     where id = $1::uuid`,
    [requestId, reviewerUserId || null, cleanNote(note)],
  );
  return findAdminRequest(requestId);
};

export const rejectRefundRequest = async ({ requestId, reviewerUserId, note }) => {
  const adminNote = cleanNote(note);
  if (!adminNote) throw new HttpError(400, "A rejection note is required");

  if (!isDatabaseEnabled) {
    const request = demoRefundRequests.find((entry) => entry.id === requestId);
    if (!request) throw new HttpError(404, "Refund request not found");
    if (!["pending_review", "approved"].includes(request.status)) {
      throw new HttpError(409, "Only a pending or approved request can be rejected");
    }
    request.status = "rejected";
    request.adminNote = adminNote;
    request.reviewer = { id: reviewerUserId || null, name: null, email: null };
    request.reviewedAt = new Date().toISOString();
    request.updatedAt = request.reviewedAt;
    attachDemoSummary(request);
    return { data: request, sampleData: true };
  }

  const existing = await query(
    `select id, status from public.refund_requests where id = $1::uuid limit 1`,
    [requestId],
  );
  if (!existing.rows[0]) throw new HttpError(404, "Refund request not found");
  if (!["pending_review", "approved"].includes(existing.rows[0].status)) {
    throw new HttpError(409, "Only a pending or approved request can be rejected");
  }

  await query(
    `update public.refund_requests
     set status = 'rejected', reviewed_by = $2::uuid, reviewed_at = now(), admin_note = $3
     where id = $1::uuid`,
    [requestId, reviewerUserId || null, adminNote],
  );
  return findAdminRequest(requestId);
};

export const markRefundRequestRefunded = async ({
  requestId,
  refundedByUserId,
  refundReference,
  note,
}) => {
  const reference = String(refundReference || "").trim();
  if (!reference) throw new HttpError(400, "A Paystack refund reference is required");
  if (reference.length > 120) throw new HttpError(400, "Refund reference is too long");

  if (!isDatabaseEnabled) {
    const request = demoRefundRequests.find((entry) => entry.id === requestId);
    if (!request) throw new HttpError(404, "Refund request not found");
    if (request.status !== "approved") {
      throw new HttpError(409, "Only an approved request can be marked refunded");
    }
    request.status = "refunded";
    request.refundReference = reference;
    request.refunder = { id: refundedByUserId || null, name: null, email: null };
    request.refundedAt = new Date().toISOString();
    request.adminNote = cleanNote(note) || request.adminNote || null;
    request.updatedAt = request.refundedAt;
    const booking = request.__booking;
    if (booking && ["upcoming", "confirmed"].includes(booking.status)) {
      booking.status = "cancelled";
      booking.cancelledAt = request.refundedAt;
      if (request.booking) request.booking.status = "cancelled";
    }
    attachDemoSummary(request);
    return { data: request, sampleData: true };
  }

  const existing = await query(
    `select id, status from public.refund_requests where id = $1::uuid limit 1`,
    [requestId],
  );
  if (!existing.rows[0]) throw new HttpError(404, "Refund request not found");
  if (existing.rows[0].status !== "approved") {
    throw new HttpError(409, "Only an approved request can be marked refunded");
  }

  await query(
    `update public.refund_requests
     set status = 'refunded',
         refunded_by = $2::uuid,
         refunded_at = now(),
         refund_reference = $3,
         admin_note = coalesce($4, admin_note)
     where id = $1::uuid`,
    [requestId, refundedByUserId || null, reference, cleanNote(note)],
  );

  // A refunded stay should release the room. Completed/cancelled bookings are
  // left untouched so historical stays stay intact.
  await query(
    `update public.bookings b
     set status = 'cancelled'::public.booking_status,
         cancelled_at = coalesce(b.cancelled_at, now())
     from public.refund_requests rr
     where rr.id = $1::uuid
       and b.id = rr.booking_id
       and b.status in ('upcoming', 'confirmed')`,
    [requestId],
  );

  return findAdminRequest(requestId);
};
