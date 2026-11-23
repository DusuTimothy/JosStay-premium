import { HttpError } from "../lib/http.js";
import { isDatabaseEnabled, query } from "../lib/postgres.js";

const toRefundReviewItem = (row) => {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    paymentReference: row.payment_reference,
    provider: row.provider,
    bookingReference: row.booking_reference,
    bookingId: row.booking_id,
    amount: Number(row.amount || 0),
    currency: row.currency || "NGN",
    paymentStatus: row.payment_status,
    channel: row.channel || null,
    paidAt: row.paid_at,
    initializedAt: row.initialized_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    requiresRefund: metadata.requiresRefund === true,
    refundReason: metadata.refundReason || null,
    refundResolved: metadata.refundResolved === true,
    refundResolvedAt: metadata.refundResolvedAt || null,
    refundResolvedBy: metadata.refundResolvedBy || null,
    refundResolutionNote: metadata.refundResolutionNote || null,
    booking: row.booking_ref
      ? {
          reference: row.booking_ref,
          status: row.booking_status,
          paymentStatus: row.booking_payment_status,
          checkIn: row.check_in,
          checkOut: row.check_out,
          total: Number(row.booking_total || 0),
          currency: row.booking_currency || "NGN",
          guestName: [row.guest_first_name, row.guest_last_name].filter(Boolean).join(" ").trim() || null,
          guestEmail: row.guest_email || null,
          propertyName: row.property_name || null,
          roomName: row.room_name || null,
        }
      : null,
  };
};

export const listRefundReviewPayments = async ({ status = "open", limit = 50 } = {}) => {
  if (!isDatabaseEnabled) {
    throw new HttpError(503, "Refund review service is unavailable in sample mode");
  }

  const normalizedStatus = String(status || "open").toLowerCase();
  if (!["open", "resolved", "all"].includes(normalizedStatus)) {
    throw new HttpError(400, "Invalid refund review status filter");
  }

  const params = [];
  let where = "where p.metadata->>'requiresRefund' = 'true'";
  if (normalizedStatus === "open") {
    where += " and coalesce(p.metadata->>'refundResolved', 'false') <> 'true'";
  } else if (normalizedStatus === "resolved") {
    where += " and coalesce(p.metadata->>'refundResolved', 'false') = 'true'";
  }

  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
  const limitParam = `$${params.length}`;

  const { rows } = await query(
    `select
      p.reference as payment_reference,
      p.provider,
      p.booking_reference,
      p.booking_id,
      p.amount,
      p.currency,
      p.status as payment_status,
      p.channel,
      p.paid_at,
      p.initialized_at,
      p.created_at,
      p.updated_at,
      p.metadata,
      b.reference as booking_ref,
      b.status as booking_status,
      b.payment_status as booking_payment_status,
      b.check_in,
      b.check_out,
      b.total as booking_total,
      b.currency as booking_currency,
      b.guest_first_name,
      b.guest_last_name,
      b.guest_email,
      prop.name as property_name,
      rm.name as room_name
    from public.payments p
    left join public.bookings b on b.id = p.booking_id or b.reference = p.booking_reference
    left join public.properties prop on prop.id = b.property_id
    left join public.rooms rm on rm.id = b.room_id
    ${where}
    order by
      case when coalesce(p.metadata->>'refundResolved', 'false') = 'true' then 1 else 0 end,
      p.paid_at desc nulls last,
      p.created_at desc
    limit ${limitParam}`,
    params,
  );

  const data = rows.map(toRefundReviewItem);
  const unresolvedCount = data.filter((item) => item.requiresRefund && !item.refundResolved).length;
  return { data, count: data.length, unresolvedCount, sampleData: false };
};

export const resolveRefundReviewPayment = async ({
  paymentReference,
  resolvedByUserId,
  note,
}) => {
  if (!isDatabaseEnabled) {
    throw new HttpError(503, "Refund review service is unavailable in sample mode");
  }

  const reference = String(paymentReference || "").trim();
  if (!reference) throw new HttpError(400, "Payment reference is required");

  const cleanNote = note ? String(note).trim().slice(0, 2000) : null;

  const { rows } = await query(
    `update public.payments
     set metadata = jsonb_set(
       jsonb_set(
         jsonb_set(
           jsonb_set(
             coalesce(metadata, '{}'::jsonb),
             '{refundResolved}', 'true'::jsonb, true
           ),
           '{refundResolvedAt}', to_jsonb(now()::text), true
         ),
         '{refundResolvedBy}', to_jsonb($2::text), true
       ),
       '{refundResolutionNote}', to_jsonb($3::text), true
     ),
     updated_at = now()
     where provider = 'paystack'
       and reference = $1
       and coalesce(metadata->>'requiresRefund', 'false') = 'true'
     returning
       reference as payment_reference,
       provider,
       booking_reference,
       booking_id,
       amount,
       currency,
       status as payment_status,
       channel,
       paid_at,
       initialized_at,
       created_at,
       updated_at,
       metadata`,
    [reference, resolvedByUserId || null, cleanNote],
  );

  if (!rows[0]) {
    throw new HttpError(404, "Flagged payment not found");
  }

  // Return enriched row for UI consistency.
  const { rows: enriched } = await query(
    `select
      p.reference as payment_reference,
      p.provider,
      p.booking_reference,
      p.booking_id,
      p.amount,
      p.currency,
      p.status as payment_status,
      p.channel,
      p.paid_at,
      p.initialized_at,
      p.created_at,
      p.updated_at,
      p.metadata,
      b.reference as booking_ref,
      b.status as booking_status,
      b.payment_status as booking_payment_status,
      b.check_in,
      b.check_out,
      b.total as booking_total,
      b.currency as booking_currency,
      b.guest_first_name,
      b.guest_last_name,
      b.guest_email,
      prop.name as property_name,
      rm.name as room_name
    from public.payments p
    left join public.bookings b on b.id = p.booking_id or b.reference = p.booking_reference
    left join public.properties prop on prop.id = b.property_id
    left join public.rooms rm on rm.id = b.room_id
    where p.provider = 'paystack' and p.reference = $1
    limit 1`,
    [reference],
  );

  return { data: toRefundReviewItem(enriched[0] || rows[0]), sampleData: false };
};
