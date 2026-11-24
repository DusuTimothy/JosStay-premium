# Manual Testing Guide — Brevo and Paystack

This guide explains how to test email delivery and payments by hand. There is no automated test suite in this repository, so these checks are the accepted verification method before and after deployment.

Use this guide in order:

1. Check configuration.
2. Test Brevo.
3. Test Paystack in test mode.
4. Run one controlled live payment only after everything else passes.

Never put real API keys, reset links, or customer card details in tickets, screenshots, or chat messages.

---

## Important URLs

| Purpose | URL |
|---|---|
| Client app | `https://jos-stay-premium.vercel.app` |
| API server | `https://josstay-premium.onrender.com` |
| Paystack webhook | `https://josstay-premium.onrender.com/api/payments/paystack/webhook` |
| Signup | `https://jos-stay-premium.vercel.app` |
| Forgot password | `https://jos-stay-premium.vercel.app/forgot-password` |
| Host payouts | `https://jos-stay-premium.vercel.app/host/dashboard` |
| Admin payout review | `https://jos-stay-premium.vercel.app/account/admin/payouts` |

---

## 1. Check configuration

### Server environment — Render

These variables are read by the Express server. Set them in Render, then redeploy.

```env
DATA_BACKEND=postgres
CLIENT_ORIGIN=https://jos-stay-premium.vercel.app

BREVO_API_KEY=xkeysib_...
BREVO_SENDER_EMAIL=verified-sender@example.com
BREVO_SENDER_NAME=JosStay

PAYSTACK_SECRET_KEY=sk_test_...
```

`CLIENT_ORIGIN` controls two things:

- which browser origins are allowed to call the API;
- the base URL used inside verification and password-reset links.

If `CLIENT_ORIGIN` points to the API server instead of the Vercel client, signup and reset links will open the wrong site. If you allow more than one origin, separate them with commas; the **first** one is used as the public link base.

### Client environment — Vercel

These variables are read by the Next.js app. `NEXT_PUBLIC_*` values are baked into the build, so you must redeploy after changing them.

```env
NEXT_PUBLIC_API_URL=https://josstay-premium.onrender.com
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_...
```

### Match the Paystack mode

Use one mode at a time:

| Mode | Server key | Client key | Paystack dashboard |
|---|---|---|---|
| Test | `sk_test_...` | `pk_test_...` | Test mode |
| Live | `sk_live_...` | `pk_live_...` | Live mode |

Do not mix a test secret key with a live public key, or the checkout will fail.

### Quick local config check

Without printing secret values:

```bash
cd apps/server
node --input-type=module -e '
import "dotenv/config";
import { BREVO_API_KEY, BREVO_SENDER_EMAIL, PAYSTACK_SECRET_KEY, CLIENT_ORIGIN, DATA_BACKEND } from "./src/config/env.js";
const shape = (v) => v ? `${v.slice(0, 7)}…` : "unset";
console.log({
  brevoKey: shape(BREVO_API_KEY),
  brevoSender: BREVO_SENDER_EMAIL || "unset",
  paystackSecret: shape(PAYSTACK_SECRET_KEY),
  clientOrigin: CLIENT_ORIGIN,
  dataBackend: DATA_BACKEND,
});
'
```

Expected:

- `brevoKey` starts with `xkeysib…`
- `brevoSender` is your verified sender address
- `paystackSecret` starts with `sk_test…` during testing
- `clientOrigin` is `https://jos-stay-premium.vercel.app`
- `dataBackend` is `postgres`

---

## 2. Test Brevo

### 2.1 Prepare Brevo

In the Brevo dashboard:

1. Verify the sender email address or the sending domain.
2. Create an API key with permission to send transactional email.
3. Copy the key into `BREVO_API_KEY` on Render.
4. Put the verified address in `BREVO_SENDER_EMAIL`.
5. Redeploy Render.

If the sender is not verified, Brevo will usually reject the request with a `400` error.

### 2.2 Direct Brevo API check

This proves the key and sender work before involving the app.

```bash
cd apps/server
set -a; . ./.env; set +a

curl -i -X POST https://api.brevo.com/v3/smtp/email \
  -H "api-key: $BREVO_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"sender\": {\"email\": \"$BREVO_SENDER_EMAIL\", \"name\": \"JosStay\"},
    \"to\": [{\"email\": \"your-inbox@example.com\"}],
    \"subject\": \"JosStay Brevo test\",
    \"textContent\": \"Brevo is working.\"
  }"
```

Success looks like:

- HTTP `201`
- a JSON response containing `messageId`
- the email arrives in the inbox, or at least appears in Brevo’s email log

Failure clues:

| Result | Likely cause |
|---|---|
| `401` or `403` | Wrong API key, or key lacks email-send permission |
| `400` about sender | Sender email/domain is not verified in Brevo |
| `422` about recipient | Invalid recipient address or malformed request |
| No inbox email | Check spam, Brevo logs, and suppression/blocked contacts |

### 2.3 Signup verification email

Use a fresh email address, for example `josstay-test-20261124@example.com`.

1. Open `https://jos-stay-premium.vercel.app`.
2. Sign up with that email.
3. You should receive an email titled **“Verify your JosStay email address”**.
4. Open the email and click **Verify email**.
5. The browser should open `/verify-email?token=...` on the Vercel client.
6. Sign in with the same email and password. It should succeed.

Success looks like:

- email appears in Brevo’s transactional log with status accepted/delivered;
- the link opens the Vercel client, not the Render API domain;
- sign-in works only after verification.

### 2.4 Password reset email

1. Open `https://jos-stay-premium.vercel.app/forgot-password`.
2. Enter the same email address.
3. You should receive **“Reset your JosStay password”**.
4. Open the link.
5. Set a new password.
6. Sign in with the new password and confirm the old password no longer works.

The forgot-password endpoint always returns the same generic message, even for unknown emails. That is intentional. Use the inbox and Brevo log to confirm real delivery.

Failure clues:

| Symptom | Likely cause |
|---|---|
| No email for a known account | Brevo config, sender verification, spam, rate limit, or account has no password (Google-only account) |
| Link opens API domain | `CLIENT_ORIGIN` is wrong |
| Link says invalid/expired | Token expired or was already used |
| Development only: link in server console | Brevo is not configured and `NODE_ENV` is not production |

---

## 3. Test Paystack in test mode

### 3.1 Paystack dashboard setup

1. Switch the Paystack dashboard to **Test Mode**.
2. Copy the test secret key into Render’s `PAYSTACK_SECRET_KEY`.
3. Copy the matching test public key into Vercel’s `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`.
4. Redeploy Render and Vercel.
5. In Paystack **Settings → Webhooks**, add:
   ```text
   https://josstay-premium.onrender.com/api/payments/paystack/webhook
   ```
6. Subscribe at least to `charge.success`.

The app verifies the `x-paystack-signature` header with `PAYSTACK_SECRET_KEY`. There is no separate webhook secret to copy.

### 3.2 API connectivity check

```bash
cd apps/server
set -a; . ./.env; set +a

curl -i https://api.paystack.co/bank \
  -H "Authorization: Bearer $PAYSTACK_SECRET_KEY"
```

Success looks like:

- HTTP `200`
- JSON with `"status": true`
- a list of Nigerian banks

Failure clues:

| Result | Likely cause |
|---|---|
| `401` | Wrong or expired secret key |
| `403` | Key does not allow the endpoint |
| Timeout | Network/Render egress problem |

You can also test through the app by signing in as a host and opening the Payouts tab. The bank list endpoint is:

```text
GET /api/host/payout-methods/banks
```

If Paystack is unavailable, the app falls back to a built-in bank list and shows sample data.

### 3.3 Webhook delivery and signature check

Send a harmless event first. This checks routing and signature only. It does not mark any booking as paid.

```bash
cd apps/server
set -a; . ./.env; set +a

BODY='{"event":"ping","data":{}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha512 -hmac "$PAYSTACK_SECRET_KEY" -hex | awk '{print $2}')

curl -i -X POST https://josstay-premium.onrender.com/api/payments/paystack/webhook \
  -H "Content-Type: application/json" \
  -H "x-paystack-signature: $SIG" \
  -d "$BODY"
```

Expected response:

```json
{"received":true}
```

Bad signature check:

```bash
curl -i -X POST https://josstay-premium.onrender.com/api/payments/paystack/webhook \
  -H "Content-Type: application/json" \
  -H "x-paystack-signature: bad-signature" \
  -d '{"event":"ping","data":{}}'
```

Expected response: `401 Invalid webhook signature`.

Notes:

- The signature is HMAC SHA-512 over the **exact raw JSON body**. Do not reformat the body between signing and sending.
- Paystack’s dashboard “send test event” button is useful for delivery testing, but a generic event has no `metadata.bookingReference`, so it will not confirm a booking.
- A repeated event should return `{"received":true,"duplicate":true}`.

### 3.4 Full test checkout

This is the real end-to-end check.

1. Open `https://jos-stay-premium.vercel.app`.
2. Search Jos, choose dates, and pick an available property/room.
3. Continue to checkout.
4. Confirm the displayed total includes any separate **Payment fee** line.
5. Complete payment with these Paystack test details:
   ```text
   Card number: 4084084084084081
   Expiry:      any future date, for example 12/30
   CVV:         000
   PIN:         0000 if prompted
   OTP:         123456
   ```
6. After payment, confirm all of the following:
   - Paystack test dashboard shows a successful transaction.
   - The browser returns to the JosStay confirmation page for that booking.
   - The booking’s payment status is `paid` in the database/admin views.
   - A booking confirmation email arrives through Brevo.
   - The confirmation email shows the full charged amount: stay total plus payment fee.
   - Server logs show the `charge.success` webhook was received.

If you know the Paystack reference, you can also check it through:

```text
GET /api/payments/paystack/verify?reference=<paystack-reference>
```

This endpoint requires an authenticated user token.

### 3.5 Duplicate and failed-event checks

After a successful test booking:

- Resend the same Paystack event. It should be treated as a duplicate and not apply the payment twice.
- Send an event with an invalid signature. It should return `401`.
- Confirm only one payment/booking state change occurred.

Do not manually mutate production rows for these checks. Use Paystack’s event resend feature or the signed webhook command above.

### 3.6 Payout bank verification

Phase 1 payouts do not move money automatically, but bank details are verified through Paystack.

1. Sign in as a host.
2. Open `/host/dashboard` → **Payouts**.
3. Add a bank and 10-digit account number using Paystack’s documented test bank details for the active mode.
4. Confirm the account name returned by Paystack is stored and the account number is masked in the UI.
5. Confirm bank changes are blocked while a payout request is open.

Admin settlement is manual: approve the request, make the transfer in the Paystack dashboard, then return to `/account/admin/payouts` and record the transfer reference.

---

## 4. Controlled live test

Run this only after every test-mode check above passes.

1. Switch both environments to live keys:
   ```env
   # Render
   PAYSTACK_SECRET_KEY=sk_live_...

   # Vercel
   NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_...
   ```
2. Redeploy Render and Vercel.
3. In the Paystack **live** dashboard, confirm the webhook URL is:
   ```text
   https://josstay-premium.onrender.com/api/payments/paystack/webhook
   ```
4. Make one small real booking with a real card.
5. Verify:
   - Paystack live transaction is successful;
   - webhook was received;
   - booking is `paid`;
   - confirmation email arrived;
   - no duplicate charge or duplicate booking update occurred.
6. If the booking must be cancelled, refund the **full charged amount** (`bookings.total + bookings.payment_fee`) manually in the Paystack dashboard. The platform absorbs the processing fee on refunds; the guest is never asked to pay it again.
7. Do not use Paystack’s automated refund or transfer features from this app. Refunds and host payouts remain manual in Phase 1.

After the live test, consider returning the app to test keys until you are ready for normal live traffic.

---

## 5. Local development note

If you test the webhook against your local server instead of Render, Paystack needs a public URL:

```bash
ngrok http 4000
```

Then use:

```text
https://<ngrok-subdomain>.ngrok-free.app/api/payments/paystack/webhook
```

Remember that `NEXT_PUBLIC_*` values are baked into the client build. If you point the local client at a local API, restart/rebuild the client after changing `.env.local`.

---

## 6. Sign-off record

Copy this table into your release notes after testing.

| Check | Date | Result | Notes |
|---|---|---|---|
| Brevo direct API |  | Pass / Fail |  |
| Signup verification email |  | Pass / Fail |  |
| Password reset email |  | Pass / Fail |  |
| Paystack API connectivity |  | Pass / Fail |  |
| Webhook valid signature |  | Pass / Fail |  |
| Webhook invalid signature |  | Pass / Fail |  |
| Test-mode checkout |  | Pass / Fail |  |
| Duplicate webhook |  | Pass / Fail |  |
| Payout bank verification |  | Pass / Fail |  |
| Controlled live payment |  | Pass / Fail / Skipped |  |
| Live refund, if needed |  | Pass / Fail / N/A | Full charged amount |

Keep the record without secrets, card numbers, reset tokens, or full webhook payloads.
