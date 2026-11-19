import "dotenv/config";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email = process.env.USER_EMAIL?.trim().toLowerCase();
const password = process.env.USER_PASSWORD || "";
const name = process.env.USER_NAME?.trim() || email?.split("@")[0];
const role = process.env.USER_ROLE?.trim() || "guest";

if (!url || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!email || !name) {
  console.error("Set USER_EMAIL and USER_NAME.");
  process.exit(1);
}
if (password.length < 12 || password.length > 72) {
  console.error("USER_PASSWORD must be 12–72 characters.");
  process.exit(1);
}
if (!["guest", "host", "admin"].includes(role)) {
  console.error("USER_ROLE must be guest, host or admin.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
});

const run = async () => {
  const passwordHash = await bcrypt.hash(password, 12);

  const { data: existing, error: lookupError } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  let profile;

  if (existing) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ password_hash: passwordHash, full_name: name, role })
      .eq("id", existing.id)
      .select("id, email, full_name, role")
      .single();
    if (error) throw new Error(error.message);
    profile = data;
    console.log(`Updated ${profile.email} (${profile.role}).`);
  } else {
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        email,
        password_hash: passwordHash,
        full_name: name,
        role,
      })
      .select("id, email, full_name, role")
      .single();
    if (error) throw new Error(error.message);
    profile = data;
    console.log(`Created ${profile.email} (${profile.role}).`);
  }

  if (role === "host") {
    const { data: host, error: hostError } = await supabase
      .from("hosts")
      .select("id")
      .eq("user_id", profile.id)
      .maybeSingle();
    if (hostError) throw new Error(hostError.message);

    if (!host) {
      const { error } = await supabase.from("hosts").insert({
        user_id: profile.id,
        seed_key: `user-${profile.id}`,
        name,
        joined_year: new Date().getFullYear(),
        superhost: false,
      });
      if (error) throw new Error(error.message);
      console.log("Linked a new host profile.");
    }
  }

  console.log("Done. The password was written as a bcrypt hash and is not printed.");
};

run().catch((error) => {
  console.error("[create-user] Failed:", error.message);
  process.exit(1);
});
