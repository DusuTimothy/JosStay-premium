# Architecture — JosStay Premium Monorepo

## Repository layout

```
JosStay-premium/
├── apps/
│   ├── client/          Next.js 14 (App Router), React 18, Tailwind CSS
│   └── server/          Express REST API (Node.js, ESM)
├── packages/
│   └── shared/          Sample data, amenity labels, currency helpers
├── db/
│   └── migrations/      PostgreSQL schema and security migrations
├── docs/
│   ├── BUILD_PLAN.md
│   ├── DESIGN_SYSTEM.md
│   ├── ARCHITECTURE.md
│   ├── AIVEN_SETUP.md
│   └── SAMPLE_DATA.md
├── package.json         npm workspaces + dev scripts
└── README.md
```

## Client (Next.js App Router)

| Route | Screen |
|-------|--------|
| `/` | Home |
| `/search` | Search results + filters + map toggle |
| `/property/[slug]` | Property detail |
| `/checkout` | Guest details + payment |
| `/confirmation/[reference]` | Booking confirmation |
| `/bundle` | Flight + stay bundle |
| `/bookings` | My bookings |
| `/host` | Host sign-up / landing |
| `/host/dashboard` | Host dashboard |
| `/help` | Help centre |
| `/account` | Demo sign-in / sign-up hub (Google + email) |

`/account` is not one of the nine core screens: it exists so the header
"My account" pill has a real destination instead of a dead end.

**Component structure (independent & colocated)**
- `app/<route>/page.js` — slim route entry that composes route-local UI.
- `app/<route>/_components/` — route-local components and view logic (e.g. `app/_components/*` for home, `app/search/_components/SearchView.jsx`, `app/property/[slug]/_components/*`, `app/host/dashboard/_components/DashboardView.jsx`, etc.).
- `components/ui/` — shared primitives (`Icon`, `Button`, `Badge`, `RatingStars`).
- `components/layout/` — app shell (`Logo`, `Header`, `MobileTabBar`, `Footer`).
- `components/shared/` — reusable domain components (`SearchBar`, `PropertyCard`, `CalendarPicker`, `FilterPanel`, `PriceSummary`, `ReviewCard`).
- `components/shared/states/` — loading, empty and error result states.
- `components/providers/` — split client providers (`CurrencyProvider`, `ToastProvider`, `BookingProvider`, `Providers`) with hooks exported via `components/providers/index.js` (`@/components/providers`).

**State**
- `CurrencyProvider` — NGN/USD toggle, persisted in `localStorage`.
- `BookingProvider` — draft booking, created bookings, cancel/rebook, persisted in `localStorage`.
- `ToastProvider` — non-blocking feedback for share, copy, cancel, payout.
- Account session — demo-only, persisted in `localStorage` (`josstay-account`); the
  real flow will use Google OAuth + the server `/api/auth/*` routes.

`localStorage` keys: `josstay-currency`, `josstay-draft`, `josstay-bookings`,
`josstay-host-name`, `josstay-account`. Provider hooks and keys are preserved across the refactor.

**Data**
- The client demo reads from `packages/shared/data.js` and `localStorage`.
- The Express API uses an in-memory store locally and PostgreSQL when
  `DATA_BACKEND=postgres`.

## Server (Express)

```
GET   /health
GET   /api/meta
GET   /api/properties              list + filter (destination, type, minPrice, maxPrice, rating, amenities, freeCancellation, maxDistance, sort, limit, offset)
GET   /api/properties/:slug        single property
GET   /api/properties/:slug/availability
POST  /api/auth/register           create guest, bcrypt hash
POST  /api/auth/login              signed HS256 JWT
GET   /api/auth/me                 Bearer token
POST  /api/bookings                create booking (Bearer + Zod)
GET   /api/bookings                own/host/admin scope (Bearer)
PATCH /api/bookings/:reference/cancel
GET   /api/host/payouts            Bearer host/admin
```

- **Persistence:** Aiven for PostgreSQL (or compatible Postgres). Migrations live in `db/migrations/`; apply with `npm --workspace @josstay/server run db:migrate`.
- **Cache/ephemeral services:** Aiven for Redis/Valkey configured via `REDIS_URL` and TLS CA certificate path.
- **Security:** parameterized SQL, server-calculated booking totals, bcrypt cost 12+, signed JWTs, object-level authorization, Helmet, strict CORS, rate limits, 100 kB JSON limit, Zod validation, request IDs, and a room over-booking exclusion constraint. RLS is enabled as defense-in-depth. See `docs/AIVEN_SETUP.md`.
- **Integrations (planned):** Paystack (payments), Brevo (email), WhatsApp Cloud API, Google OAuth, LLM concierge service.

## Roles (RBAC)
| Role | Access |
|------|--------|
| `guest` | Search, book, manage own bookings |
| `host` | Guest access + listing, calendar, pricing, payouts |
| `admin` | All host access + verification, refunds, moderation |

## Environments
- `apps/client/.env.local` — `NEXT_PUBLIC_API_URL` (and client-safe public keys only)
- `apps/server/.env` — `NODE_ENV`, `PORT`, `CLIENT_ORIGIN`, `DATA_BACKEND`,
  `DATABASE_URL`/`PG*`, `DATABASE_CA_CERT_PATH`, `REDIS_URL`, `REDIS_CA_CERT_PATH`,
  `JWT_SECRET`, and integration secrets
- Database credentials, Redis credentials, CA-private material (if applicable), and service secrets must never use a `NEXT_PUBLIC_*` prefix.

## Deployment
- **Client:** Vercel (Next.js).
- **Server:** Render or another Node host.
- **Database:** Aiven for PostgreSQL.
- **Cache:** Aiven for Redis/Valkey.
