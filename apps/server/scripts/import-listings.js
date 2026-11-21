import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { AMENITIES } from "@josstay/shared";
import { checkDatabaseConnection, closeDatabase, getClient, query } from "../src/lib/postgres.js";
import { USES_DATABASE } from "../src/config/env.js";

if (!USES_DATABASE) {
  console.error("DATA_BACKEND must be 'postgres' to import listings.");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fileArg = args.find((arg) => !arg.startsWith("--"));

const resolveFile = () => {
  const candidates = [
    fileArg,
    process.env.LISTINGS_FILE,
    path.resolve(process.cwd(), "db/listings.json"),
    path.resolve(process.cwd(), "../../db/listings.json"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = path.isAbsolute(candidate) ? candidate : path.resolve(process.cwd(), candidate);
    if (fs.existsSync(resolved)) return resolved;
  }
  return null;
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const amenityIdPattern = /^[a-zA-Z0-9]+$/;

const HostSchema = z.object({
  key: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().optional(),
  joinedYear: z.number().int().min(2000).max(2100).optional(),
  superhost: z.boolean().optional(),
});

const RoomSchema = z.object({
  code: z.string().regex(slugPattern),
  name: z.string().trim().min(1).max(120),
  price: z.number().int().nonnegative(),
  weekendPrice: z.number().int().nonnegative().optional(),
  capacity: z.number().int().min(1).max(50),
  beds: z.string().trim().min(1).max(120),
  size: z.string().trim().min(1).max(60),
  refundable: z.boolean().optional(),
});

const ReviewSchema = z.object({
  name: z.string().trim().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rating: z.number().int().min(1).max(5),
  quote: z.string().trim().min(1).max(1000),
});

const ListingSchema = z.object({
  slug: z.string().regex(slugPattern),
  name: z.string().trim().min(1).max(160),
  type: z.enum(["hotel", "apartment", "airbnb", "shortlet", "guesthouse"]),
  hostKey: z.string().trim().min(1).max(80),
  area: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(240),
  price: z.number().int().nonnegative(),
  weekendPrice: z.number().int().nonnegative().optional(),
  cleaningFee: z.number().int().nonnegative().optional(),
  badge: z.string().trim().max(80).optional(),
  maxGuests: z.number().int().min(1).max(50).optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().nonnegative().optional(),
  summary: z.string().trim().min(1).max(400),
  description: z.string().trim().min(1).max(6000),
  houseRules: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  images: z.array(z.string().url().startsWith("https://")).max(30).optional(),
  amenities: z.array(z.string().regex(amenityIdPattern)).optional(),
  rooms: z.array(RoomSchema).optional(),
  reviews: z.array(ReviewSchema).optional(),
  verified: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  verificationStatus: z
    .enum(["draft", "pending_review", "verified", "rejected", "suspended"])
    .optional(),
});

const FileSchema = z.object({
  amenitiesCatalog: z
    .array(z.object({ id: z.string().regex(amenityIdPattern), label: z.string().trim().min(1).max(80) }))
    .optional(),
  hosts: z.array(HostSchema).optional().default([]),
  listings: z.array(ListingSchema).min(1),
});

const fail = (message) => {
  console.error(`[import-listings] ${message}`);
  process.exit(1);
};

const loadFile = () => {
  const resolved = resolveFile();
  if (!resolved) {
    fail(
      "No listings file found. Pass a path (e.g. `npm --workspace @josstay/server run db:import-listings -- db/listings.json`) or set LISTINGS_FILE.",
    );
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch (error) {
    fail(`Could not read/parse ${resolved}: ${error.message}`);
  }
  const parsed = FileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[import-listings] Invalid file ${resolved}:`);
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    process.exit(1);
  }
  return { resolved, data: parsed.data };
};

const upsertAmenities = async (catalog = []) => {
  const merged = new Map();
  for (const amenity of AMENITIES) merged.set(amenity.id, amenity.label);
  for (const amenity of catalog) merged.set(amenity.id, amenity.label);

  for (const [id, label] of merged) {
    await query(
      `insert into public.amenities (id, label) values ($1, $2)
       on conflict (id) do update set label = excluded.label`,
      [id, label],
    );
  }
  return new Set(merged.keys());
};

const upsertHost = async (host) => {
  const joinedYear = host.joinedYear || new Date().getFullYear();
  let userId = null;

  if (host.email) {
    const profile = await query(
      "select id from public.profiles where lower(email) = lower($1) limit 1",
      [host.email],
    );
    userId = profile.rows[0]?.id || null;
  }

  if (userId) {
    const existing = await query("select id from public.hosts where user_id = $1::uuid limit 1", [userId]);
    if (existing.rows[0]) {
      await query(
        `update public.hosts
         set name = $2, joined_year = $3, superhost = $4, updated_at = now()
         where user_id = $1::uuid`,
        [userId, host.name, joinedYear, Boolean(host.superhost)],
      );
      return existing.rows[0].id;
    }
  }

  const result = await query(
    `insert into public.hosts (user_id, seed_key, name, joined_year, superhost)
     values ($1::uuid, $2, $3, $4, $5)
     on conflict (seed_key) do update set
       user_id = coalesce(public.hosts.user_id, excluded.user_id),
       name = excluded.name,
       joined_year = excluded.joined_year,
       superhost = excluded.superhost
     returning id`,
    [userId, host.key, host.name, joinedYear, Boolean(host.superhost)],
  );
  return result.rows[0].id;
};

const importListing = async (listing, hostId, knownAmenities) => {
  const isPublished = listing.isPublished !== false;
  const verificationStatus =
    listing.verificationStatus || (isPublished ? "verified" : "draft");
  const verified = listing.verified !== undefined ? listing.verified : verificationStatus === "verified";

  const unknown = (listing.amenities || []).filter((id) => !knownAmenities.has(id));
  if (unknown.length) {
    throw new Error(
      `Unknown amenity id(s): ${unknown.join(", ")}. Add them to "amenitiesCatalog" or use the built-in amenity ids.`,
    );
  }

  const client = await getClient();
  try {
    await client.query("begin");

    const prop = await client.query(
      `insert into public.properties (
         host_id, slug, name, type, area, address, price, weekend_price, cleaning_fee,
         rating, review_count, verified, free_cancellation, distance_km, badge, max_guests,
         summary, description, house_rules, is_published, verification_status,
         verified_at, submitted_for_verification_at
       ) values (
         $1::uuid, $2, $3, $4, $5, $6, $7::int, $8::int, $9::int,
         $10, $11, $12, false, 0, $13, $14,
         $15, $16, $17::text[], $18, $19,
         case when $19 = 'verified' then now() else null end,
         case when $19 = 'pending_review' then now() else null end
       )
       on conflict (slug) do update set
         host_id = excluded.host_id,
         name = excluded.name,
         type = excluded.type,
         area = excluded.area,
         address = excluded.address,
         price = excluded.price,
         weekend_price = excluded.weekend_price,
         cleaning_fee = excluded.cleaning_fee,
         rating = excluded.rating,
         review_count = excluded.review_count,
         verified = excluded.verified,
         badge = excluded.badge,
         max_guests = excluded.max_guests,
         summary = excluded.summary,
         description = excluded.description,
         house_rules = excluded.house_rules,
         is_published = excluded.is_published,
         verification_status = excluded.verification_status,
         verified_at = case
           when excluded.verification_status = 'verified' then coalesce(public.properties.verified_at, now())
           else null
         end,
         submitted_for_verification_at = case
           when excluded.verification_status = 'pending_review' then coalesce(public.properties.submitted_for_verification_at, now())
           else public.properties.submitted_for_verification_at
         end,
         updated_at = now()
       returning id`,
      [
        hostId,
        listing.slug,
        listing.name,
        listing.type,
        listing.area,
        listing.address,
        listing.price,
        listing.weekendPrice ?? listing.price,
        listing.cleaningFee ?? 0,
        listing.rating ?? 0,
        listing.reviewCount ?? 0,
        verified,
        listing.badge ?? null,
        listing.maxGuests ?? 2,
        listing.summary,
        listing.description,
        listing.houseRules || [],
        isPublished,
        verificationStatus,
      ],
    );
    const propertyId = prop.rows[0].id;

    if (listing.images !== undefined) {
      await client.query("delete from public.property_images where property_id = $1::uuid", [propertyId]);
      for (let index = 0; index < listing.images.length; index += 1) {
        await client.query(
          `insert into public.property_images (property_id, url, alt, position)
           values ($1::uuid, $2, $3, $4)`,
          [propertyId, listing.images[index], `${listing.name} photo ${index + 1}`, index],
        );
      }
    }

    if (listing.amenities !== undefined) {
      await client.query("delete from public.property_amenities where property_id = $1::uuid", [propertyId]);
      for (const amenityId of listing.amenities) {
        await client.query(
          `insert into public.property_amenities (property_id, amenity_id)
           values ($1::uuid, $2) on conflict do nothing`,
          [propertyId, amenityId],
        );
      }
    }

    for (const room of listing.rooms || []) {
      await client.query(
        `insert into public.rooms (property_id, code, name, price, weekend_price, capacity, beds, size, refundable)
         values ($1::uuid, $2, $3, $4::int, $5::int, $6, $7, $8, $9)
         on conflict (property_id, code) do update set
           name = excluded.name,
           price = excluded.price,
           weekend_price = excluded.weekend_price,
           capacity = excluded.capacity,
           beds = excluded.beds,
           size = excluded.size,
           refundable = excluded.refundable,
           updated_at = now()`,
        [
          propertyId,
          room.code,
          room.name,
          room.price,
          room.weekendPrice ?? room.price,
          room.capacity,
          room.beds,
          room.size,
          room.refundable !== false,
        ],
      );
    }

    if (listing.reviews !== undefined) {
      await client.query("delete from public.property_reviews where property_id = $1::uuid", [propertyId]);
      for (const review of listing.reviews) {
        await client.query(
          `insert into public.property_reviews (property_id, guest_name, reviewed_on, rating, quote)
           values ($1::uuid, $2, $3::date, $4, $5)`,
          [propertyId, review.name, review.date, review.rating, review.quote],
        );
      }
    }

    await client.query("commit");
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally {
    client.release();
  }
};

const run = async () => {
  const { resolved, data } = loadFile();
  console.log(`[import-listings] ${dryRun ? "Validating" : "Importing"} ${resolved}`);

  if (dryRun) {
    console.log(
      `[import-listings] OK: ${data.listings.length} listing(s), ${data.hosts.length} host(s). No changes written.`,
    );
    return;
  }

  const check = await checkDatabaseConnection();
  if (!check.ok) {
    throw new Error(`Database connection failed: ${check.reason}`);
  }

  const knownAmenities = await upsertAmenities(data.amenitiesCatalog);
  const hostIds = new Map();
  for (const host of data.hosts) {
    hostIds.set(host.key, await upsertHost(host));
  }

  let imported = 0;
  for (const listing of data.listings) {
    const hostId = hostIds.get(listing.hostKey);
    if (!hostId) {
      throw new Error(`Listing "${listing.slug}" references unknown hostKey "${listing.hostKey}".`);
    }
    await importListing(listing, hostId, knownAmenities);
    imported += 1;
    console.log(`[import-listings] upserted ${listing.slug} (${listing.isPublished === false ? "draft" : "published"})`);
  }

  console.log(`[import-listings] Done. ${imported} listing(s) imported.`);
};

run()
  .catch((error) => {
    console.error("[import-listings] Failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
