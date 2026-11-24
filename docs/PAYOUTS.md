# Host Payouts — Design Spec

_Status: proposed. Phase 1 not implemented; current behavior is support-only._

## 1. Purpose

Give hosts a real payout flow and give admins a reviewable, auditable queue — without letting money move on client input.

**Goals**
- Hosts can see what they've earned, what's available, and request a payout.
- Admins review requests, approve or reject, and record settlement.
- Every naira is traceable from booking → earning → payout.
- No double payouts, no payout of refundable money, no client-controlled amounts.

**Non-goals (phase 1)**
- Automatic Paystack transfers.
- Multi-currency payouts.
- Partial earning splits across multiple payout methods.
- Paystack split/subaccount settlement at charge time.

## 2. Current state

- `public.payouts` exists (`host_id`, `reference`, `gross`, `commission`, `net`, `status`, `scheduled_for`) with `payout_status` = `scheduled | paid | on_hold | failed`.
- Host dashboard shows payout history and a "Request payout" button that only displays a toast.
- `GET /api/host/payouts` returns payout records for the host (or all for admin).
- No bank details, no requests, no ledger, no admin queue.

## 3. Design principles

1. **Ledger first.** A payout is a transfer of already-earned, already-available money. Never compute payouts from raw booking totals at request time.
2. **Server-authoritative.** Amounts, balances, commissions, and bank details are all resolved server-side.
3. **Reserve on request.** Requesting a payout immediately reserves the amount so it cannot be double-spent.
4. **Manual by default.** Phase 1 keeps money movement manual; the app records and audits it.
5. **Idempotent.** Every state-changing endpoint accepts `Idempotency-Key` and is safe to retry.
6. **Auditable.** Store requester, reviewer, resolver, timestamps, notes, and provider references.

## 4. Money model

### Commission
Platform commission is **10%** of gross, matching the current dashboard copy. Store commission per earning row (do not recompute later, so rate changes don't rewrite history).

### Earning availability
An earning becomes withdrawable only when:
- the booking is **paid** (`bookings.payment_status = 'paid'`), and
- the stay has started (`check_in` reached) plus a hold period, and
- the booking is not cancelled/refunded.

Default: `available_at = check_in + PAYOUT_HOLD_HOURS` (default **24h**, configurable). Rationale: hosts get paid promptly after check-in, while limiting no-show/refund exposure.

Optional later: keep a rolling reserve (e.g. 10% held for N days) if refunds become common.

### Balances
```
available_balance = sum(earnings.status = 'available')
                  + sum(earnings.status = 'reserved')      -- shown as reserved, not withdrawable
paid_total        = sum(earnings.status = 'paid')
```
`withdrawable = sum(available)`. Reservations move rows from `available` → `reserved`; settlement moves `reserved` → `paid`; rejection/cancellation moves `reserved` → `available`.

### Minimums
- Minimum request: **₦10,000** (configurable via `PAYOUT_MIN_AMOUNT`).
- Maximum: withdrawable balance.
- One open request per host at a time (simplifies reconciliation).

## 5. Data model

### 5.1 `host_earnings`
One row per paid booking, created when a booking is confirmed paid (or lazily on first read for historical data).

```sql
create table if not exists public.host_earnings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  booking_reference text not null,
  gross integer not null check (gross >= 0),
  commission integer not null check (commission >= 0),
  net integer not null check (net = gross - commission),
  currency char(3) not null default 'NGN',
  status text not null default 'pending'
    check (status in ('pending', 'available', 'reserved', 'paid', 'reversed')),
  available_at timestamptz,
  payout_request_id uuid,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id)
);

create index if not exists host_earnings_host_status_idx
  on public.host_earnings (host_id, status, available_at);
```

`payout_request_id` is a plain UUID (not FK) to avoid circular dependencies; add the FK after `payout_requests` exists if desired.

### 5.2 `host_bank_accounts`
```sql
create table if not exists public.host_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts (id) on delete cascade,
  bank_code text not null,
  bank_name text not null,
  account_number_masked text not null,     -- e.g. ******6789
  account_name text not null,              -- from provider resolve, never client input
  provider text not null default 'paystack',
  recipient_code text,                     -- Paystack transfer recipient (phase 2)
  status text not null default 'verified'
    check (status in ('pending', 'verified', 'disabled')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists host_bank_accounts_active_key
  on public.host_bank_accounts (host_id) where status <> 'disabled';
```

Notes:
- Never return the full account number to the client after creation; return the masked value.
- Store the full number only if required for re-resolution, and encrypt at rest or rely on the provider recipient code instead.
- Bank edits are blocked while a request is open.

### 5.3 `payout_requests`
```sql
create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts (id) on delete cascade,
  reference text not null unique,          -- e.g. JS-PO-XXXXXX
  amount integer not null check (amount > 0),
  currency char(3) not null default 'NGN',
  bank_account_id uuid references public.host_bank_accounts (id) on delete set null,
  bank_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'processing', 'paid', 'rejected', 'cancelled', 'failed')),
  host_note text,
  review_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  settled_by uuid references public.profiles (id) on delete set null,
  settled_at timestamptz,
  provider text,
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payout_requests_host_idx
  on public.payout_requests (host_id, created_at desc);
create index if not exists payout_requests_status_idx
  on public.payout_requests (status, created_at);
```

`bank_snapshot` freezes bank details at request time so later edits don't change where money went.

### 5.4 Relationship to existing `payouts`
Two options:
- **A (recommended):** keep `payouts` as the settlement record. On `mark-paid`, insert a `payouts` row (`status = 'paid'`, `reference` from the request) and link earnings to it. Add `payout_request_id` to `payouts`.
- **B:** extend `payouts` itself with request fields and drop the separate table.

Option A keeps the existing host payout-history UI working with minimal changes.

## 6. Status state machines

### Earning
```
pending ──(paid + available_at reached)──> available
available ──(request created)──> reserved
reserved ──(request rejected/cancelled)──> available
reserved ──(request paid)──> paid
any ──(refund/chargeback)──> reversed
```

### Payout request
```
pending_review ──approve──> approved
pending_review ──reject──> rejected        (releases earnings)
pending_review ──host cancel──> cancelled  (releases earnings)
approved ──mark-paid (phase 1)──> paid
approved ──transfer initiated (phase 2)──> processing
processing ──transfer.success──> paid
processing ──transfer.failed──> failed     (releases earnings)
paid ──transfer.reversed──> failed         (admin follow-up)
```

Terminal states: `paid`, `rejected`, `cancelled`. `failed` is terminal for the request but requires admin action to release or re-request.

## 7. API design

All endpoints require auth. Host endpoints require `host` role and the caller's own host record. Admin endpoints require `admin`. All mutations require `X-JosStay-Request: 1` (existing CSRF guard) and support `Idempotency-Key`.

### Host
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/host/payouts/summary` | `{ withdrawable, reserved, paidTotal, pendingEarnings, currency, minimum }` |
| GET | `/api/host/payouts/earnings?status=&limit=&offset=` | Ledger rows |
| GET | `/api/host/payouts/requests?status=` | Request history |
| POST | `/api/host/payouts/requests` | `{ amount, note }` → creates request + reserves earnings |
| POST | `/api/host/payouts/requests/:id/cancel` | Cancel while `pending_review` |
| GET | `/api/host/payout-methods` | Masked bank details |
| POST | `/api/host/payout-methods` | `{ bankCode, accountNumber }` → resolve + store |
| DELETE | `/api/host/payout-methods/:id` | Disable (blocked if a request is open) |

### Admin
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/payouts/requests?status=&limit=` | Review queue |
| GET | `/api/admin/payouts/requests/:id` | Detail incl. earning breakdown + host |
| PATCH | `/api/admin/payouts/requests/:id/approve` | `{ note }` |
| PATCH | `/api/admin/payouts/requests/:id/reject` | `{ note }` (required) |
| PATCH | `/api/admin/payouts/requests/:id/mark-paid` | `{ providerReference, note }` (phase 1) |
| GET | `/api/admin/payouts/hosts/:hostId/ledger` | Host ledger for support |

### Phase 2
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/admin/payouts/requests/:id/transfer` | Initiate Paystack transfer |
| webhook | `/api/payments/paystack/webhook` | Handle `transfer.success`, `transfer.failed`, `transfer.reversed` |

## 8. Business rules

1. **Request creation** (single transaction):
   - Lock the host's available earnings (`select ... for update`).
   - Validate `amount >= minimum` and `amount <= withdrawable`.
   - Select earnings to reserve, oldest first, until the amount is covered. Partial earning splitting is allowed at the row level only if needed; otherwise require exact sums.
   - Set those rows to `reserved` with `payout_request_id`.
   - Insert the request with a `bank_snapshot`.
2. **Only one open request per host** (`pending_review`/`approved`/`processing`).
3. **Bank details required** and `status = 'verified'` before requesting.
4. **Reject/cancel** returns reserved rows to `available`.
5. **Mark-paid** sets reserved rows to `paid`, writes a `payouts` row, and stores `provider_reference`.
6. **Refunds:** if a booking that funded an earning is refunded:
   - if the earning is `available`, mark it `reversed`;
   - if `reserved`, mark it `reversed` and adjust/reject the open request (flag for admin);
   - if `paid`, do **not** auto-claw back; flag for admin follow-up.
7. **Commission changes** apply only to new earnings.
8. **Currency** is NGN only for now; reject mismatches.
9. **Rounding** is in whole naira; never send floats to the provider.

## 9. Admin workflow

1. Open `/account/admin/payouts` (new page, same nav pattern as reviews/refunds).
2. Queue shows host, amount, requested date, bank snapshot (masked), and earnings count.
3. Detail view shows the earning breakdown (booking refs, dates, gross/commission/net).
4. **Approve** → status `approved`.
5. Phase 1: pay via Paystack dashboard, then **Mark paid** with the transfer reference.
6. **Reject** → requires a note; earnings released.
7. All actions store reviewer identity and timestamps (same audit pattern as listing reviews).

## 10. Phase 2 — automated transfers

1. On approval, create/reuse a Paystack transfer recipient for the stored bank account.
2. Initiate a transfer with a unique idempotent reference (use the payout request reference).
3. Status → `processing`; do not allow duplicate initiation.
4. Handle webhooks:
   - `transfer.success` → `paid`
   - `transfer.failed` → `failed`, release earnings
   - `transfer.reversed` → `failed`, flag for admin
5. Fallback reconciliation via the transfer verify endpoint (webhooks can be missed).
6. Handle insufficient Paystack balance: mark `failed`, alert admin, keep or release the reservation per policy.
7. Optional: two-step confirmation for large payouts.

**Prerequisites to confirm:** business fully verified on Paystack, Transfers enabled, and whether transfer OTP is required.

## 11. Edge cases

| Case | Handling |
|---|---|
| Host edits bank while request open | Blocked |
| Host cancels after approval | Not allowed; admin must reject/fail |
| Duplicate submit / retry | Idempotency key + one-open-request rule |
| Earnings partially cover request | Reserve oldest rows; reject if exact coverage not possible (phase 1) |
| Booking refunded after payout | Flag for admin, do not auto-debit |
| Webhook arrives twice | Unique event key (existing webhook dedupe pattern) |
| Provider timeout on transfer | Keep `processing`, reconcile before retry |
| Host record missing | Return 409 with clear message |
| Admin approves own payout | Block if admin's profile is linked to that host |

## 12. Security

- RBAC: host endpoints scoped to the caller's `hosts.user_id`; admin endpoints role-gated.
- Never accept amounts, commission, or account names from the client.
- Mask account numbers in all responses and logs.
- Rate-limit request creation and bank-detail changes.
- Log every state transition with actor, request id, and provider reference.
- Store no card data (Paystack handles it).

## 13. Rollout

**Phase 1 (recommended first)**
1. Migration: `host_earnings`, `host_bank_accounts`, `payout_requests` (+ optional `payouts.payout_request_id`).
2. Backfill earnings for existing paid bookings.
3. Host API + UI (summary, earnings, bank details, request, history).
4. Admin API + queue page.
5. Manual mark-paid flow.
6. Tests: reservation math, double-request prevention, reject release, refund interaction.

**Phase 2**
7. Paystack recipient + transfer integration.
8. Transfer webhooks + reconciliation.
9. Alerting for failed/reversed transfers.

## 14. Open questions

1. Hold period: 24h after check-in vs after check-out?
2. Should hosts be able to split a payout across multiple bank accounts?
3. Is a rolling reserve needed given current refund volume?
4. Who may approve payouts — any admin, or a finance role?
5. Minimum payout amount and any payout fee?
6. Do we need a host-visible invoice/statement export?
