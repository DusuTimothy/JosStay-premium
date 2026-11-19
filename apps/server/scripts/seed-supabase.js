import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  AMENITIES,
  SEED_BOOKINGS,
  getProperty,
  properties,
  quoteStay,
} from "@josstay/shared";

const url = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceRoleKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Put them in apps/server/.env first.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
});

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

const fail = (label, error) => {
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
};

const roomMap = new Map();
const propertyMap = new Map();
let hostIdForPayouts = null;

const seedAmenities = async () => {
  const { error } = await supabase
    .from("amenities")
    .upsert(
      AMENITIES.map((amenity) => ({ id: amenity.id, label: amenity.label })),
      { onConflict: "id" },
    );
  fail("amenities", error);
};

const seedProperty = async (property) => {
  const hostKey = slugify(property.host?.name || `host-${property.id}`);

  const { data: host, error: hostError } = await supabase
    .from("hosts")
    .upsert(
      {
        seed_key: hostKey,
        name: property.host?.name || "JosStay Host",
        joined_year: Number(property.host?.joined) || new Date().getFullYear(),
        superhost: Boolean(property.host?.superhost),
      },
      { onConflict: "seed_key" },
    )
    .select("id")
    .single();
  fail(`host ${hostKey}`, hostError);

  if (!hostIdForPayouts) hostIdForPayouts = host.id;

  const { data: row, error: propertyError } = await supabase
    .from("properties")
    .upsert(
      {
        legacy_id: property.id,
        host_id: host.id,
        slug: property.slug,
        name: property.name,
        type: property.type,
        area: property.area,
        address: property.address,
        price: property.price,
        cleaning_fee: property.cleaningFee,
        rating: property.rating,
        review_count: property.reviewCount,
        verified: property.verified,
        free_cancellation: property.freeCancellation,
        distance_km: property.distanceKm,
        badge: property.badge ?? null,
        max_guests: property.maxGuests,
        summary: property.summary,
        description: property.description,
        house_rules: property.houseRules,
        is_published: true,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  fail(`property ${property.slug}`, propertyError);

  propertyMap.set(property.slug, row.id);

  fail(
    "property images delete",
    (
      await supabase
        .from("property_images")
        .delete()
        .eq("property_id", row.id)
    ).error,
  );

  fail(
    "property images insert",
    (
      await supabase.from("property_images").insert(
        property.images.map((imageUrl, index) => ({
          property_id: row.id,
          url: imageUrl,
          alt: `${property.name} photo ${index + 1}`,
          position: index,
        })),
      )
    ).error,
  );

  fail(
    "property amenities delete",
    (
      await supabase
        .from("property_amenities")
        .delete()
        .eq("property_id", row.id)
    ).error,
  );

  fail(
    "property amenities insert",
    (
      await supabase.from("property_amenities").insert(
        property.amenities.map((amenityId) => ({
          property_id: row.id,
          amenity_id: amenityId,
        })),
      )
    ).error,
  );

  fail(
    "reviews delete",
    (
      await supabase
        .from("property_reviews")
        .delete()
        .eq("property_id", row.id)
    ).error,
  );

  const reviews = (property.reviews || [])
    .map((review) => {
      const reviewedOn = parseMonth(review.date);
      if (!reviewedOn) return null;
      return {
        property_id: row.id,
        guest_name: review.name,
        reviewed_on: reviewedOn,
        rating: review.rating,
        quote: review.quote,
      };
    })
    .filter(Boolean);

  if (reviews.length) {
    fail(
      "reviews insert",
      (await supabase.from("property_reviews").insert(reviews)).error,
    );
  }

  const rooms = property.rooms.map((room) => ({
    property_id: row.id,
    code: room.id,
    name: room.name,
    price: room.price,
    capacity: room.capacity,
    beds: room.beds,
    size: room.size,
    refundable: room.refundable,
  }));

  fail(
    "rooms upsert",
    (
      await supabase
        .from("rooms")
        .upsert(rooms, { onConflict: "property_id,code" })
    ).error,
  );

  const { data: savedRooms, error: roomError } = await supabase
    .from("rooms")
    .select("id, code")
    .eq("property_id", row.id);
  fail(`rooms ${property.slug}`, roomError);

  const map = new Map();
  for (const room of savedRooms || []) map.set(room.code, room.id);
  roomMap.set(property.slug, map);
};

const seedBookings = async () => {
  const guestEmail = process.env.SEED_GUEST_EMAIL?.trim().toLowerCase();
  let guestId = null;

  if (guestEmail) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", guestEmail)
      .maybeSingle();
    fail("seed guest lookup", error);
    guestId = data?.id ?? null;
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

    const { error } = await supabase.from("bookings").upsert(
      {
        reference: booking.reference,
        user_id: guestId,
        property_id: propertyId,
        room_id: roomId,
        check_in: booking.checkIn,
        check_out: booking.checkOut,
        guests: booking.guests,
        airport_pickup: booking.airportPickup,
        payment_method: "card",
        guest_first_name: "Demo",
        guest_last_name: "Guest",
        guest_email: guestEmail || "demo@josstay.app",
        guest_phone: "+2348000000000",
        status: booking.status,
        total: quote.total,
        quote,
      },
      { onConflict: "reference" },
    );

    if (error) {
      console.warn(`[seed] Booking ${booking.reference} skipped: ${error.message}`);
    }
  }
};

const seedPayouts = async () => {
  if (!hostIdForPayouts) return;

  const payouts = [
    {
      host_id: hostIdForPayouts,
      reference: "JS-HST100",
      gross: 301000,
      commission: 30100,
      net: 270900,
      status: "paid",
    },
    {
      host_id: hostIdForPayouts,
      reference: "JS-HST101",
      gross: 260000,
      commission: 26000,
      net: 234000,
      status: "scheduled",
    },
    {
      host_id: hostIdForPayouts,
      reference: "JS-HST102",
      gross: 181000,
      commission: 18100,
      net: 162900,
      status: "on_hold",
    },
  ];

  fail(
    "payouts upsert",
    (await supabase.from("payouts").upsert(payouts, { onConflict: "reference" }))
      .error,
  );
};

const run = async () => {
  console.log("Seeding JosStay sample data into Supabase...");
  await seedAmenities();

  for (const property of properties) {
    await seedProperty(property);
    console.log(`  ✓ ${property.slug}`);
  }

  await seedBookings();
  await seedPayouts();

  console.log("Seed complete.");
  console.log("Next: run `npm --workspace @josstay/server run db:verify` with the anon key.");
};

run().catch((error) => {
  console.error("[seed] Failed:", error.message);
  process.exit(1);
});
