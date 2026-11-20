import "dotenv/config";
import { checkDatabaseConnection, closeDatabase, query } from "../src/lib/postgres.js";
import { USES_DATABASE } from "../src/config/env.js";

if (!USES_DATABASE) {
  console.error("DATA_BACKEND must be 'postgres' to verify the database.");
  process.exit(1);
}

let failures = 0;

const pass = (label) => console.log(`  ✓ ${label}`);
const fail = (label, detail) => {
  failures += 1;
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
};

const expect = async (label, fn) => {
  try {
    const ok = await fn();
    if (ok) pass(label);
    else fail(label);
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error));
  }
};

const run = async () => {
  console.log("Checking PostgreSQL connectivity and schema...");

  const check = await checkDatabaseConnection();
  if (!check.ok) {
    fail("database connection", check.reason);
  } else {
    pass("database connection");
  }

  await expect("required tables exist", async () => {
    const { rows } = await query(
      `select table_name
       from information_schema.tables
       where table_schema = 'public'
         and table_name = any($1::text[])`,
      [[
        "profiles",
        "hosts",
        "properties",
        "property_images",
        "rooms",
        "amenities",
        "property_amenities",
        "property_reviews",
        "bookings",
        "payouts",
      ]],
    );
    return rows.length === 10;
  });

  await expect("booking overlap exclusion constraint exists", async () => {
    const { rows } = await query(
      `select 1
       from pg_constraint
       where conname = 'bookings_no_overlapping_room_stay'
       limit 1`,
    );
    return rows.length === 1;
  });

  await expect("can read published properties", async () => {
    const { rows } = await query(
      "select id from public.properties where is_published = true limit 1",
    );
    return rows.length >= 0; // table accessible; seed may be empty
  });

  await expect("amenities table is readable", async () => {
    await query("select id from public.amenities limit 1");
    return true;
  });

  const counts = await query(
    `select
      (select count(*)::int from public.properties) as properties,
      (select count(*)::int from public.rooms) as rooms,
      (select count(*)::int from public.bookings) as bookings,
      (select count(*)::int from public.profiles) as profiles`
  ).catch(() => ({ rows: [{}] }));

  const c = counts.rows[0] || {};
  console.log(
    `  • counts: properties=${c.properties ?? "?"}, rooms=${c.rooms ?? "?"}, bookings=${c.bookings ?? "?"}, profiles=${c.profiles ?? "?"}`,
  );

  if (failures) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }

  console.log("\nDatabase checks passed.");
};

const formatError = (error) => {
  if (!(error instanceof Error)) return String(error);
  const parts = [error.message, error.code].filter(Boolean);
  if (Array.isArray(error.errors) && error.errors.length) {
    const inner = error.errors
      .map((entry) => (entry instanceof Error ? entry.message || entry.code : String(entry)))
      .filter(Boolean)
      .join("; ");
    if (inner) parts.push(inner);
  }
  return parts.join(" | ") || error.name || "Unknown error";
};

run()
  .catch((error) => {
    console.error("[verify-db] Failed:", formatError(error));
    process.exit(1);
  })
  .finally(async () => {
    await closeDatabase();
  });