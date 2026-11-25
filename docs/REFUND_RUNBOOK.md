# Refund Review Runbook

JosStay collects **guest refund requests** and flags some Paystack payments for **manual refund review**. The app does **not** automatically issue refunds.

## Where to look

- Admin UI: `/account/admin/refunds` (admin account required).
- Guest requests API: `GET /api/admin/refund-requests` (admin auth required).
- Payment flags API: `GET /api/admin/payments/refunds?status=open` (admin auth required).
- Database: `public.refund_requests` and `public.payments.metadata.requiresRefund = true`.

Open payment flags are payments where `requiresRefund=true` and `refundResolved` is not `true`.

## Guest refund requests

A guest starts a request from **My bookings → Request refund**. The app records it in `public.refund_requests` with:

- a request reference (`JS-RF-…`),
- the booking and Paystack payment references,
- the full refundable amount (`stay_amount + payment_fee`),
- the reason and optional guest details,
- who reviewed/refunded it and when.

Only **paid** bookings can be requested. A booking can have only one open request at a time (`pending_review` or `approved`). Guests can cancel their own request while it is still `pending_review`.

Lifecycle:

```text
pending_review → approved → refunded
pending_review → rejected
pending_review → cancelled (guest)
```

1. Open the **Guest requests** tab in `/account/admin/refunds`.
2. Verify the booking and Paystack transaction.
3. **Approve** the request (optional note) if the refund is valid.
4. Issue the refund **manually in the Paystack dashboard** for the full charged amount.
5. **Mark refunded** with the Paystack refund reference and a settlement note. This also cancels the booking when it is still `upcoming` or `confirmed`, releasing the room. Completed/cancelled bookings are left untouched.
6. **Reject** with a note if the request is not eligible; the guest sees the note in My bookings.

Statuses are only records of a manual process. No endpoint calls Paystack's refund API and no money moves automatically.

## Why a payment gets flagged

| Reason | Meaning | Typical action |
|---|---|---|
| `duplicate_successful_charge` | A successful Paystack charge arrived for a booking that already has a different paid payment reference. | Verify both transactions in Paystack. Refund the duplicate charge if it actually settled. Keep the original valid booking payment. |
| `stay_no_longer_available` | Payment succeeded after the booking expired/was abandoned and the dates/room are no longer available. | Verify the charge in Paystack. Refund the guest. Do not reactivate the booking unless you have manually confirmed availability. |
| `amount_mismatch` | The paid amount/currency did not match the expected booking amount. | Verify the transaction in Paystack and booking totals. Refund or reconcile manually before making any booking active. |
| `booking_cancelled` / `booking_abandoned` | A successful charge arrived for a booking that is not payable. | Verify in Paystack. Refund unless there is a clear manual reconciliation reason. |

## Payment fee on refunds

Guests are charged the stay amount **plus a Paystack processing fee** (`bookings.payment_fee`). On a refund, return the **full charged amount** (`bookings.total + bookings.payment_fee`). Paystack generally does not return its processing fee, so the platform absorbs it. Do not deduct the processing fee from the guest's refund.

When refunding from the Paystack dashboard, use the transaction's full settled amount, not just the stay total.

## Manual refund process

1. **Open `/admin/refunds`** and review the open item.
2. **Verify in Paystack dashboard** using the Paystack payment reference shown in the UI.
   - Confirm the transaction is actually successful/settled.
   - Confirm amount, customer email, and date/time.
3. **Check the booking context** in the admin UI:
   - Booking reference, guest, property/room, check-in/check-out, booking status/payment status.
4. **Decide the action**:
   - If money was captured incorrectly/should be returned: issue a refund from the Paystack dashboard (or your approved finance process).
   - If it was a false alarm or already handled outside the app: record the reason clearly.
5. **Mark resolved in JosStay** with a note. Include:
   - what you checked,
   - whether a refund was issued,
   - Paystack refund/reference ID or dashboard evidence,
   - who approved it, if applicable.
6. **Do not silently ignore duplicates.** Every flagged item should be either refunded, reconciled, or explicitly documented.

## Resolution notes

Marking resolved in JosStay only updates the payment metadata for tracking. It does **not** call Paystack and does **not** move money.

Suggested note format:

```text
Checked Paystack tx <reference> on YYYY-MM-DD. Refund issued in Paystack dashboard, refund ref <id>. Guest notified by <name/channel>.
```

## Escalate when

- The charge is successful in Paystack but missing/unclear in JosStay.
- The amount/currency is wrong.
- The same guest was charged multiple times.
- The guest claims payment but booking is not active.
- You are unsure whether availability can be restored.

In these cases, pause any manual booking reactivation, preserve evidence (Paystack reference, booking reference, logs/request IDs), and escalate to engineering/operations.