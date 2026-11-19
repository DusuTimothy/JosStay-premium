# Supabase setup & security

JosStay Premium uses **Supabase Postgres** for production persistence. The
Express API talks to it with the **service-role key on the server only**. The
browser never receives that key. Supabase Row Level Security (RLS) is enabled on
every table with a default-deny posture, and client roles can read only the
published catalogue.

> If `DATA_BACKEND` is not set, the API falls back to the in-memory demo store.
> Production refuses to start in demo mode.

---

## 1. Create the project

1. Create a project at [supabase.com](https://supabase.com).
2. Choose the region closest to your users (for Nigeria, an EU region is usually
   the lowest-latency option available).
3. Use a strong database password and store it in your password manager.
4. In **Project Settings → Database**, enable:
   - **SSL enforcement**
   - **Connection pooling** if you later add a direct Postgres client
   - **Point-in-time recovery / daily backups** (plan-dependent)
5. In **Project Settings → API**, copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public key** → `SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` *(server only)*

Never put `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_*`, a browser bundle, a
mobile app, a screenshot, or a commit. It bypasses RLS.

---

## 2. Configure the server

```bash
cp .env.example apps/server/.env
```

Edit `apps/server/.env`:

```env
NODE_ENV=development
PORT=4000
CLIENT_ORIGIN=http://localhost:3000
DATA_BACKEND=supabase

SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

JWT_SECRET=<output of: openssl rand -base64 48>
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

TRUST_PROXY=0
API_RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_MAX=10
```

Do not commit `apps/server/.env`. It is already ignored.

---

## 3. Apply the migrations

### Option A — Supabase CLI (recommended)

```bash
npm install --global supabase

supabase login
supabase link --project-ref <project-ref>
supabase db push
```

The repo includes `supabase/config.toml`, so `supabase init` is not needed.
Local Auth and Storage are disabled there because the API uses its own JWT auth
and property images are external URLs today.

The migrations run in this order:

| Migration | Purpose |
| --- | --- |
| `20261119090000_josstay_core_schema.sql` | Enums, tables, indexes, updated-at triggers, booking reference generator, room over-booking exclusion constraint |
| `20261119090100_josstay_row_level_security.sql` | Enables RLS and adds public-read policies for published listings |
| `20261119090200_josstay_grants.sql` | Least-privilege grants; service role only for sensitive tables |

### Option B — SQL editor

Open **SQL Editor** in the Supabase dashboard and run the three files in
`supabase/migrations/` **in filename order**. If PostgREST reports a stale
schema cache after manual changes, run:

```sql
notify pgrst, 'reload schema';
```

---

## 4. Seed the demo catalogue

```bash
npm --workspace @josstay/server run db:seed
```

This inserts the 10 properties, rooms, images, amenities, reviews, the two sample
bookings, and sample payouts. It is idempotent: properties upsert by `slug`,
rooms by `(property_id, code)`, reviews/images are replaced, and payouts upsert
by `reference`.

To attach `JS-8F2K1Q` and `JS-4M7P2D` to a real guest account, create the guest
first and set `SEED_GUEST_EMAIL` in `apps/server/.env`, then re-run the seed.

---

## 5. Create the first host/admin

Registration through the API **always creates a `guest`**. Roles are never
accepted from the request body. Create trusted accounts from the server:

```bash
USER_EMAIL=host@yourdomain.com \
USER_PASSWORD='use-a-12-plus-character-password' \
USER_NAME='JosStay Host' \
USER_ROLE=host \
npm --workspace @josstay/server run db:create-user
```

Use `USER_ROLE=admin` for an administrator. The script hashes the password with
bcrypt cost 12 and links a `hosts` row when the role is `host`.

---

## 6. Start and verify

```bash
npm --workspace @josstay/server run start
```

Health check:

```bash
curl http://localhost:4000/health
# {"status":"ok",...,"backend":"supabase","sampleData":false}
```

Run the RLS verification with the **anon** key:

```bash
npm --workspace @josstay/server run db:verify
```

Expected:

- `anon` can read published properties and amenities.
- `anon` **cannot** read `profiles`, `hosts`, `bookings` or `payouts`.
- `anon` **cannot** update or insert properties.
- The service role can read bookings/profiles server-side.

Manual check:

```bash
curl "$SUPABASE_URL/rest/v1/bookings?select=id" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

It must fail with a permission/RLS error, not return rows.

---

## 7. API authentication

Register and login now return a signed HS256 JWT:

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada","email":"ada@example.com","password":"a-long-password"}'
```

Use it on protected routes:

```bash
curl http://localhost:4000/api/bookings \
  -H "Authorization: Bearer <token>"
```

- `GET /api/bookings` returns only the caller’s bookings; hosts see bookings for
  their properties; admins see all.
- `PATCH /api/bookings/:reference/cancel` checks ownership (or host/admin) and
  returns `404` for other users’ references so references cannot be enumerated.
- `GET /api/host/payouts` requires `host` or `admin`.
- The old `x-role` header is gone. Roles come only from the verified token.

Create a booking (totals are always recalculated server-side):

```bash
curl -X POST http://localhost:4000/api/bookings \
  -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{
    "propertySlug":"crestview-boutique-hotel",
    "roomId":"deluxe",
    "checkIn":"2026-12-10",
    "checkOut":"2026-12-12",
    "guests":2,
    "guest":{"firstName":"Ada","lastName":"Okafor","email":"ada@example.com","phone":"+2348000000000"}
  }'
```

---

## 8. Deploy to Render

- **Build:** `npm install`
- **Start:** `npm --workspace @josstay/server run start`
- **Environment:**
  - `NODE_ENV=production`
  - `DATA_BACKEND=supabase`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `JWT_SECRET` (48 random bytes, unique per environment)
  - `CLIENT_ORIGIN=https://your-client-domain` (exact origin, no trailing slash)
  - `TRUST_PROXY=1`
  - `BCRYPT_ROUNDS=12`
  - `AUTH_RATE_LIMIT_MAX=10`
- Mark `SUPABASE_SERVICE_ROLE_KEY` as a secret in Render.
- Do not set `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` anywhere.
- If you use Supabase network restrictions, allow Render’s outbound IPs.
- Keep the client on Vercel with only `NEXT_PUBLIC_API_URL` pointing at Render.

If `NODE_ENV=production` and the API is missing Supabase or `JWT_SECRET`, startup
fails closed instead of silently using demo data.

---

## Security model

### Database

- RLS is enabled on every table.
- The public catalogue (`properties`, images, rooms, amenities, reviews) is
  readable only when `properties.is_published = true`.
- `profiles`, `hosts`, `bookings` and `payouts` have **no** anon/authenticated
  policies and no table grants.
- Table privileges are revoked first (`revoke all ... from anon, authenticated`),
  then SELECT is granted only on the catalogue.
- The service role is the only role with write access and is held only by the
  Express server.
- A GiST exclusion constraint blocks overlapping active bookings for the same
  room even if application logic is bypassed.
- Booking totals are computed from database prices by the server; client-supplied
  totals are ignored.
- Emails are unique case-insensitively via a `lower(email)` index.
- Passwords are bcrypt-hashed (cost 12). The database rejects non-bcrypt hashes.

### API

- Signed JWT access tokens (`HS256`, issuer `josstay-api`, audience
  `josstay-client`, 7-day expiry by default).
- Roles are read from the verified token. Registration always creates `guest`.
- Authorization errors return `403`; missing/invalid tokens return `401`.
- Object-level checks prevent guests from reading or cancelling each other’s
  bookings, and scope host payouts to the host record linked to the token.
- Helmet, strict CORS allow-list, 100 kB JSON limit, request IDs, rate limits on
  `/api` and stricter limits on `/api/auth`, generic login errors, and timing-safe
  bcrypt comparison for missing accounts.
- Zod validates bodies, params and query strings; unknown fields are rejected.
- No raw SQL is built from user input; Supabase/PostgREST queries are
  parameterised.
- Service-role keys and JWT secrets are never logged.

### Not implemented yet

- Email verification, password reset, MFA and OAuth (the demo client still uses
  local storage; integrate Supabase Auth or your own email provider before launch).
- Payment webhooks and Paystack verification.
- Audit-log retention and alerting.
- Per-user Supabase Auth RLS policies (the API is the only data path today).

---

## Rotation and incident response

1. If the service-role key is exposed, rotate it immediately in
   **Project Settings → API**, update Render, and redeploy.
2. Rotate `JWT_SECRET` to invalidate all existing tokens.
3. Review Supabase **Logs → API / Postgres** for unexpected table access.
4. Restore from a backup/PITR point if data was modified.
5. Check `git log`/secret scanning to confirm `.env` was never committed.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `permission denied for table ...` | Run the grants migration; check you are using the service role server-side, anon key only for public reads |
| `relation "public.properties" does not exist` | Apply the migrations |
| `exclusion_violation` / booking `409` | The room is already booked for those dates |
| `23505` on registration | Email already exists |
| Startup fails with “Production must use Supabase persistence” | Set `DATA_BACKEND=supabase` and the Supabase env vars |
| PostgREST cannot see a new table/column | `notify pgrst, 'reload schema';` |
| Rate limits are wrong behind Render | Set `TRUST_PROXY=1` |
