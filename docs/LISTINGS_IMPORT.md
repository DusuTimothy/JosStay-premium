# Importing Listings

Use this to load or update inventory in bulk. For one-off listings, hosts/admins can also use the host dashboard (`/host/dashboard`).

> **Do not import the example file into production.** `db/listings.example.json` contains sample content for shape reference only. Real listings need verified names, addresses, prices, photos, amenities, and policies.

## Command

```bash
# validate only (no DB writes)
npm --workspace @josstay/server run db:import-listings -- db/listings.json --dry-run

# import / upsert
npm --workspace @josstay/server run db:import-listings -- db/listings.json
```

- A path can also be supplied via `LISTINGS_FILE`.
- Defaults: `db/listings.json`, then `../../db/listings.json` (relative to `apps/server`).
- Requires `DATA_BACKEND=postgres` and the same DB env used by the API.

## Idempotency

- `listings[].slug` is the stable key. Re-running upserts the same property, rooms, images, amenities, and reviews instead of duplicating.
- `images`, `amenities`, and `reviews` are replaced only when the field is present in the file.
- Rooms are upserted by `(property, code)`; rooms removed from the file are left in place (delete them in the UI/DB if needed).
- Hosts are matched by `hosts[].email` (to an existing profile) or by `hosts[].key` (seed key).

## File shape

```json
{
  "hosts": [
    {
      "key": "grace-pam",
      "name": "Grace Pam",
      "email": "grace@example.com",
      "joinedYear": 2023,
      "superhost": true
    }
  ],
  "listings": [
    {
      "slug": "crestview-boutique-hotel",
      "name": "Crestview Boutique Hotel",
      "type": "hotel",
      "hostKey": "grace-pam",
      "area": "Jos North",
      "address": "18 Rwang Pam Street, Jos North",
      "price": 85000,
      "weekendPrice": 95000,
      "cleaningFee": 6000,
      "badge": "Guest favourite",
      "maxGuests": 4,
      "rating": 4.8,
      "reviewCount": 184,
      "summary": "Short summary (max 400 chars).",
      "description": "Full verified description (max 6000 chars).",
      "houseRules": ["Check-in from 2:00 PM", "No smoking indoors"],
      "images": ["https://res.cloudinary.com/<cloud>/image/upload/..."],
      "amenities": ["wifi", "backupPower", "parking"],
      "rooms": [
        {
          "code": "deluxe",
          "name": "Deluxe Room",
          "price": 85000,
          "weekendPrice": 95000,
          "capacity": 2,
          "beds": "1 king bed",
          "size": "28 m²",
          "refundable": true
        }
      ],
      "reviews": [
        { "name": "Adaeze O.", "date": "2026-10-01", "rating": 5, "quote": "Great stay." }
      ],
      "isPublished": true
    }
  ]
}
```

### Rules

- `slug`, room `code`: lowercase letters, numbers, single hyphens (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
- `type`: `hotel`, `apartment`, `airbnb`, `shortlet`, or `guesthouse`.
- `images`: `https://` URLs only, max 30.
- `amenities`: built-in ids (`backupPower`, `wifi`, `ac`, `parking`, `breakfast`, `security`, `water`) or ids declared in `amenitiesCatalog`:

```json
"amenitiesCatalog": [{ "id": "pool", "label": "Swimming pool" }]
```

- `isPublished: false` imports a draft (hidden from search). Published imports are marked `verification_status=verified`, `verified=true`.
- `rating`/`reviewCount` should reflect real reviews; leave `0` if none.

## Running against Render/Aiven

Your local network may not reach Aiven reliably. If `db:import-listings` times out locally:

1. Commit the listings file (or a temporary copy) to the repo.
2. Temporarily set Render's start command to include the import, deploy, then restore it:
   ```bash
   npm --workspace @josstay/server run db:import-listings -- db/listings.json && npm --workspace @josstay/server run start
   ```
3. Watch the deploy logs for `[import-listings]` output, then revert the start command to:
   ```bash
   npm --workspace @josstay/server run start
   ```

The import is idempotent, but avoid leaving it permanently in the start command (it shouldn't run on every boot).

## Verifying

```bash
curl -s "https://<api-domain>/api/properties" | head -c 400
```

Expect `"sampleData":false` and `count` matching your published listings. Then check `/search` and a property page in the client.
