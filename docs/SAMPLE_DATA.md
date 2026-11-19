# Sample Data — JosStay Premium

> ⚠️ **SAMPLE DATA** — Every listing, review, host name and price below is fictional and exists only for the demo. Replace it in `packages/shared/data.js`.

## Properties (10)

| # | Name | Type | Area | ₦ / night | Rating | Verified | Free cancellation |
|---|------|------|------|-----------|--------|----------|-------------------|
| 1 | Crestview Boutique Hotel | Hotel | Jos North | 85,000 | 4.8 | Yes | Yes |
| 2 | Rayfield Palm Residence | Apartment | Rayfield | 120,000 | 4.9 | Yes | Yes |
| 3 | Hilltop Guest House | Guest house | Jos South | 32,000 | 4.5 | Yes | No |
| 4 | Bukuru Garden Shortlet | Shortlet | Bukuru | 28,000 | 4.6 | Yes | Yes |
| 5 | Plateau Rock Suites | Hotel | Jos North | 65,000 | 4.7 | Yes | Yes |
| 6 | Zaria Road Executive Apartment | Apartment | Jos North | 55,000 | 4.4 | No | Yes |
| 7 | Shere Hills Lodge | Airbnb-style | Jos South | 150,000 | 4.9 | Yes | Yes |
| 8 | Naraguta Cozy Studio | Airbnb-style | Jos North | 18,000 | 4.3 | Yes | No |
| 9 | Liberty Boulevard Guest House | Guest house | Jos South | 10,000 | 4.1 | No | Yes |
| 10 | Goldcrest Apartments | Apartment | Rayfield | 95,000 | 4.7 | Yes | Yes |

## Popular areas
- Jos North
- Jos South
- Rayfield
- Bukuru

## Amenities
`Backup power`, `Wi-Fi`, `Air conditioning`, `Parking`, `Breakfast`, `24/7 security`, `Water supply`

## Room / unit options
Each property has 2–3 units with names such as *Deluxe Room*, *Executive Suite*, *Two-bedroom Apartment*, *Garden Studio*, each with a price delta and capacity.

## Reviews
Each property carries 3 sample reviews with guest name, date, rating, and quote.

## Images
Placeholder photography from `picsum.photos` with deterministic seeds (`josstay-<id>-1..5`) so the gallery is stable across reloads.

## Conversion
- Base currency: NGN.
- Indicative USD rate: **₦1,550 = $1** (display only; replace with a live FX feed in production).

## Bookings
- Demo booking reference format: `JS-XXXXXX`.
- Seed bookings for "My bookings" plus any booking created during the session.
- Host payouts are sample figures (gross, commission, net).
