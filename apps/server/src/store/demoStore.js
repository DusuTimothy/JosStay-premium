import { SEED_BOOKINGS } from "@josstay/shared";

/* ------------------------------------------------------------------ */
/* In-memory demo store. Replace with Sequelize + PostgreSQL/Supabase. */
/* ------------------------------------------------------------------ */
export const bookings = SEED_BOOKINGS.map((b) => ({
  ...b,
  guest: {
    firstName: "Demo",
    lastName: "Guest",
    email: "demo@josstay.app",
    phone: "+2348000000000",
  },
  paymentMethod: "card",
}));

export const users = [];

export const createReference = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `JS-${out}`;
};
