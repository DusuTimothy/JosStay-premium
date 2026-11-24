import crypto from "node:crypto";
import { IS_PRODUCTION } from "../config/env.js";
import { HttpError } from "../lib/http.js";
import {
  isPaystackConfigured,
  listPaystackBanks,
  resolvePaystackAccount,
} from "../lib/paystack.js";
import { getClient, isDatabaseEnabled, query } from "../lib/postgres.js";
import { findHostByUserId } from "./hostStore.js";
import {
  mapBankAccountRow,
  mapHostEarningRow,
  mapPayoutRequestRow,
  mapPayoutRow,
} from "./mappers.js";

const clampNumber = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

const COMMISSION_RATE = clampNumber(process.env.PLATFORM_COMMISSION_RATE, 0, 0.5, 0.1);
const HOLD_HOURS = Math.round(
  clampNumber(process.env.PAYOUT_HOLD_HOURS, 0, 720, 24),
);
const MIN_PAYOUT = Math.round(
  clampNumber(process.env.PAYOUT_MIN_AMOUNT, 1000, 10000000, 10000),
);

const OPEN_REQUEST_STATUSES = ["pending_review", "approved", "processing"];
const REQUEST_STATUSES = [
  "pending_review",
  "approved",
  "processing",
  "paid",
  "rejected",
  "cancelled",
  "failed",
];
const EARNING_STATUSES = ["pending", "available", "reserved", "paid", "reversed"];

const FALLBACK_BANKS = [
  { name: "Access Bank", code: "044" },
  { name: "Citibank Nigeria", code: "023" },
  { name: "Ecobank Nigeria", code: "050" },
  { name: "Fidelity Bank", code: "070" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "First City Monument Bank", code: "214" },
  { name: "Guaranty Trust Bank", code: "058" },
  { name: "Keystone Bank", code: "082" },
  { name: "Kuda Bank", code: "50211" },
  { name: "Moniepoint", code: "50515" },
  { name: "OPay", code: "999992" },
  { name: "PalmPay", code: "999991" },
  { name: "Polaris Bank", code: "076" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Standard Chartered Bank", code: "068" },
  { name: "Sterling Bank", code: "232" },
  { name: "Union Bank of Nigeria", code: "032" },
  { name: "United Bank for Africa", code: "033" },
  { name: "Unity Bank", code: "215" },
  { name: "Wema Bank", code: "035" },
  { name: "Zenith Bank", code: "057" },
];

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

const DEMO_DAY = 86400000;
const demoIso = (offsetDays) => new Date(Date.now() + offsetDays * DEMO_DAY).toISOString();

const demoEarnings = [
  {
    id: "demo-earning-1",
    bookingId: "demo-booking-1",
    bookingReference: "JS-DEMO01",
    gross: 120000,
    commission: 12000,
    net: 108000,
    currency: "NGN",
    status: "available",
    availableAt: demoIso(-20),
    reservedAmount: 0,
    paidAmount: 0,
    createdAt: demoIso(-25),
  },
  {
    id: "demo-earning-2",
    bookingId: "demo-booking-2",
    bookingReference: "JS-DEMO02",
    gross: 85000,
    commission: 8500,
    net: 76500,
    currency: "NGN",
    status: "available",
    availableAt: demoIso(-12),
    reservedAmount: 0,
    paidAmount: 0,
    createdAt: demoIso(-16),
  },
  {
    id: "demo-earning-3",
    bookingId: "demo-booking-3",
    bookingReference: "JS-DEMO03",
    gross: 60000,
    commission: 6000,
    net: 54000,
    currency: "NGN",
    status: "pending",
    availableAt: demoIso(3),
    reservedAmount: 0,
    paidAmount: 0,
    createdAt: demoIso(-4),
  },
  {
    id: "demo-earning-4",
    bookingId: "demo-booking-4",
    bookingReference: "JS-DEMO04",
    gross: 100000,
    commission: 10000,
    net: 90000,
    currency: "NGN",
    status: "paid",
    availableAt: demoIso(-40),
    reservedAmount: 0,
    paidAmount: 90000,
    createdAt: demoIso(-45),
  },
];

const demoMethods = [];
const demoRequests = [];

const totalsFor = (payouts) => ({
  gross: payouts.reduce((sum, payout) => sum + Number(payout.gross || 0), 0),
  net: payouts.reduce((sum, payout) => sum + Number(payout.net || 0), 0),
  currency: "NGN",
});

const referenceAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generatePayoutReference = () => {
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += referenceAlphabet[crypto.randomInt(referenceAlphabet.length)];
  }
  return `JS-PO-${suffix}`;
};

const maskAccountNumber = (accountNumber) => {
  const digits = String(accountNumber || "").replace(/\D/g, "");
  return `******${digits.slice(-4)}`;
};

const normalizeStatus = (status, allowed, fallback = null) => {
  const value = String(status || "").trim().toLowerCase();
  return allowed.includes(value) ? value : fallback;
};

const findHostOrThrow = async (auth) => {
  const host = await findHostByUserId(auth.userId);
  if (!host) {
    throw new HttpError(409, "Create a host profile before using payouts");
  }
  return host;
};

const demoAvailable = () =>
  demoEarnings
    .filter((earning) => ["available", "reserved"].includes(earning.status))
    .reduce(
      (sum, earning) =>
        sum + Math.max(0, earning.net - earning.reservedAmount - earning.paidAmount),
      0,
    );

const demoOpenRequest = () =>
  demoRequests.find((request) => OPEN_REQUEST_STATUSES.includes(request.status)) || null;

const demoActiveMethod = () => demoMethods.find((method) => method.status === "verified") || null;

const demoSummary = () => {
  const withdrawable = demoAvailable();
  const reserved = demoEarnings.reduce((sum, earning) => sum + earning.reservedAmount, 0);
  const paidTotal = demoEarnings.reduce((sum, earning) => sum + earning.paidAmount, 0);
  const pendingEarnings = demoEarnings
    .filter((earning) => earning.status === "pending")
    .reduce((sum, earning) => sum + earning.net, 0);
  const grossTotal = demoEarnings.reduce((sum, earning) => sum + earning.gross, 0);
  const commissionTotal = demoEarnings.reduce((sum, earning) => sum + earning.commission, 0);
  return {
    withdrawable,
    reserved,
    paidTotal,
    pendingEarnings,
    grossTotal,
    commissionTotal,
    minimum: MIN_PAYOUT,
    currency: "NGN",
    openRequest: demoOpenRequest(),
    bankAccount: demoActiveMethod(),
  };
};

// ---------------------------------------------------------------------------
// Ledger sync
// ---------------------------------------------------------------------------

const syncEarnings = async (hostId = null) => {
  if (!isDatabaseEnabled) return;

  await query(
    `insert into public.host_earnings (
      host_id, booking_id, booking_reference, gross, commission, net, currency,
      status, available_at
    )
    select
      p.host_id,
      b.id,
      b.reference,
      b.total,
      round(b.total * $2::numeric)::int,
      b.total - round(b.total * $2::numeric)::int,
      b.currency,
      'pending',
      (b.check_in::timestamptz + ($3::int * interval '1 hour'))
    from public.bookings b
    join public.properties p on p.id = b.property_id
    where ($1::uuid is null or p.host_id = $1::uuid)
      and b.payment_status = 'paid'
      and b.status not in ('cancelled', 'no_show')
    on conflict (booking_id) do nothing`,
    [hostId, COMMISSION_RATE, HOLD_HOURS],
  );

  await query(
    `update public.host_earnings
     set status = 'available'
     where ($1::uuid is null or host_id = $1::uuid)
       and status = 'pending'
       and available_at is not null
       and available_at <= now()
       and reserved_amount = 0
       and paid_amount = 0`,
    [hostId],
  );

  await query(
    `update public.host_earnings e
     set status = 'reversed', reversed_at = coalesce(e.reversed_at, now())
     from public.bookings b
     where e.booking_id = b.id
       and ($1::uuid is null or e.host_id = $1::uuid)
       and e.status in ('pending', 'available')
       and e.reserved_amount = 0
       and e.paid_amount = 0
       and (b.status in ('cancelled', 'no_show') or b.payment_status <> 'paid')`,
    [hostId],
  );

  await query(
    `update public.host_earnings e
     set status = case
           when e.available_at is not null and e.available_at <= now() then 'available'
           else 'pending'
         end,
         reversed_at = null
     from public.bookings b
     where e.booking_id = b.id
       and ($1::uuid is null or e.host_id = $1::uuid)
       and e.status = 'reversed'
       and e.reserved_amount = 0
       and e.paid_amount = 0
       and b.payment_status = 'paid'
       and b.status not in ('cancelled', 'no_show')`,
    [hostId],
  );
};

// ---------------------------------------------------------------------------
// Host reads
// ---------------------------------------------------------------------------

export const getHostPayoutSummary = async (auth) => {
  const host = await findHostOrThrow(auth);

  if (!isDatabaseEnabled) {
    return { data: demoSummary(), sampleData: true };
  }

  await syncEarnings(host.id);

  const { rows } = await query(
    `select
       coalesce(sum(net - reserved_amount - paid_amount) filter (
         where status in ('available', 'reserved')
           and (available_at is null or available_at <= now())
       ), 0)::int as withdrawable,
       coalesce(sum(reserved_amount) filter (where status in ('available', 'reserved')), 0)::int as reserved,
       coalesce(sum(paid_amount), 0)::int as paid_total,
       coalesce(sum(net - reserved_amount - paid_amount) filter (where status = 'pending'), 0)::int as pending_earnings,
       coalesce(sum(gross), 0)::int as gross_total,
       coalesce(sum(commission), 0)::int as commission_total
     from public.host_earnings
     where host_id = $1::uuid`,
    [host.id],
  );

  const open = await query(
    `select id, reference, amount, status, created_at
     from public.payout_requests
     where host_id = $1::uuid and status = any($2::text[])
     order by created_at desc
     limit 1`,
    [host.id, OPEN_REQUEST_STATUSES],
  );

  const bank = await query(
    `select id, bank_code, bank_name, account_number_masked, account_name, provider, status, verified_at, created_at
     from public.host_bank_accounts
     where host_id = $1::uuid and status = 'verified'
     order by created_at desc
     limit 1`,
    [host.id],
  );

  const totals = rows[0] || {};
  return {
    data: {
      withdrawable: Number(totals.withdrawable || 0),
      reserved: Number(totals.reserved || 0),
      paidTotal: Number(totals.paid_total || 0),
      pendingEarnings: Number(totals.pending_earnings || 0),
      grossTotal: Number(totals.gross_total || 0),
      commissionTotal: Number(totals.commission_total || 0),
      minimum: MIN_PAYOUT,
      currency: "NGN",
      openRequest: open.rows[0]
        ? {
            id: open.rows[0].id,
            reference: open.rows[0].reference,
            amount: Number(open.rows[0].amount || 0),
            status: open.rows[0].status,
            createdAt: open.rows[0].created_at,
          }
        : null,
      bankAccount: bank.rows[0] ? mapBankAccountRow(bank.rows[0]) : null,
    },
    sampleData: false,
  };
};

export const listHostEarnings = async (auth, { status, limit = 50, offset = 0 } = {}) => {
  const host = await findHostOrThrow(auth);

  if (!isDatabaseEnabled) {
    const filter = normalizeStatus(status, EARNING_STATUSES);
    const data = demoEarnings
      .filter((earning) => !filter || earning.status === filter)
      .slice(offset, offset + limit);
    return { data, count: data.length, sampleData: true };
  }

  await syncEarnings(host.id);

  const params = [host.id];
  let where = "where host_id = $1::uuid";
  const filter = normalizeStatus(status, EARNING_STATUSES);
  if (filter) {
    params.push(filter);
    where += ` and status = $${params.length}`;
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  params.push(safeLimit, safeOffset);

  const { rows } = await query(
    `select id, booking_id, booking_reference, gross, commission, net, currency,
            status, available_at, reserved_amount, paid_amount, reversed_at, created_at
     from public.host_earnings
     ${where}
     order by created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
  );

  const data = rows.map(mapHostEarningRow);
  return { data, count: data.length, sampleData: false };
};

const payoutRequestSelect = `
  select
    pr.*,
    coalesce(
      json_agg(
        json_build_object(
          'bookingReference', e.booking_reference,
          'gross', e.gross,
          'commission', e.commission,
          'net', e.net,
          'amount', l.amount,
          'availableAt', e.available_at
        )
      ) filter (where e.id is not null),
      '[]'::json
    ) as earnings
  from public.payout_requests pr
  left join public.payout_request_earnings l on l.request_id = pr.id
  left join public.host_earnings e on e.id = l.earning_id
`;

export const listHostPayoutRequests = async (auth, { status, limit = 50 } = {}) => {
  const host = await findHostOrThrow(auth);

  if (!isDatabaseEnabled) {
    const filter = normalizeStatus(status, REQUEST_STATUSES);
    const data = demoRequests
      .filter((request) => !filter || request.status === filter)
      .slice(0, limit);
    return { data, count: data.length, sampleData: true };
  }

  await syncEarnings(host.id);

  const params = [host.id];
  let where = "where pr.host_id = $1::uuid";
  const filter = normalizeStatus(status, REQUEST_STATUSES);
  if (filter) {
    params.push(filter);
    where += ` and pr.status = $${params.length}`;
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  params.push(safeLimit);

  const { rows } = await query(
    `${payoutRequestSelect}
     ${where}
     group by pr.id
     order by pr.created_at desc
     limit $${params.length}`,
    params,
  );

  const data = rows.map(mapPayoutRequestRow);
  return { data, count: data.length, sampleData: false };
};

export const getHostPayoutMethods = async (auth) => {
  const host = await findHostOrThrow(auth);

  if (!isDatabaseEnabled) {
    return { data: demoMethods, sampleData: true };
  }

  const { rows } = await query(
    `select id, bank_code, bank_name, account_number_masked, account_name,
            provider, status, verified_at, created_at
     from public.host_bank_accounts
     where host_id = $1::uuid and status <> 'disabled'
     order by created_at desc`,
    [host.id],
  );

  return { data: rows.map(mapBankAccountRow), sampleData: false };
};

let bankCache = { at: 0, data: null };

export const listPayoutBanks = async () => {
  if (!isPaystackConfigured()) {
    return { data: FALLBACK_BANKS, sampleData: true };
  }

  if (bankCache.data && Date.now() - bankCache.at < 60 * 60 * 1000) {
    return { data: bankCache.data, sampleData: false };
  }

  try {
    const banks = await listPaystackBanks();
    const seen = new Set();
    const data = banks
      .filter((bank) => bank?.code && bank?.name)
      .filter((bank) => {
        if (seen.has(bank.code)) return false;
        seen.add(bank.code);
        return true;
      })
      .map((bank) => ({ name: bank.name, code: bank.code }))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!data.length) return { data: FALLBACK_BANKS, sampleData: true };
    bankCache = { at: Date.now(), data };
    return { data, sampleData: false };
  } catch {
    return { data: FALLBACK_BANKS, sampleData: true };
  }
};

export const createHostPayoutMethod = async ({ auth, bankCode, bankName, accountNumber }) => {
  const host = await findHostOrThrow(auth);
  const digits = String(accountNumber || "").replace(/\D/g, "");
  if (digits.length !== 10) {
    throw new HttpError(400, "Enter a 10-digit account number");
  }

  const open = await (isDatabaseEnabled
    ? query(
        `select 1 from public.payout_requests
         where host_id = $1::uuid and status = any($2::text[])
         limit 1`,
        [host.id, OPEN_REQUEST_STATUSES],
      )
    : Promise.resolve({ rowCount: demoOpenRequest() ? 1 : 0 }));

  if (open.rowCount) {
    throw new HttpError(409, "You cannot change bank details while a payout request is open");
  }

  let resolvedName = null;
  if (isPaystackConfigured()) {
    const resolved = await resolvePaystackAccount({ accountNumber: digits, bankCode });
    resolvedName = resolved?.account_name || null;
    if (!resolvedName) {
      throw new HttpError(400, "Could not verify this account. Check the bank and account number.");
    }
  } else if (!IS_PRODUCTION) {
    resolvedName = `${host.name || "Demo Host"} (demo account)`;
  } else {
    throw new HttpError(503, "Bank verification is unavailable until Paystack is configured");
  }

  let resolvedBankName = String(bankName || "").trim();
  if (!resolvedBankName) {
    const banks = await listPayoutBanks();
    resolvedBankName = banks.data.find((bank) => bank.code === bankCode)?.name || `Bank ${bankCode}`;
  }

  const masked = maskAccountNumber(digits);
  const method = {
    bankCode,
    bankName: resolvedBankName,
    accountNumberMasked: masked,
    accountName: resolvedName,
    provider: "paystack",
    status: "verified",
    verifiedAt: new Date().toISOString(),
  };

  if (!isDatabaseEnabled) {
    const existingIndex = demoMethods.findIndex((item) => item.status === "verified");
    if (existingIndex >= 0) demoMethods[existingIndex] = { ...demoMethods[existingIndex], status: "disabled" };
    const created = { id: crypto.randomUUID(), ...method, createdAt: new Date().toISOString() };
    demoMethods.unshift(created);
    return { data: created, sampleData: true };
  }

  const client = await getClient();
  try {
    await client.query("begin");
    await client.query(
      `update public.host_bank_accounts
       set status = 'disabled'
       where host_id = $1::uuid and status <> 'disabled'`,
      [host.id],
    );
    const inserted = await client.query(
      `insert into public.host_bank_accounts (
        host_id, bank_code, bank_name, account_number_masked, account_name,
        provider, status, verified_at
      ) values ($1::uuid, $2, $3, $4, $5, 'paystack', 'verified', now())
      returning id, bank_code, bank_name, account_number_masked, account_name,
                provider, status, verified_at, created_at`,
      [host.id, bankCode, resolvedBankName, masked, resolvedName],
    );
    await client.query("commit");
    return { data: mapBankAccountRow(inserted.rows[0]), sampleData: false };
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {}
    throw error;
  } finally {
    client.release();
  }
};

export const disableHostPayoutMethod = async ({ auth, methodId }) => {
  const host = await findHostOrThrow(auth);

  if (!isDatabaseEnabled) {
    if (demoOpenRequest()) {
      throw new HttpError(409, "You cannot change bank details while a payout request is open");
    }
    const index = demoMethods.findIndex((item) => item.id === methodId);
    if (index < 0) throw new HttpError(404, "Bank account not found");
    demoMethods[index] = { ...demoMethods[index], status: "disabled" };
    return { data: { id: methodId, status: "disabled" }, sampleData: true };
  }

  const open = await query(
    `select 1 from public.payout_requests
     where host_id = $1::uuid and status = any($2::text[])
     limit 1`,
    [host.id, OPEN_REQUEST_STATUSES],
  );
  if (open.rowCount) {
    throw new HttpError(409, "You cannot change bank details while a payout request is open");
  }

  const result = await query(
    `update public.host_bank_accounts
     set status = 'disabled'
     where id = $1::uuid and host_id = $2::uuid and status <> 'disabled'`,
    [methodId, host.id],
  );
  if (!result.rowCount) throw new HttpError(404, "Bank account not found");

  return { data: { id: methodId, status: "disabled" }, sampleData: false };
};

// ---------------------------------------------------------------------------
// Host payout requests
// ---------------------------------------------------------------------------

export const createHostPayoutRequest = async ({ auth, amount, note }) => {
  const host = await findHostOrThrow(auth);
  const requestedAmount = Math.round(Number(amount) || 0);

  if (requestedAmount < MIN_PAYOUT) {
    throw new HttpError(400, `The minimum payout request is ₦${MIN_PAYOUT.toLocaleString("en-NG")}`);
  }

  if (!isDatabaseEnabled) {
    if (demoOpenRequest()) {
      throw new HttpError(409, "You already have an open payout request");
    }
    const method = demoActiveMethod();
    if (!method) {
      throw new HttpError(409, "Add a verified bank account before requesting a payout");
    }
    const available = demoAvailable();
    if (requestedAmount > available) {
      throw new HttpError(400, "Requested amount exceeds your available balance");
    }

    const reference = generatePayoutReference();
    const links = [];
    let remaining = requestedAmount;
    for (const earning of demoEarnings) {
      if (remaining <= 0) break;
      if (!["available", "reserved"].includes(earning.status)) continue;
      const free = earning.net - earning.reservedAmount - earning.paidAmount;
      if (free <= 0) continue;
      const take = Math.min(free, remaining);
      earning.reservedAmount += take;
      if (earning.reservedAmount >= earning.net) earning.status = "reserved";
      links.push({
        bookingReference: earning.bookingReference,
        gross: earning.gross,
        commission: earning.commission,
        net: earning.net,
        amount: take,
        availableAt: earning.availableAt,
      });
      remaining -= take;
    }

    const request = {
      id: crypto.randomUUID(),
      reference,
      amount: requestedAmount,
      currency: "NGN",
      status: "pending_review",
      hostNote: note || null,
      reviewNote: null,
      settlementNote: null,
      bank: {
        bankCode: method.bankCode,
        bankName: method.bankName,
        accountNumberMasked: method.accountNumberMasked,
        accountName: method.accountName,
      },
      host: { id: host.id, name: host.name, email: auth.email || null },
      earnings: links,
      createdAt: new Date().toISOString(),
    };
    demoRequests.unshift(request);
    return { data: request, sampleData: true };
  }

  const client = await getClient();
  try {
    await client.query("begin");

    const open = await client.query(
      `select 1 from public.payout_requests
       where host_id = $1::uuid and status = any($2::text[])
       limit 1
       for update`,
      [host.id, OPEN_REQUEST_STATUSES],
    );
    if (open.rowCount) {
      throw new HttpError(409, "You already have an open payout request");
    }

    const bank = await client.query(
      `select id, bank_code, bank_name, account_number_masked, account_name
       from public.host_bank_accounts
       where host_id = $1::uuid and status = 'verified'
       order by created_at desc
       limit 1`,
      [host.id],
    );
    if (!bank.rows[0]) {
      throw new HttpError(409, "Add a verified bank account before requesting a payout");
    }

    const earnings = await client.query(
      `select id, net, reserved_amount, paid_amount
       from public.host_earnings
       where host_id = $1::uuid
         and status in ('available', 'reserved')
         and (available_at is null or available_at <= now())
         and (net - reserved_amount - paid_amount) > 0
       order by available_at asc nulls first, created_at asc
       for update`,
      [host.id],
    );

    const available = earnings.rows.reduce(
      (sum, earning) =>
        sum + Math.max(0, Number(earning.net) - Number(earning.reserved_amount) - Number(earning.paid_amount)),
      0,
    );
    if (requestedAmount > available) {
      throw new HttpError(400, "Requested amount exceeds your available balance");
    }

    const bankRow = bank.rows[0];
    const snapshot = {
      bankCode: bankRow.bank_code,
      bankName: bankRow.bank_name,
      accountNumberMasked: bankRow.account_number_masked,
      accountName: bankRow.account_name,
    };

    const inserted = await client.query(
      `insert into public.payout_requests (
        host_id, reference, amount, currency, bank_account_id, bank_snapshot,
        status, host_note
      ) values ($1::uuid, $2, $3, 'NGN', $4::uuid, $5::jsonb, 'pending_review', $6)
      returning id`,
      [host.id, generatePayoutReference(), requestedAmount, bankRow.id, JSON.stringify(snapshot), note || null],
    );
    const requestId = inserted.rows[0].id;

    let remaining = requestedAmount;
    for (const earning of earnings.rows) {
      if (remaining <= 0) break;
      const free = Math.max(
        0,
        Number(earning.net) - Number(earning.reserved_amount) - Number(earning.paid_amount),
      );
      if (free <= 0) continue;
      const take = Math.min(free, remaining);
      await client.query(
        `update public.host_earnings
         set reserved_amount = reserved_amount + $2,
             status = case when reserved_amount + $2 >= net then 'reserved' else status end
         where id = $1::uuid`,
        [earning.id, take],
      );
      await client.query(
        `insert into public.payout_request_earnings (request_id, earning_id, amount)
         values ($1::uuid, $2::uuid, $3)`,
        [requestId, earning.id, take],
      );
      remaining -= take;
    }

    if (remaining > 0) {
      throw new HttpError(409, "Could not reserve the full amount; try again");
    }

    await client.query("commit");
    const detail = await getPayoutRequestDetail(requestId);
    return { data: detail.data, sampleData: false };
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {}
    if (error?.code === "23505") {
      throw new HttpError(409, "You already have an open payout request");
    }
    throw error;
  } finally {
    client.release();
  }
};

const releaseRequestReservations = async (client, requestId) => {
  await client.query(
    `update public.host_earnings e
     set reserved_amount = e.reserved_amount - l.amount,
         status = case
           when e.status = 'reserved' and (e.reserved_amount - l.amount) < e.net then 'available'
           else e.status
         end
     from public.payout_request_earnings l
     where l.request_id = $1::uuid and l.earning_id = e.id`,
    [requestId],
  );
};

export const cancelHostPayoutRequest = async ({ auth, requestId }) => {
  const host = await findHostOrThrow(auth);

  if (!isDatabaseEnabled) {
    const request = demoRequests.find((item) => item.id === requestId);
    if (!request || request.host?.id !== host.id) {
      throw new HttpError(404, "Payout request not found");
    }
    if (request.status !== "pending_review") {
      throw new HttpError(409, "Only a pending request can be cancelled");
    }
    for (const link of request.earnings || []) {
      const earning = demoEarnings.find((item) => item.bookingReference === link.bookingReference);
      if (!earning) continue;
      earning.reservedAmount = Math.max(0, earning.reservedAmount - link.amount);
      if (earning.status === "reserved" && earning.reservedAmount < earning.net) {
        earning.status = "available";
      }
    }
    request.status = "cancelled";
    return { data: request, sampleData: true };
  }

  const client = await getClient();
  try {
    await client.query("begin");
    const existing = await client.query(
      `select id, status from public.payout_requests
       where id = $1::uuid and host_id = $2::uuid
       limit 1
       for update`,
      [requestId, host.id],
    );
    if (!existing.rows[0]) throw new HttpError(404, "Payout request not found");
    if (existing.rows[0].status !== "pending_review") {
      throw new HttpError(409, "Only a pending request can be cancelled");
    }

    await releaseRequestReservations(client, requestId);
    await client.query(
      `update public.payout_requests set status = 'cancelled' where id = $1::uuid`,
      [requestId],
    );
    await client.query("commit");
    const detail = await getPayoutRequestDetail(requestId);
    return { data: detail.data, sampleData: false };
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {}
    throw error;
  } finally {
    client.release();
  }
};

// ---------------------------------------------------------------------------
// Shared request detail
// ---------------------------------------------------------------------------

export const getPayoutRequestDetail = async (requestId, { hostId = null } = {}) => {
  if (!isDatabaseEnabled) {
    const request = demoRequests.find((item) => item.id === requestId);
    if (!request) throw new HttpError(404, "Payout request not found");
    if (hostId && request.host?.id !== hostId) throw new HttpError(404, "Payout request not found");
    return { data: request, sampleData: true };
  }

  const params = [requestId];
  let where = "where pr.id = $1::uuid";
  if (hostId) {
    params.push(hostId);
    where += ` and pr.host_id = $${params.length}::uuid`;
  }

  const { rows } = await query(
    `select
       pr.*,
       h.name as host_name,
       profile.email as host_email,
       coalesce(
         json_agg(
           json_build_object(
             'bookingReference', e.booking_reference,
             'gross', e.gross,
             'commission', e.commission,
             'net', e.net,
             'amount', l.amount,
             'availableAt', e.available_at
           )
         ) filter (where e.id is not null),
         '[]'::json
       ) as earnings
     from public.payout_requests pr
     join public.hosts h on h.id = pr.host_id
     left join public.profiles profile on profile.id = h.user_id
     left join public.payout_request_earnings l on l.request_id = pr.id
     left join public.host_earnings e on e.id = l.earning_id
     ${where}
     group by pr.id, h.name, profile.email
     limit 1`,
    params,
  );

  if (!rows[0]) throw new HttpError(404, "Payout request not found");
  return { data: mapPayoutRequestRow(rows[0]), sampleData: false };
};

// ---------------------------------------------------------------------------
// Admin review
// ---------------------------------------------------------------------------

export const listAdminPayoutRequests = async ({ status, limit = 50 } = {}) => {
  if (!isDatabaseEnabled) {
    const filter = normalizeStatus(status, REQUEST_STATUSES);
    const data = demoRequests.filter((request) => !filter || request.status === filter).slice(0, limit);
    return { data, count: data.length, sampleData: true };
  }

  await syncEarnings(null);

  const params = [];
  let where = "";
  const filter = normalizeStatus(status, REQUEST_STATUSES);
  if (filter) {
    params.push(filter);
    where = `where pr.status = $${params.length}`;
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  params.push(safeLimit);

  const { rows } = await query(
    `select
       pr.*,
       h.name as host_name,
       profile.email as host_email,
       coalesce(
         json_agg(
           json_build_object(
             'bookingReference', e.booking_reference,
             'gross', e.gross,
             'commission', e.commission,
             'net', e.net,
             'amount', l.amount,
             'availableAt', e.available_at
           )
         ) filter (where e.id is not null),
         '[]'::json
       ) as earnings
     from public.payout_requests pr
     join public.hosts h on h.id = pr.host_id
     left join public.profiles profile on profile.id = h.user_id
     left join public.payout_request_earnings l on l.request_id = pr.id
     left join public.host_earnings e on e.id = l.earning_id
     ${where}
     group by pr.id, h.name, profile.email
     order by pr.created_at desc
     limit $${params.length}`,
    params,
  );

  const data = rows.map(mapPayoutRequestRow);
  return { data, count: data.length, sampleData: false };
};

const findAdminRequest = async (requestId) => {
  const detail = await getPayoutRequestDetail(requestId);
  return detail.data;
};

export const approvePayoutRequest = async ({ requestId, reviewerUserId, note }) => {
  if (!isDatabaseEnabled) {
    const request = demoRequests.find((item) => item.id === requestId);
    if (!request) throw new HttpError(404, "Payout request not found");
    if (request.status !== "pending_review") {
      throw new HttpError(409, "Only a pending request can be approved");
    }
    request.status = "approved";
    request.reviewNote = note || null;
    request.reviewedBy = reviewerUserId || null;
    request.reviewedAt = new Date().toISOString();
    return { data: request, sampleData: true };
  }

  const client = await getClient();
  try {
    await client.query("begin");
    const existing = await client.query(
      `select id, status from public.payout_requests where id = $1::uuid limit 1 for update`,
      [requestId],
    );
    if (!existing.rows[0]) throw new HttpError(404, "Payout request not found");
    if (existing.rows[0].status !== "pending_review") {
      throw new HttpError(409, "Only a pending request can be approved");
    }
    await client.query(
      `update public.payout_requests
       set status = 'approved', reviewed_by = $2::uuid, reviewed_at = now(), review_note = $3
       where id = $1::uuid`,
      [requestId, reviewerUserId || null, note || null],
    );
    await client.query("commit");
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {}
    throw error;
  } finally {
    client.release();
  }

  return { data: await findAdminRequest(requestId), sampleData: false };
};

export const rejectPayoutRequest = async ({ requestId, reviewerUserId, note }) => {
  if (!note) throw new HttpError(400, "A rejection note is required");

  if (!isDatabaseEnabled) {
    const request = demoRequests.find((item) => item.id === requestId);
    if (!request) throw new HttpError(404, "Payout request not found");
    if (request.status !== "pending_review") {
      throw new HttpError(409, "Only a pending request can be rejected");
    }
    for (const link of request.earnings || []) {
      const earning = demoEarnings.find((item) => item.bookingReference === link.bookingReference);
      if (!earning) continue;
      earning.reservedAmount = Math.max(0, earning.reservedAmount - link.amount);
      if (earning.status === "reserved" && earning.reservedAmount < earning.net) {
        earning.status = "available";
      }
    }
    request.status = "rejected";
    request.reviewNote = note;
    request.reviewedBy = reviewerUserId || null;
    request.reviewedAt = new Date().toISOString();
    return { data: request, sampleData: true };
  }

  const client = await getClient();
  try {
    await client.query("begin");
    const existing = await client.query(
      `select id, status from public.payout_requests where id = $1::uuid limit 1 for update`,
      [requestId],
    );
    if (!existing.rows[0]) throw new HttpError(404, "Payout request not found");
    if (existing.rows[0].status !== "pending_review") {
      throw new HttpError(409, "Only a pending request can be rejected");
    }
    await releaseRequestReservations(client, requestId);
    await client.query(
      `update public.payout_requests
       set status = 'rejected', reviewed_by = $2::uuid, reviewed_at = now(), review_note = $3
       where id = $1::uuid`,
      [requestId, reviewerUserId || null, note],
    );
    await client.query("commit");
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {}
    throw error;
  } finally {
    client.release();
  }

  return { data: await findAdminRequest(requestId), sampleData: false };
};

export const markPayoutRequestPaid = async ({
  requestId,
  settledByUserId,
  providerReference,
  note,
}) => {
  if (!providerReference) throw new HttpError(400, "A transfer reference is required");

  if (!isDatabaseEnabled) {
    const request = demoRequests.find((item) => item.id === requestId);
    if (!request) throw new HttpError(404, "Payout request not found");
    if (!["approved", "processing"].includes(request.status)) {
      throw new HttpError(409, "Only an approved request can be marked paid");
    }
    let gross = 0;
    let net = 0;
    for (const link of request.earnings || []) {
      const earning = demoEarnings.find((item) => item.bookingReference === link.bookingReference);
      if (!earning) continue;
      earning.reservedAmount = Math.max(0, earning.reservedAmount - link.amount);
      earning.paidAmount += link.amount;
      if (earning.paidAmount >= earning.net) earning.status = "paid";
      gross += Math.round((earning.gross * link.amount) / Math.max(1, earning.net));
      net += link.amount;
    }
    const safeGross = Math.max(net, gross);
    request.status = "paid";
    request.provider = "paystack";
    request.providerReference = providerReference;
    request.settlementNote = note || null;
    request.settledBy = settledByUserId || null;
    request.settledAt = new Date().toISOString();
    DEMO_PAYOUTS.unshift({
      reference: request.reference,
      gross: safeGross,
      commission: Math.max(0, safeGross - net),
      net,
      status: "paid",
    });
    return { data: request, sampleData: true };
  }

  const client = await getClient();
  try {
    await client.query("begin");
    const existing = await client.query(
      `select id, host_id, reference, amount, status
       from public.payout_requests
       where id = $1::uuid
       limit 1
       for update`,
      [requestId],
    );
    const request = existing.rows[0];
    if (!request) throw new HttpError(404, "Payout request not found");
    if (!["approved", "processing"].includes(request.status)) {
      throw new HttpError(409, "Only an approved request can be marked paid");
    }

    await client.query(
      `update public.host_earnings e
       set reserved_amount = e.reserved_amount - l.amount,
           paid_amount = e.paid_amount + l.amount,
           status = case
             when e.paid_amount + l.amount >= e.net then 'paid'
             else 'available'
           end
       from public.payout_request_earnings l
       where l.request_id = $1::uuid and l.earning_id = e.id`,
      [requestId],
    );

    const totals = await client.query(
      `select
         coalesce(sum(round(e.gross::numeric * l.amount / nullif(e.net, 0))), 0)::int as gross,
         coalesce(sum(l.amount), 0)::int as net
       from public.payout_request_earnings l
       join public.host_earnings e on e.id = l.earning_id
       where l.request_id = $1::uuid`,
      [requestId],
    );
    const net = Number(totals.rows[0]?.net || request.amount);
    const gross = Math.max(net, Number(totals.rows[0]?.gross || 0));
    const commission = Math.max(0, gross - net);

    await client.query(
      `insert into public.payouts (
        host_id, reference, gross, commission, net, status, payout_request_id
      ) values ($1::uuid, $2, $3, $4, $5, 'paid', $6::uuid)
      on conflict (reference) do update set
        gross = excluded.gross,
        commission = excluded.commission,
        net = excluded.net,
        status = 'paid',
        payout_request_id = excluded.payout_request_id`,
      [request.host_id, request.reference, gross, commission, net, requestId],
    );

    await client.query(
      `update public.payout_requests
       set status = 'paid', provider = 'paystack', provider_reference = $2,
           settled_by = $3::uuid, settled_at = now(), settlement_note = $4
       where id = $1::uuid`,
      [requestId, providerReference, settledByUserId || null, note || null],
    );

    await client.query("commit");
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {}
    throw error;
  } finally {
    client.release();
  }

  return { data: await findAdminRequest(requestId), sampleData: false };
};

// ---------------------------------------------------------------------------
// Settlement history (existing endpoint)
// ---------------------------------------------------------------------------

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
