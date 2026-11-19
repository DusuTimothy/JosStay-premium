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
| `/search` | Search results with filters, sort, loading/empty/error states |
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
- Search filters visibly update results; empty, loading and error states are included.
- Mock card payment succeeds for any 16-digit number; a card ending in `0000` triggers the failure/retry state.
- Bookings and drafts persist in `localStorage`; the UI is fully clickable without a database.
- 10 sample Jos properties from ₦10,000 to ₦150,000 per night, all marked as sample data.

## Monorepo layout

```
apps/
  client/        Next.js 14 App Router + Tailwind CSS
  server/        Express REST API (helmet, cors, zod, bcryptjs)
packages/
  shared/        Sample properties, reviews, quote helpers, formatting
docs/
  BUILD_PLAN.md     Daily plan (18–21 Nov 2026) + social posts
  DESIGN_SYSTEM.md  Colours, type, components, interaction rules
  ARCHITECTURE.md   Routes, API, RBAC, deployment
  SAMPLE_DATA.md    The 10 listings and data conventions
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service status |
| GET | `/api/meta` | Amenities, areas, currency info |
| GET | `/api/properties` | Filter and sort properties |
| GET | `/api/properties/:slug` | Single property |
| GET | `/api/properties/:slug/availability` | 60-day availability |
| POST | `/api/bookings` | Create a booking (Zod validated) |
| GET | `/api/bookings` | List bookings (`?email=`) |
| PATCH | `/api/bookings/:reference/cancel` | Cancel a booking |
| POST | `/api/auth/register` | Register with bcrypt-hashed password |
| POST | `/api/auth/login` | Demo login token |
| GET | `/api/host/payouts` | RBAC demo (`x-role: host`) |

The API is an in-memory demo. Production persistence is planned with **Sequelize + PostgreSQL (Supabase)** and **Redis** caching, with the integrations listed in `docs/ARCHITECTURE.md`.

## Documentation

- [Build plan & social posts](docs/BUILD_PLAN.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Sample data](docs/SAMPLE_DATA.md)

## Notes

> All listings, reviews, hosts, references, payouts and fares are **sample data**. No real payment is taken. Replace `packages/shared/data.js` and connect the API to PostgreSQL before launch.

## Deployment

- **Client:** Vercel — set `NEXT_PUBLIC_API_URL`.
- **Server:** Render — set `PORT`, `CLIENT_ORIGIN`, `DATABASE_URL`, `REDIS_URL`, `PAYSTACK_SECRET_KEY`, `BREVO_API_KEY`, `JWT_SECRET`.
- **Database:** Supabase Postgres.
- **Cache:** Redis (Render/Upstash).
