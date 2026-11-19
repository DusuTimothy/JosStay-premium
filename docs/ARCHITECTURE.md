# Architecture — JosStay Premium Monorepo

## Repository layout

```
JosStay-premium/
├── apps/
│   ├── client/          Next.js 14 (App Router), React 18, Tailwind CSS
│   └── server/          Express REST API (Node.js, ESM)
├── packages/
│   └── shared/          Sample data, amenity labels, currency helpers
├── docs/
│   ├── BUILD_PLAN.md
│   ├── DESIGN_SYSTEM.md
│   ├── ARCHITECTURE.md
│   └── SAMPLE_DATA.md
├── package.json         npm workspaces + dev scripts
└── README.md
```

## Client (Next.js App Router)

| Route | Screen |
|-------|--------|
| `/` | Home |
| `/search` | Search results + filters |
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
- Demo reads from `packages/shared/data.js` (sample data).
- In production these calls move behind the Express API and PostgreSQL.

## Server (Express)

```
GET  /health
GET  /api/properties              list + filter (destination, type, minPrice, maxPrice, rating, amenities, freeCancellation, sort)
GET  /api/properties/:slug        single property
GET  /api/properties/:slug/availability
POST /api/bookings                create booking (Zod validation)
GET  /api/bookings                list bookings
PATCH /api/bookings/:reference/cancel
POST /api/auth/register           bcrypt password hash, RBAC role
POST /api/auth/login              mock JWT-ready response
```

- **Security:** Helmet, CORS allow-list, Zod request validation, bcrypt password hashing.
- **Future persistence:** Sequelize models (`User`, `Property`, `Room`, `Booking`, `Payout`) on PostgreSQL via Supabase; Redis for search caching and rate limiting.
- **Integrations (planned):** Paystack (payments), Brevo (email), WhatsApp Cloud API, Google OAuth, LLM concierge service.

## Roles (RBAC)
| Role | Access |
|------|--------|
| `guest` | Search, book, manage own bookings |
| `host` | Guest access + listing, calendar, pricing, payouts |
| `admin` | All host access + verification, refunds, moderation |

## Environments
- `apps/client/.env.local` — `NEXT_PUBLIC_API_URL`
- `apps/server/.env` — `PORT`, `CLIENT_ORIGIN`, `DATABASE_URL`, `REDIS_URL`, `PAYSTACK_SECRET_KEY`, `BREVO_API_KEY`, `JWT_SECRET`

## Deployment
- **Client:** Vercel (Next.js).
- **Server:** Render (Node web service).
- **Database:** Supabase Postgres.
- **Cache:** Redis (Render/Upstash).
