import "dotenv/config";
import { SEED_BOOKINGS, properties } from "@josstay/shared";
import { checkDatabaseConnection, closeDatabase, getClient, query } from "../src/lib/postgres.js";
import { USES_DATABASE } from "../src/config/env.js";

if (!USES_DATABASE) {
  console.error("DATA_BACKEND must be 'postgres' to clear sample data.");
  process.exit(1);
}

const confirmed = process.argv.includes("--yes");

const seedSlugs = properties.map((property) => property.slug);
const seedLegacyIds = properties.map((property) => property.id);
const seedReferences = SEED_BOOKINGS.map((booking) => booking.reference);

const run = async () => {
  const check = await checkDatabaseConnection();
  if (!check.ok) {
    throw new Error(`Database connection failed: ${check.reason}`);
  }

  const seeded = await query(
    `select id, host_id, slug from public.properties
     where legacy_id = any($1::int[]) and slug = any($2::text[])`,
    [seedLegacyIds, seedSlugs],
  );
  const propertyIds = seeded.rows.map((row) => row.id);
  const hostIds = [...new Set(seeded.rows.map((row) => row.host_id))];

  const bookingCount = await query(
    `select count(*)::int as count from public.bookings
     where reference = any($1::text[]) or property_id = any($2::uuid[])`,
    [seedReferences, propertyIds],
  );

  console.log("[clear-sample] Found:");
  console.log(`  properties: ${propertyIds.length}`);
  console.log(`  bookings:   ${bookingCount.rows[0]?.count || 0}`);
  console.log(`  hosts:      ${hostIds.length} (only unlinked hosts are removed)`);

  if (!confirmed) {
    console.log("[clear-sample] Dry run. Re-run with --yes to delete these rows.");
    return;
  }

  const client = await getClient();
  try {
    await client.query("begin");

    const bookings = await client.query(
      `delete from public.bookings
       where reference = any($1::text[]) or property_id = any($2::uuid[])
       returning id`,
      [seedReferences, propertyIds],
    );

    const props = await client.query(
      `delete from public.properties
       where legacy_id = any($1::int[]) and slug = any($2::text[])
       returning id`,
      [seedLegacyIds, seedSlugs],
    );

    const hosts = await client.query(
      `delete from public.hosts h
       where h.id = any($1::uuid[])
         and h.user_id is null
         and not exists (select 1 from public.properties p where p.host_id = h.id)
       returning id`,
      [hostIds],
    );

    await client.query("commit");
    console.log(
      `[clear-sample] Deleted ${props.rowCount} properties, ${bookings.rowCount} bookings, ${hosts.rowCount} hosts.`,
    );
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally {
    client.release();
  }
};

run()
  .catch((error) => {
    console.error("[clear-sample] Failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
