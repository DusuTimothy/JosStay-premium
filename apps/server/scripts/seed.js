import "dotenv/config";
import {
  AMENITIES,
  SEED_BOOKINGS,
  getProperty,
  properties,
  quoteStay,
} from "@josstay/shared";
import { checkDatabaseConnection, closeDatabase, getClient, query } from "../src/lib/postgres.js";
import { USES_DATABASE } from "../src/config/env.js";

if (!USES_DATABASE) {
  console.error("DATA_BACKEND must be 'postgres' to run the seed script.");
  process.exit(1);
}

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const MONTHS = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const parseMonth = (label) => {
  const [month, year] = String(label || "").trim().split(/\s+/);
  if (!(month in MONTHS) || !/^\d{4}$/.test(year || "")) return null;
  return new Date(Date.UTC(Number(year), MONTHS[month], 1))
    .toISOString()
    .slice(0, 10);
};

const roomMap = new Map();
const propertyMap = new Map();
let hostIdForPayouts = null;

const seedAmenities = async () => {
  for (const amenity of AMENITIES) {
    await query(
      `insert into public.amenities (id, label)
       values ($1, $2)
       on conflict (id) do update set label = excluded.label`,
      [amenity.id, amenity.label],
    );
  }
};

const seedProperty = async (property) => {
  const client = await getClient();
  try {
    await client.query("begin");
    const hostKey = slugify(property.host?.name || `host-${property.id}`);

    const hostResult = await client.query(
      `insert into public.hosts (seed_key, name, joined_year, superhost)
       values ($1, $2, $3, $4)
       on conflict (seed_key) do update
         set name = excluded.name,
             joined_year = excluded.joined_year,
             superhost = excluded.superhost
       returning id`,
      [
        hostKey,
        property.host?.name || "JosStay Host",
        Number(property.host?.joined) || new Date().getFullYear(),
        Boolean(property.host?.superhost),
      ],
    );
    const host = hostResult.rows[0];
    if (!hostIdForPayouts) hostIdForPayouts = host.id;

    const propertyResult = await client.query(
      `insert into public.properties (
        legacy_id, host_id, slug, name, type, area, address, price, cleaning_fee,
        rating, review_count, verified, free_cancellation, distance_km, badge,
        max_guests, summary, description, house_rules, is_published
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,$15,
        $16,$17,$18,$19::text[],true
      )
      on conflict (slug) do update set
        legacy_id = excluded.legacy_id,
        host_id = excluded.host_id,
        name = excluded.name,
        type = excluded.type,
        area = excluded.area,
        address = excluded.address,
        price = excluded.price,
        cleaning_fee = excluded.cleaning_fee,
        rating = excluded.rating,
        review_count = excluded.review_count,
        verified = excluded.verified,
        free_cancellation = excluded.free_cancellation,
        distance_km = excluded.distance_km,
        badge = excluded.badge,
        max_guests = excluded.max_guests,
        summary = excluded.summary,
        description = excluded.description,
        house_rules = excluded.house_rules,
        is_published = excluded.is_published
      returning id`,
      [
        property.id,
        host.id,
        property.slug,
        property.name,
        property.type,
        property.area,
        property.address,
        property.price,
        property.cleaningFee,
        property.rating,
        property.reviewCount,
        property.verified,
        property.freeCancellation,
        property.distanceKm,
        property.badge ?? null,
        property.maxGuests,
        property.summary,
        property.description,
        property.houseRules || [],
      ],
    );
    const row = propertyResult.rows[0];
    propertyMap.set(property.slug, row.id);

    await client.query("delete from public.property_images where property_id = $1::uuid", [row.id]);
    for (let index = 0; index < property.images.length; index += 1) {
      await client.query(
        `insert into public.property_images (property_id, url, alt, position)
         values ($1::uuid, $2, $3, $4)`,
        [row.id, property.images[index], `${property.name} photo ${index + 1}`, index],
      );
    }

    await client.query("delete from public.property_amenities where property_id = $1::uuid", [row.id]);
    for (const amenityId of property.amenities || []) {
      await client.query(
        `insert into public.property_amenities (property_id, amenity_id)
         values ($1::uuid, $2)
         on conflict do nothing`,
        [row.id, amenityId],
      );
    }

    await client.query("delete from public.property_reviews where property_id = $1::uuid", [row.id]);
    for (const review of property.reviews || []) {
      const reviewedOn = parseMonth(review.date);
      if (!reviewedOn) continue;
      await client.query(
        `insert into public.property_reviews (property_id, guest_name, reviewed_on, rating, quote)
         values ($1::uuid, $2, $3::date, $4, $5)`,
        [row.id, review.name, reviewedOn, review.rating, review.quote],
      );
    }

    for (const room of property.rooms || []) {
      await client.query(
        `insert into public.rooms (property_id, code, name, price, capacity, beds, size, refundable)
         values ($1::uuid,$2,$3,$4,$5,$6,$7,$8)
         on conflict (property_id, code) do update set
           name = excluded.name,
           price = excluded.price,
           capacity = excluded.capacity,
           beds = excluded.beds,
           size = excluded.size,
           refundable = excluded.refundable`,
        [
          row.id,
          room.id,
          room.name,
          room.price,
          room.capacity,
          room.beds,
          room.size,
          room.refundable,
        ],
      );
    }

    const savedRooms = await client.query(
      "select id, code from public.rooms where property_id = $1::uuid",
      [row.id],
    );
    const map = new Map();
    for (const room of savedRooms.rows) map.set(room.code, room.id);
    roomMap.set(property.slug, map);

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

const seedBookings = async () => {
  const guestEmail = process.env.SEED_GUEST_EMAIL?.trim().toLowerCase();
  let guestId = null;

  if (guestEmail) {
    const { rows } = await query(
      "select id from public.profiles where lower(email) = lower($1) limit 1",
      [guestEmail],
    );
    guestId = rows[0]?.id ?? null;
    if (!guestId) {
      console.warn(
        `[seed] Guest ${guestEmail} does not exist. Seed bookings will have no user_id.`,
      );
    }
  }

  for (const booking of SEED_BOOKINGS) {
    const property = getProperty(booking.propertySlug);
    const propertyId = propertyMap.get(booking.propertySlug);
    const roomId = roomMap.get(booking.propertySlug)?.get(booking.roomId);

    if (!property || !propertyId || !roomId) {
      console.warn(`[seed] Skipping booking ${booking.reference}: property/room missing`);
      continue;
    }

    const quote = quoteStay(property, booking.checkIn, booking.checkOut, {
      roomId: booking.roomId,
      airportPickup: booking.airportPickup,
    });

    try {
      await query(
        `insert into public.bookings (
          reference, user_id, property_id, room_id, check_in, check_out, guests,
          airport_pickup, payment_method, guest_first_name, guest_last_name,
          guest_email, guest_phone, status, total, currency, quote
        ) values (
          $1,$2::uuid,$3::uuid,$4::uuid,$5::date,$6::date,$7,
          $8,'card',$9,$10,$11,$12,$13::public.booking_status,$14,'NGN',$15::jsonb
        )
        on conflict (reference) do update set
          user_id = excluded.user_id,
          property_id = excluded.property_id,
          room_id = excluded.room_id,
          check_in = excluded.check_in,
          check_out = excluded.check_out,
          guests = excluded.guests,
          airport_pickup = excluded.airport_pickup,
          payment_method = excluded.payment_method,
          guest_first_name = excluded.guest_first_name,
          guest_last_name = excluded.guest_last_name,
          guest_email = excluded.guest_email,
          guest_phone = excluded.guest_phone,
          status = excluded.status,
          total = excluded.total,
          currency = excluded.currency,
          quote = excluded.quote`,
        [
          booking.reference,
          guestId,
          propertyId,
          roomId,
          booking.checkIn,
          booking.checkOut,
          booking.guests,
          booking.airportPickup,
          "Demo",
          "Guest",
          guestEmail || "demo@josstay.app",
          "+2348000000000",
          booking.status,
          quote.total,
          JSON.stringify(quote),
        ],
      );
    } catch (error) {
      console.warn(`[seed] Booking ${booking.reference} skipped: ${error.message}`);
    }
  }
};

const seedPayouts = async () => {
  if (!hostIdForPayouts) return;

  const payouts = [
    {
      reference: "JS-HST100",
      gross: 301000,
      commission: 30100,
      net: 270900,
      status: "paid",
    },
    {
      reference: "JS-HST101",
      gross: 260000,
      commission: 26000,
      net: 234000,
      status: "scheduled",
    },
    {
      reference: "JS-HST102",
      gross: 181000,
      commission: 18100,
      net: 162900,
      status: "on_hold",
    },
  ];

  for (const payout of payouts) {
    await query(
      `insert into public.payouts (host_id, reference, gross, commission, net, status)
       values ($1::uuid,$2,$3,$4,$5,$6::public.payout_status)
       on conflict (reference) do update set
         host_id = excluded.host_id,
         gross = excluded.gross,
         commission = excluded.commission,
         net = excluded.net,
         status = excluded.status`,
      [
        hostIdForPayouts,
        payout.reference,
        payout.gross,
        payout.commission,
        payout.net,
        payout.status,
      ],
    );
  }
};

const run = async () => {
  const check = await checkDatabaseConnection();
  if (!check.ok) {
    throw new Error(`Database connection failed: ${check.reason}`);
  }

  console.log("Seeding JosStay sample data into PostgreSQL...");
  await seedAmenities();

  for (const property of properties) {
    await seedProperty(property);
    console.log(`  ✓ ${property.slug}`);
  }

  await seedBookings();
  await seedPayouts();

  console.log("Seed complete.");
  console.log("Next: run `npm --workspace @josstay/server run db:verify`.");
};

run()
  .catch((error) => {
    console.error("[seed] Failed:", error.message);
    process.exit(1);
  })
  .finally(async () => {
    await closeDatabase();
  });