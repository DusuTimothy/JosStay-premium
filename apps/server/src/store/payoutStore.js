import { HttpError } from "../lib/http.js";
import { isDatabaseEnabled, query } from "../lib/postgres.js";
import { findHostByUserId } from "./hostStore.js";
import { mapPayoutRow } from "./mappers.js";

const DEMO_PAYOUTS = [
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

const totalsFor = (payouts) => ({
  gross: payouts.reduce((sum, payout) => sum + payout.gross, 0),
  net: payouts.reduce((sum, payout) => sum + payout.net, 0),
  currency: "NGN",
});

export const getPayoutRecords = async (auth) => {
  if (!isDatabaseEnabled) {
    return {
      data: DEMO_PAYOUTS,
      totals: totalsFor(DEMO_PAYOUTS),
      sampleData: true,
    };
  }

  try {
    let sql = `
      select reference, gross, commission, net, status, scheduled_for, created_at
      from public.payouts
    `;
    const params = [];
    const where = [];

    if (auth.role !== "admin") {
      const host = await findHostByUserId(auth.userId);
      if (!host) {
        return {
          data: [],
          totals: { gross: 0, net: 0, currency: "NGN" },
          sampleData: false,
        };
      }
      params.push(host.id);
      where.push(`host_id = $${params.length}::uuid`);
    }

    if (where.length) sql += ` where ${where.join(" and ")}`;
    sql += " order by created_at desc limit 100";

    const { rows } = await query(sql, params);
    const payouts = rows.map(mapPayoutRow);
    return {
      data: payouts,
      totals: totalsFor(payouts),
      sampleData: false,
    };
  } catch {
    throw new HttpError(503, "Payout service is temporarily unavailable");
  }
};