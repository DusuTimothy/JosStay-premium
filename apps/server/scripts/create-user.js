import "dotenv/config";
import bcrypt from "bcryptjs";
import { checkDatabaseConnection, closeDatabase, query } from "../src/lib/postgres.js";
import { USES_DATABASE } from "../src/config/env.js";

if (!USES_DATABASE) {
  console.error("DATA_BACKEND must be 'postgres' to create a database user.");
  process.exit(1);
}

const email = process.env.USER_EMAIL?.trim().toLowerCase();
const password = process.env.USER_PASSWORD || "";
const name = process.env.USER_NAME?.trim() || email?.split("@")[0];
const role = process.env.USER_ROLE?.trim() || "guest";

if (!email || !name) {
  console.error("Set USER_EMAIL and USER_NAME.");
  process.exit(1);
}
if (password.length < 8 || password.length > 72) {
  console.error("USER_PASSWORD must be 8–72 characters.");
  process.exit(1);
}
if (!["guest", "host", "admin"].includes(role)) {
  console.error("USER_ROLE must be guest, host or admin.");
  process.exit(1);
}

const run = async () => {
  const check = await checkDatabaseConnection();
  if (!check.ok) {
    throw new Error(`Database connection failed: ${check.reason}`);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await query(
    "select id, email from public.profiles where lower(email) = lower($1) limit 1",
    [email],
  );

  let profile;
  if (existing.rows[0]) {
    const updated = await query(
      `update public.profiles
       set password_hash = $1, full_name = $2, role = $3::public.user_role
       where id = $4::uuid
       returning id, email, full_name, role`,
      [passwordHash, name, role, existing.rows[0].id],
    );
    profile = updated.rows[0];
    console.log(`Updated ${profile.email} (${profile.role}).`);
  } else {
    const created = await query(
      `insert into public.profiles (email, password_hash, full_name, role)
       values ($1, $2, $3, $4::public.user_role)
       returning id, email, full_name, role`,
      [email, passwordHash, name, role],
    );
    profile = created.rows[0];
    console.log(`Created ${profile.email} (${profile.role}).`);
  }

  if (role === "host" || role === "admin") {
    const host = await query(
      "select id from public.hosts where user_id = $1::uuid limit 1",
      [profile.id],
    );

    if (!host.rows[0]) {
      await query(
        `insert into public.hosts (user_id, seed_key, name, joined_year, superhost)
         values ($1::uuid, $2, $3, $4, false)`,
        [profile.id, `user-${profile.id}`, name, new Date().getFullYear()],
      );
      console.log("Linked a new host profile.");
    }
  }

  console.log("Done. The password was written as a bcrypt hash and is not printed.");
};

run()
  .catch((error) => {
    console.error("[create-user] Failed:", error.message);
    process.exit(1);
  })
  .finally(async () => {
    await closeDatabase();
  });