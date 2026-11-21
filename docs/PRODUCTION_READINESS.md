# Production Readiness & Go-Live Checklist

Step-by-step checklist for taking **JosStay Premium** from demo/prototype to a live production deployment on **Vercel (client)** + **Render (API)** + **Aiven PostgreSQL/Redis** with a focus on **security, low latency, idempotency, and interactivity**.

> **Status note (repo reality):** significant production-path work is now implemented in-repo (API-backed auth/session/booking/host flows, Postgres-backed stores/migrations, Paystack initialize/verify/webhook handling with idempotency primitives, host listing/pricing/block APIs, bundle/quote/config APIs, upload-signature scaffolding, and Brevo/Cloudinary env-driven service hooks), but the app is **not yet production-complete**. Several live-path demo/sample fallbacks and `@josstay/shared` demo-data dependencies remain in client flows, end-to-end provider/infra validation is pending, and production deployment hardening must be verified against real Aiven/Render/Vercel/Paystack/Brevo/Cloudinary/Google configuration. Use this document as the implementation and release checklist to close remaining gaps.

---

## How to use this checklist

- Work **top-to-bottom by phase**; earlier phases unblock later ones.
- Mark items complete only when verified in a production-like environment (not local demo mode).
- Treat any unchecked **Security** or **Data integrity/Idempotency** item as a release blocker for real bookings/payments.
- Keep secrets in Vercel/Render env vars (never commit). `apps/server/.env` and `apps/client/.env.local` are local-only.
- Record evidence for critical items: deployment config, `db:migrate`/`db:verify` output, `GET /health`, test booking/payment results, and rollback steps.

---

## Phase 0 — Stabilize production infrastructure (blocker)

### 0.1 Aiven PostgreSQL
- [ ] Provision/select production Aiven PostgreSQL and confirm network reachability from Render (IP allowlist/firewall/VPN/private networking as needed; prefer IPv4-compatible routing).
- [ ] Configure server env: `DATA_BACKEND=postgres`, `DATABASE_URL` (or `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD`), `DATABASE_CA_CERT_PATH` (e.g. `certs/aiven-ca.pem` when run from `apps/server`), and `DATABASE_SSL_REJECT_UNAUTHORIZED` as required.
- [ ] Run `npm --workspace @josstay/server run db:migrate` and `npm --workspace @josstay/server run db:verify` until consistently passing.
- [ ] Enable Aiven backups/PITR and use a least-privilege DB role for the app (owner/admin only for migrations/ops).
- [ ] Create real admin/host/user accounts via `npm --workspace @josstay/server run db:create-user` (do not use demo seed users for production).

### 0.2 Aiven Redis/Valkey (if used)
- [ ] Set `REDIS_URL` (`rediss://...`) for production.
- [ ] If Aiven does **not** provide a downloadable CA for Redis/Valkey, leave `REDIS_CA_CERT_PATH` unset/empty and keep `REDIS_TLS_REJECT_UNAUTHORIZED=true` (default). **Do not** point Redis CA at the Postgres CA unless it is the correct CA for that service.
- [ ] Verify API startup/connectivity and decide behavior for Redis outages (cache/rate-limit/idempotency fallback strategy must be explicit).

### 0.3 Render API service
- [ ] Set `NODE_ENV=production`, `PORT` (platform-provided or configured), and `TRUST_PROXY` to the correct hop count for Render’s proxy.
- [ ] Set a strong `JWT_SECRET` (>= 32 chars, unique, rotated on compromise).
- [ ] Set `CLIENT_ORIGIN` to exact frontend origin(s), comma-separated, no wildcard (must match Vercel deployment URL/custom domain).
- [ ] Deploy and confirm `GET /health` returns healthy with `backend:"postgres"` (and expected Redis status if configured).
- [ ] Confirm production startup fails closed on invalid DB/config (expected behavior in `apps/server/src/index.js` / `apps/server/src/config/env.js`); resolve root causes rather than weakening checks.

### 0.4 Vercel client
- [ ] Set build-time env vars: `NEXT_PUBLIC_API_URL` (public Render API base URL, https) and `NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER` (real digits-only number).
- [ ] Rebuild/redeploy after any `NEXT_PUBLIC_*` change (values are baked into the client build).
- [ ] Configure custom domain/HTTPS and ensure the API `CLIENT_ORIGIN` includes the deployed origin.
- [ ] Clear stale caches and verify no chunk/asset mismatch errors after deploy.

### 0.5 Production-like validation gate
- [ ] Migrations applied, `db:verify` passing, API healthy, client loads against live API, and CORS/auth preflight succeeds from the deployed frontend.
- [ ] No demo seed data relied on for live operation (`apps/server/scripts/seed.js` is sample/dev-oriented unless intentionally replaced).
- [ ] Local/dev validation can be run using `.env.example` values adapted for local Postgres (e.g. `DATA_BACKEND=postgres`, local `DATABASE_URL`, strong `JWT_SECRET`), with provider keys omitted for safe non-production behavior where supported. Document any required overrides.

---

## Phase 1 — Security hardening

### 1.1 Secrets, transport, and platform config
- [ ] All secrets/keys stored only in platform env/secrets managers; no credentials committed to repo or client bundles.
- [ ] Enforce HTTPS end-to-end (Vercel, Render, Aiven). No mixed-content API calls from client.
- [ ] Restrict Aiven network access and database privileges; rotate credentials/keys per policy.
- [ ] Add/verify security headers on client responses (CSP, HSTS via platform, frame/content protections as appropriate for Next.js/Vercel).

### 1.2 API security controls
- [ ] Keep/verify Helmet, strict CORS, JSON body limits, and request context (`apps/server/src/app.js`, `apps/server/src/middleware/requestContext.js`, `errorHandlers.js`).
- [ ] Keep/verify Zod validation on all inputs (`apps/server/src/validators/*`) and reject unknown/invalid payloads.
- [ ] Keep/tune rate limiting for API and auth (`apps/server/src/middleware/rateLimit.js`, env limits). For multi-instance Render, move limiter/idempotency state to Redis or a shared store.
- [ ] Ensure `TRUST_PROXY` is correct so rate limits and logs use real client IPs.
- [ ] Keep/verify unsafe-method Origin checks and cookie/session handling for browser flows; review CSRF/session edge cases (cross-origin refresh/logout, concurrent refresh rotation, multi-tab behavior) before go-live.

### 1.3 Authentication and authorization
- [ ] Keep bcrypt hashing and signed JWT verification (`apps/server/src/lib/tokens.js`, `apps/server/src/middleware/auth.js`, auth routes/controllers); enforce server-side registration/login rules.
- [ ] Define token/session policy: expiry, refresh/revocation (if needed), logout behavior, and secure client storage/handling of tokens.
- [ ] Enforce object-level authorization on every protected resource (e.g. users can only access/cancel their own bookings; hosts/admins scoped correctly). Never trust client-supplied user IDs, roles, or prices.
- [ ] Server must calculate authoritative booking totals/quotes and availability; ignore client-calculated amounts.

### 1.4 Payments, webhooks, uploads, and sensitive data
- [ ] Integrate a real payment provider using server-side intent/confirmation and provider-hosted/tokenized card collection where possible (no raw card data stored/processed by app).
- [ ] Verify webhook signatures, authenticate webhook sources, and process events idempotently (see Phase 3).
- [ ] Validate and constrain uploads (type, size, filename/content checks), store in secure object storage/CDN, and authorize access to private documents.
- [ ] Log security-relevant events (auth failures, permission denials, payment/booking state changes) without PII/secrets; add alerting/monitoring.
- **Implemented in code (verify in production):** Paystack server-side initialize/verify/webhook routes, signature verification, amount/reference checks, idempotency-key handling for booking/payment-init paths, webhook event dedupe storage, booking/payment state reconciliation helpers, Cloudinary server-side upload signature/config endpoints, and Brevo transactional email service hooks (safe no-op when unconfigured). Live provider credentials, webhook delivery, signed browser uploads, and end-to-end notification delivery still require configuration and validation.

### 1.5 Dependency and code hygiene
- [ ] Run dependency audit/update process; pin/review critical packages.
- [ ] Remove or hard-disable demo fallback behavior in production paths (`DATA_BACKEND=demo`, in-memory stores, `sampleData` responses) and ensure API/client never expose demo-only data/actions in live mode.
- [ ] Review RLS/DB grants for the production DB role (`db/migrations/*security*`) and document the trusted-server access model.

---

## Phase 2 — Replace demo data and implement real product flows

### 2.1 Client API integration (required)
- [ ] Implement a centralized API client in `apps/client` using `NEXT_PUBLIC_API_URL` (e.g. `apps/client/lib/api.js`) with: base URL, JSON parsing, auth token attachment, timeout handling, normalized errors, and support for idempotency keys on mutating requests.
- [ ] Replace bundled/local data sources with API-backed data:
  - [ ] Search/listings/property detail/availability/pricing/reviews (`apps/client/app/search/_components/SearchView.jsx`, property/home views currently using `@josstay/shared` / `packages/shared/data.js`).
  - [ ] Auth/session/profile flows (`apps/client/app/account/_components/AccountView.jsx`) against `/api/auth/*` (remove localStorage demo auth).
  - [ ] Bookings/checkout/confirmation (`apps/client/app/checkout/_components/CheckoutView.jsx`, `apps/client/app/bookings/_components/BookingsView.jsx`, confirmation views, `apps/client/components/providers/BookingProvider.jsx`) against `/api/bookings` and payment endpoints.
  - [ ] Host flows/dashboard/listings/uploads/payouts (`apps/client/app/host/**`) against real host APIs.
- [ ] Remove `SEED_BOOKINGS`, local-only booking mutations as source of truth, and demo draft/storage semantics except where explicitly useful and non-authoritative.

### 2.2 Server/data completeness
- [ ] Load real production inventory/content into Postgres (properties, rooms, images, amenities, policies, reviews if applicable). Do not rely on `packages/shared/data.js` or sample seed scripts for live data.
- [ ] Bulk-load/update real inventory with `npm --workspace @josstay/server run db:import-listings -- <file> --dry-run` then without `--dry-run` (see `docs/LISTINGS_IMPORT.md`).
- [ ] Ensure property/search/availability endpoints read authoritative DB data and return accurate, paginated results.
- [ ] Implement/complete APIs required by live UI (payments, confirmations, notifications, uploads, host listing management, admin operations) with validation and authz.
- [ ] Remove or gate `sampleData` flags and demo responses in controllers/stores for production.

### 2.3 Demo/prototype UI removal
- [ ] Remove “Prototype states (for review)” and demo toggles from `apps/client/app/search/_components/SearchView.jsx`.
- [ ] Remove sample booking shortcuts, simulated payment/transfer/USSD success/failure, test-card/demo behavior, and “no real payment” copy from checkout/confirmation flows.
- [ ] Remove demo/local-only host signup/dashboard behavior, fake uploads (“files are not uploaded anywhere”), and sample payouts/listings.
- [ ] Replace placeholder/demo contacts and copy (`2348000000000`, `support@josstay.demo`, `demo@...`, demo badges/messages) with real support/policy content and config-driven values.
- [ ] Rebuild client and re-scan source/docs for residual demo/sample/placeholder content.

---

## Phase 3 — Idempotency and reliability

### 3.1 API and client idempotency
- [ ] Require/support `Idempotency-Key` for create/confirm payment and booking-creation (and any other non-retry-safe POST) operations.
- [ ] Client generates a stable key per user intent, reuses it on retries/timeouts, and disables duplicate submits while requests are in-flight.
- [ ] Server stores idempotency key + scope (user/operation) + request fingerprint + status/result with TTL; duplicate completed requests return the stored result; conflicting payloads for same key return 409/422.
- [ ] Make retriable operations safe: repeated cancel/confirm/status updates must be state-aware and non-destructive.

### 3.2 Database and concurrency guarantees
- [ ] Preserve/enforce DB constraints as final guard: unique booking references, active-room overlap exclusion (`bookings_no_overlapping_room_stay`), and any unique external/payment identifiers (see `db/migrations/20261119090000_josstay_core_schema.sql`).
- [ ] Add unique constraints/storage for payment provider IDs and webhook event IDs; process each webhook/event at most once.
- [ ] Use transactions for booking creation + availability validation + payment linkage/state transitions; handle constraint violations as conflicts (409) with clear client messaging.
- [ ] Define retry policy: bounded retries with backoff only for transient/safe failures; never blind-retry non-idempotent external calls without dedupe.

### 3.3 Resilience
- [ ] Add timeouts/circuit-breaker-like handling for external calls (payments, email, storage, Redis).
- [ ] Define degraded behavior explicitly (e.g. if Redis unavailable, what happens to rate limiting/idempotency/cache?) and monitor it.
- [ ] Ensure graceful shutdown drains in-flight work where possible (`apps/server/src/index.js`).

---

## Phase 4 — Low latency and performance

### 4.1 Placement and connections
- [ ] Co-locate Render and Aiven in the same/nearest region; verify stable IPv4/network path.
- [ ] Tune Postgres pool settings/timeouts (`apps/server/src/lib/postgres.js`) for concurrency; reuse Redis connections.
- [ ] Use Vercel CDN for static assets and cacheable public content.

### 4.2 Backend/query performance
- [ ] Ensure all list/search/availability/booking queries are indexed for real access patterns; review/add indexes via migrations as needed.
- [ ] Paginate and cap list endpoints; avoid N+1 queries and oversized payloads.
- [ ] Add caching for safe hot reads (catalogue/config/currency/derived availability snapshots) with TTL/invalidation; never serve stale-authoritative booking/payment state.
- [ ] Add compression/efficient serialization and keep images/media served from optimized storage/CDN.

### 4.3 Client performance
- [ ] Use API-backed data fetching patterns appropriate for Next.js (server components/ISR/revalidation for public pages; fresh fetches for availability/checkout/bookings).
- [ ] Reduce bundle size, lazy-load non-critical UI (maps/heavy widgets), optimize images/fonts, and remove prototype/demo code from production builds.
- [ ] Prefetch likely navigation and avoid expensive client-side filtering over large bundled datasets.
- [ ] Measure and track Web Vitals (LCP, INP, CLS) on production.

---

## Phase 5 — Interactivity and UX quality

- [ ] Implement real loading/skeleton, empty, success, and actionable error states for all async flows (search, property, auth, checkout, bookings, host).
- [ ] Provide immediate interaction feedback (button pending states, progress indicators, inline validation) and prevent duplicate submissions.
- [ ] Use optimistic UI only where safe with rollback on failure; always reconcile with server truth for money/availability/booking state.
- [ ] Keep availability/pricing/booking status fresh (revalidate after mutations, on focus, or via polling/push where needed); re-check critical conditions server-side before final confirmation.
- [ ] Ensure forms are accessible, mobile-friendly, and resilient to slow/intermittent networks with clear retry paths.
- [ ] Replace all prototype/demo labels, sample shortcuts, and simulated outcomes with real product behavior/copy.

---

## Phase 6 — Release, verification, and operations

### 6.1 End-to-end release checks
- [ ] **Config:** Render/Vercel env correct, `CLIENT_ORIGIN`/`NEXT_PUBLIC_API_URL` aligned, TLS/CA valid, no demo env values.
- [ ] **Health:** `GET /health` healthy; DB and Redis (if required) connected.
- [ ] **Auth:** register/login/logout/profile, invalid/expired token handling, role-based access.
- [ ] **Catalogue/search:** real data rendered, filters/pagination/map behave correctly, no bundled sample dependency in production path.
- [ ] **Booking flow:** availability check, server-priced quote, payment success/failure/cancel, confirmation, booking visible in account/host views.
- [ ] **Idempotency/retries:** double-click submit, client retry/timeout, and webhook replay do not create duplicates or inconsistent state.
- [ ] **Host/admin:** real listing/content/user/payment operations as applicable.
- [ ] **Negative/security checks:** unauthorized access blocked, CORS enforced, rate limits effective, invalid inputs rejected.

### 6.2 Monitoring and operations
- [ ] Set up uptime checks, error tracking, structured logs with request IDs, and alerts (API 5xx, latency, DB/Redis errors, payment/booking failures).
- [ ] Monitor DB performance/slow queries, connection saturation, and cache hit/miss behavior.
- [ ] Document runbooks: deploy/rollback, migration procedure, incident response, key rotation, and backup restore.
- [ ] Establish a post-deploy smoke test and periodic review of residual demo/placeholder content and dependency vulnerabilities.

---

## Repo-specific starting points

- **Server entry/config:** `apps/server/src/index.js`, `apps/server/src/app.js`, `apps/server/src/config/env.js`
- **Data/access:** `apps/server/src/lib/postgres.js`, `apps/server/src/lib/redis.js`, `apps/server/src/store/*`, `db/migrations/*`
- **API surface:** `apps/server/src/routes/*`, `apps/server/src/controllers/*`, `apps/server/src/middleware/*`, `apps/server/src/validators/*`
- **Client demo/data hotspots:** `apps/client/components/providers/BookingProvider.jsx`, `apps/client/app/search/_components/SearchView.jsx`, `apps/client/app/checkout/_components/CheckoutView.jsx`, `apps/client/app/account/_components/AccountView.jsx`, `apps/client/app/host/**`, `apps/client/lib/contact.js`, `packages/shared/data.js`
- **Ops/scripts/docs:** `apps/server/scripts/migrate.js`, `seed.js`, `verify-db.js`, `create-user.js`, `import-listings.js`, `.env.example`, `docs/AIVEN_SETUP.md`, `docs/LISTINGS_IMPORT.md`, `docs/postman/JosStay-Premium-API.postman_collection.json`

Use this checklist as the source of truth for go-live work; update it as decisions are made (payment provider, storage, notification channel, idempotency storage strategy, and final data model). 
