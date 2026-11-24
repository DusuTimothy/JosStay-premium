# JosStay — Current State

_Last updated: 2026-11-24. Keep this short; update it at the end of each working session._

## Stack / deploy
- Client: Next.js 14 on Vercel — `https://jos-stay-premium.vercel.app`
- API: Express on Render — `https://josstay-premium.onrender.com`
- Data: Aiven PostgreSQL (+ optional Redis/Valkey, `rediss://`, TLS CA at `certs/aiven-ca.pem`)
- Production requires `DATA_BACKEND=postgres`; Redis is optional and must not block startup.

## Auth
- JWT access token in memory + HttpOnly rotating refresh cookie; CORS locked to `CLIENT_ORIGIN`.
- Google sign-in (`POST /api/auth/google`) verifies GIS credential; links/creates accounts and marks email verified.
- Email/password signup requires verification before sign-in (`403` `details.code=EMAIL_NOT_VERIFIED`); reset tokens are hashed/single-use and revoke sessions.
- `db:create-user` creates pre-verified accounts (operator action).

## Bookings / payments
- Server-priced bookings; idempotency keys; Paystack init/verify/webhook (HMAC SHA512).
- Guest price = nightly + cleaning (+ extras) − discounts. The 7% guest service fee was removed; the platform earns 10% host commission only.
- Checkout link reuse per booking; unpaid pending bookings expire to `abandoned` after `PAYMENT_PENDING_TTL_MINUTES` (default 30).
- Money safety: amount mismatch, duplicate successful charge, and late success on unavailable dates are recorded as `metadata.requiresRefund=true` instead of silently ignored.
- **Refunds are manual only** — no Paystack refund API calls. Runbook: `docs/REFUND_RUNBOOK.md`.

## Admin
- Single entry point: `/account`. Admin users see the **Admin dashboard** plus a **My account** section.
- Tools: `/account/admin/reviews` (approve/reject/suspend, reviewer audit `reviewed_by`/`reviewed_at`), `/account/admin/refunds` (manual resolve notes, resolver metadata).
- Legacy `/admin`, `/admin/reviews`, `/admin/refunds` redirect into `/account/...`.

## Client conventions
- Phone inputs accept local Nigerian formats and normalize to `+234` on submit (`apps/client/lib/phone.js`).
- No analytics/tracking scripts and no cookie consent banner yet.

## Useful commands
```bash
npm run dev                                  # client + server
npm --workspace @josstay/client run build    # client build
npm --workspace @josstay/server run db:migrate
npm --workspace @josstay/server run db:import-listings -- <file> --dry-run
npm --workspace @josstay/server run db:clear-sample -- --yes
npm --workspace @josstay/server run db:verify
```
Server scripts that hit the DB may need `DB_FORCE_IPV4=true` in this environment.

## Open work
See `docs/PRODUCTION_READINESS.md` for the full checklist. Current priorities:
1. Confirm Vercel/Render deployed latest `main`; Render start command + `REDIS_URL`/TLS vars.
2. Live Brevo test (signup verification + password reset emails).
3. Paystack live keys + webhook configured in dashboard; controlled live payment test.
4. Rotate exposed secrets (Cloudinary, Brevo, admin password, DB credentials).
5. Real inventory import (`db/listings.json` → dry-run → import → `db:clear-sample`).
6. Demo/placeholder cleanup — **on hold** (user asked to defer).
7. Payout request flow — not built; support-only placeholder. Spec written: `docs/PAYOUTS.md` (phase 1 = ledger + request + admin review + manual settlement).
8. Pipeline: analytics overview (host + admin) and cookie consent + cookie policy.

## Notes
- DB baseline after last cleanup: demo seed present (10 properties, 20 rooms), 0 real listings.
- No automated test suite; verification is `node --check`, client build, and manual smoke tests.
- Known gap: no `/admin` index (by design now); admin lives under `/account`.
