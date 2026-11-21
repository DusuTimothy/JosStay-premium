# Aiven setup & security (PostgreSQL + Redis)

JosStay Premium can persist application data to **Aiven for PostgreSQL** and connect to **Aiven for Redis/Valkey** for caching and future real-time features. The Express API is the only data access path and uses server-side credentials; clients never receive database or Redis secrets.

> If `DATA_BACKEND` is not set, the API falls back to the in-memory demo store.
> Production refuses to start in demo mode.

---

## 1. Create Aiven services

1. Create an **Aiven for PostgreSQL** service (choose a region close to your users and API).
2. Create an **Aiven for Redis/Valkey** service if you need caching/sessions/rate-limit backing now (recommended for production parity).
3. In each service, download the **CA certificate** (`.pem`) from Aiven.
4. Copy the service connection details:
   - PostgreSQL: service URI/host, port, database, user, password, and CA certificate path.
   - Redis: service URI (`rediss://...`) and CA certificate path.

Aiven services require TLS. Configure the CA certificate path in environment variables rather than disabling certificate verification.

---

## 2. Place CA certificates

- Store CA certificate files at paths accessible to the API process, e.g. `certs/aiven-postgres-ca.pem` and `certs/aiven-redis-ca.pem`.
- Set `DATABASE_CA_CERT_PATH` and `REDIS_CA_CERT_PATH` to those paths (absolute or relative to the server working directory).
- **`.pem` files are not ignored by this repository** (per project setup). Only commit certificates that are safe to share in your workflow; do not commit private keys or service credentials. If your CA must remain private, keep it outside the repo and point the env vars to its deployed path.

---

## 3. Configure the server

```bash
cp .env.example apps/server/.env
```

Edit `apps/server/.env`:

```env
NODE_ENV=development
PORT=4000
CLIENT_ORIGIN=http://localhost:3000
DATA_BACKEND=postgres

# PostgreSQL (Aiven)
DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<database>?sslmode=require
DATABASE_CA_CERT_PATH=certs/aiven-postgres-ca.pem
DATABASE_SSL_REJECT_UNAUTHORIZED=true

# Redis (Aiven)
REDIS_URL=rediss://<user>:<password>@<host>:<port>
REDIS_CA_CERT_PATH=certs/aiven-redis-ca.pem
REDIS_TLS_REJECT_UNAUTHORIZED=true

JWT_SECRET=<output of: openssl rand -base64 48>
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

TRUST_PROXY=0
API_RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_MAX=10
```

Notes:
- You can use `DATABASE_URL` or discrete `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD` variables.
- `DATABASE_CA_CERT_PATH` and `REDIS_CA_CERT_PATH` should point to the Aiven CA certificate files.
- Keep certificate verification enabled (`*_REJECT_UNAUTHORIZED=true`) unless you have a specific trusted reason not to.
- Do not commit `apps/server/.env` or real credentials.

---

## 4. Apply migrations

```bash
npm install
npm --workspace @josstay/server run db:migrate
```

Migrations live in `db/migrations/` and are applied in filename order by the migration script:

| Migration | Purpose |
| --- | --- |
| `20261119090000_josstay_core_schema.sql` | Enums, tables, indexes, triggers, booking reference generator, room over-booking exclusion constraint |
| `20261119090100_josstay_security.sql` | Enables RLS on all tables as defense-in-depth for server-side access patterns |

Applied migrations are tracked in `public.schema_migrations`.

---

## 5. Seed sample data (optional, demo catalogue)

```bash
npm --workspace @josstay/server run db:seed
```

This inserts the 10 properties, rooms, images, amenities, reviews, sample bookings, and sample payouts. It is idempotent.

To attach seeded bookings `JS-8F2K1Q` and `JS-4M7P2D` to a real guest account, create the guest first and set `SEED_GUEST_EMAIL` in `apps/server/.env`, then re-run the seed.

To remove the demo catalogue again (without touching imported/real listings), use:

```bash
# preview what would be removed
npm --workspace @josstay/server run db:clear-sample

# actually delete seeded properties, their bookings, and unlinked seed hosts
npm --workspace @josstay/server run db:clear-sample -- --yes
```

Only properties matching both the shared demo `legacy_id` and `slug` are removed. Hosts are deleted only if they are unlinked (`user_id is null`) and have no remaining properties.

---

## 6. Create the first host/admin

Registration through the API **always creates a `guest`**. Roles are never accepted from the request body. Create trusted accounts from the server:

```bash
USER_EMAIL=host@yourdomain.com \
USER_PASSWORD='use-a-12-plus-character-password' \
USER_NAME='JosStay Host' \
USER_ROLE=host \
npm --workspace @josstay/server run db:create-user
```

Use `USER_ROLE=admin` for an administrator. The script hashes the password with bcrypt and links a `hosts` row when the role is `host`.

---

## 7. Start and verify

```bash
npm --workspace @josstay/server run start
```

Health check:

```bash
curl http://localhost:4000/health
# {"status":"ok",...,"backend":"postgres","sampleData":false}
```

Database verification:

```bash
npm --workspace @josstay/server run db:verify
```

This checks connectivity, required tables, the booking overlap constraint, and basic catalogue readability.

---

## 8. API authentication

Register and login return a signed HS256 JWT:

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

- `GET /api/bookings` returns only the caller’s bookings; hosts see bookings for their properties; admins see all.
- `PATCH /api/bookings/:reference/cancel` checks ownership (or host/admin).
- `GET /api/host/payouts` requires `host` or `admin`.
- Roles come only from the verified token.

---

## 9. Deploy

- **Client (Vercel):** set `NEXT_PUBLIC_API_URL` to the API base URL.
- **Server (Render/other):** set `NODE_ENV=production`, `DATA_BACKEND=postgres`, PostgreSQL vars, `DATABASE_CA_CERT_PATH`, Redis vars, `REDIS_CA_CERT_PATH`, `JWT_SECRET`, `CLIENT_ORIGIN` (exact origin), and `TRUST_PROXY=1` behind a proxy/load balancer.
- Store CA certificate files securely in the deployment environment and point env vars to their paths.
- Mark database passwords, JWT secret, Redis credentials, and integration keys as secrets.

If `NODE_ENV=production` and PostgreSQL/JWT configuration is missing, startup fails closed instead of using demo data.

---

## Security model

### Database
- PostgreSQL stores application data; connections should use TLS with Aiven CA verification.
- Booking totals are computed server-side; client-supplied totals are ignored.
- A GiST exclusion constraint blocks overlapping active bookings for the same room.
- Emails are unique case-insensitively.
- Passwords are bcrypt-hashed; the database rejects non-bcrypt hashes.
- RLS is enabled as defense-in-depth; the API enforces object-level authorization and should connect with a trusted server-side DB role.

### Redis
- Redis is configured for TLS with Aiven CA verification when `REDIS_URL`/`REDIS_CA_CERT_PATH` are provided.
- Do not store secrets or unprotected sensitive data in Redis without a clear purpose and expiry strategy.

### API
- Signed JWT access tokens (HS256, issuer `josstay-api`, audience `josstay-client`).
- Roles are read from the verified token. Registration always creates `guest`.
- Helmet, strict CORS allow-list, 100 kB JSON limit, request IDs, rate limits, generic auth errors, and timing-safe password checks.
- Zod validates bodies, params and query strings.
- Parameterized SQL queries only; no raw SQL built from user input.

### Not implemented yet
- Email verification, password reset, MFA and OAuth.
- Payment webhooks and Paystack verification.
- Redis-backed caching/session/rate-limit storage (connection/config support is in place).
- Audit-log retention and alerting.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `self-signed certificate` / TLS errors | Set `DATABASE_CA_CERT_PATH` / `REDIS_CA_CERT_PATH` to the correct Aiven CA `.pem` and keep verification enabled |
| `password authentication failed` / connection refused | Verify Aiven service URI, credentials, port, and network access rules |
| Intermittent `ETIMEDOUT` / `ENETUNREACH` (often with a `64:ff9b::` IPv6 address) when connecting locally | Set `DB_FORCE_IPV4=true` to force IPv4 and disable Node's dual-stack auto-selection for DB connections. Also try another network/VPN off, and confirm your IP is allowed in Aiven if IP filters are enabled. |
| `SELF_SIGNED_CERT_IN_CHAIN` | Use the Aiven CA for the correct service/project; remove `sslmode` from `DATABASE_URL` when an explicit CA is configured |
| `relation ... does not exist` | Run `npm --workspace @josstay/server run db:migrate` |
| `exclusion_violation` / booking `409` | The room is already booked for those dates |
| Startup fails with “Production must use Postgres persistence” | Set `DATA_BACKEND=postgres` and database env vars |
| Rate limits are wrong behind a proxy | Set `TRUST_PROXY=1` |
