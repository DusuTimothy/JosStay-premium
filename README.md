# JosStay Premium

A mobile-first, clickable accommodation booking experience for **Jos, Plateau State** — hotels, apartments, Airbnb-style stays, shortlets, and guest houses.

Built as a full-stack monorepo with **Next.js + Tailwind CSS** on the client and **Express** on the server, using realistic sample data marked for replacement.

## Quick start

```bash
# from the repository root
npm install
npm run dev
```

- Client: http://localhost:3000
- API: http://localhost:4000
- Health check: http://localhost:4000/health

Run only one side:

```bash
npm run dev:client
npm run dev:server
```

Production build:

```bash
npm run build
npm start
```

## Screens

| Route | Screen |
|-------|--------|
| `/` | Home — hero search, featured stays, popular areas, trust, reviews, bundle banner |
| `/search` | Search results with filters, sort, map toggle, loading/empty/error states |
| `/property/[slug]` | Property detail — gallery, amenities, units, calendar, reviews, sticky booking bar |
| `/checkout` | Guest details, airport pickup, payment method, mock Paystack flow |
| `/confirmation/[reference]` | Booking reference, stay summary, add flight / view / share |
| `/bundle` | Flight + stay bundle with 10% stay discount |
| `/bookings` | Upcoming, past and cancelled stays with cancel/rebook |
| `/host` | Host sign-up with income estimator |
| `/host/dashboard` | Listings, verification uploads, calendar, prices, bookings, payouts |
| `/help` | FAQs, cancellation policy, WhatsApp support |
| `/account` | Demo sign-in, Google sign-up and account shortcuts |

## Highlights

- Figma-matched visual system: plum `#4E2971`, gold `#E1B752`, warm canvas, Inter Tight display type and editorial spacing.
- Mobile-first layout with a matching desktop experience and bottom tab bar.
- Independent, colocated component structure: shared UI/layout/provider/shared modules plus route-local `app/<route>/_components/` views composed by slim route pages.
- Reusable components: Button, SearchBar, PropertyCard, FilterPanel, RatingStars, Badges, CalendarPicker, PriceSummary, ReviewCard, Header/Footer, and loading/empty/error states.
- NGN prices with an optional USD view (toggle in the header, persisted locally).
- Calendar selection updates nightly totals, fees, pickup and bundle discounts live.
- Search filters visibly update results; list/map toggle, empty, loading and error states are included.
- Mock card payment succeeds for any 16-digit number; a card ending in `0000` triggers the failure/retry state.
- Bookings and drafts persist in `localStorage` for the clickable demo; the API persists to PostgreSQL when configured.
- 10 sample Jos properties from ₦10,000 to ₦150,000 per night, all marked as sample data.

## Monorepo layout

```
apps/
  client/        Next.js 14 App Router + Tailwind CSS
  server/        Express REST API (helmet, cors, zod, bcryptjs, pg, redis)
packages/
  shared/        Sample properties, reviews, quote helpers, formatting
db/
  migrations/    PostgreSQL schema and security migrations
docs/
  BUILD_PLAN.md     Daily plan (18–21 Nov 2026) + social posts
  DESIGN_SYSTEM.md  Colours, type, components, interaction rules
  ARCHITECTURE.md   Routes, API, RBAC, deployment
  AIVEN_SETUP.md    Aiven PostgreSQL/Redis setup, migrations, seeding and security
  SAMPLE_DATA.md    The 10 listings and data conventions
```

## API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | Public | Service status and active backend |
| GET | `/api/meta` | Public | Amenities, areas, currency info |
| GET | `/api/properties` | Public | Filter and sort published properties |
| GET | `/api/properties/:slug` | Public | Single property |
| GET | `/api/properties/:slug/availability` | Public | 60-day availability |
| POST | `/api/auth/register` | Public | Create a guest account (bcrypt, role forced to `guest`) |
| POST | `/api/auth/login` | Public | Signed JWT access token |
| GET | `/api/auth/me` | Bearer | Current account |
| POST | `/api/bookings` | Bearer | Create a booking (Zod validated, server-priced) |
| GET | `/api/bookings` | Bearer | Own bookings; hosts see their properties, admins see all |
| PATCH | `/api/bookings/:reference/cancel` | Bearer | Cancel an owned/hosted booking |
| GET | `/api/host/payouts` | Bearer `host`/`admin` | Payouts for the signed-in host |

Protected routes use `Authorization: Bearer <token>`. Roles come from the signed
JWT. Registration always creates a `guest`; create trusted hosts/admins with the
server script.

The server runs on an in-memory demo store by default. Set `DATA_BACKEND=postgres`
with PostgreSQL connection variables (and Aiven CA certificate path when required)
to persist to PostgreSQL. Redis can be configured via `REDIS_URL` and
`REDIS_CA_CERT_PATH`. Production fails closed if PostgreSQL/JWT secrets are
missing. See [Aiven setup & security](docs/AIVEN_SETUP.md).

## Documentation

- [Build plan & social posts](docs/BUILD_PLAN.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Aiven setup & security](docs/AIVEN_SETUP.md)
- [Sample data](docs/SAMPLE_DATA.md)

## Notes

> All listings, reviews, hosts, references, payouts and fares are **sample data**. No real payment is taken. Replace `packages/shared/data.js` with real inventory and follow [Aiven setup](docs/AIVEN_SETUP.md) before launch.

## Deployment

- **Client:** Vercel — set `NEXT_PUBLIC_API_URL`.
- **Server:** Render/Node host — set `NODE_ENV=production`, `DATA_BACKEND=postgres`, database/Redis connection vars, CA cert paths, `CLIENT_ORIGIN`, `TRUST_PROXY=1`, `JWT_SECRET`, and integration keys.
- **Database:** Aiven for PostgreSQL with TLS CA verification, backups, and migrations in `db/migrations/`.
- **Cache:** Aiven for Redis/Valkey with TLS CA verification.
