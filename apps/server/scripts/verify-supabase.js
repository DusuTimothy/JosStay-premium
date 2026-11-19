import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL?.trim();
const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !anonKey || !serviceRoleKey) {
  console.error(
    "Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY before verifying.",
  );
  process.exit(1);
}

const anon = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
});
const service = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
});

let failures = 0;

const pass = (label) => console.log(`  ✓ ${label}`);
const fail = (label, detail) => {
  failures += 1;
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
};

const expectAllowed = async (label, query) => {
  const { error } = await query;
  if (error) fail(label, error.message);
  else pass(label);
};

const expectDenied = async (label, query) => {
  const { error } = await query;
  if (error) pass(`${label} (blocked)`);
  else fail(label, "query unexpectedly succeeded");
};

const run = async () => {
  console.log("Checking public catalogue access with the anon key...");
  const { data: publicProperties, error: propertyError } = await anon
    .from("properties")
    .select("id")
    .limit(1);

  if (propertyError) fail("anon can read published properties", propertyError.message);
  else if (!publicProperties?.length) {
    fail("anon can read published properties", "no rows; run the seed script");
  } else pass("anon can read published properties");

  await expectAllowed(
    "anon can read amenities",
    anon.from("amenities").select("id").limit(1),
  );

  console.log("Checking sensitive tables are denied to the anon key...");
  await expectDenied("anon cannot read bookings", anon.from("bookings").select("id").limit(1));
  await expectDenied("anon cannot read profiles", anon.from("profiles").select("id").limit(1));
  await expectDenied("anon cannot read hosts", anon.from("hosts").select("id").limit(1));
  await expectDenied("anon cannot read payouts", anon.from("payouts").select("id").limit(1));

  console.log("Checking the anon key cannot write to the catalogue...");
  await expectDenied(
    "anon cannot update properties",
    anon.from("properties").update({ name: "tampered" }).eq("legacy_id", 1).select("id"),
  );
  await expectDenied(
    "anon cannot insert properties",
    anon.from("properties").insert({ slug: "tampered" }).select("id"),
  );

  console.log("Checking the service role can operate server-side...");
  await expectAllowed(
    "service role can read bookings",
    service.from("bookings").select("id").limit(1),
  );
  await expectAllowed(
    "service role can read profiles",
    service.from("profiles").select("id").limit(1),
  );

  if (failures) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }

  console.log("\nAll security checks passed.");
};

run().catch((error) => {
  console.error("[verify] Failed:", error.message);
  process.exit(1);
});
