/**
 * Paystack processing-fee pass-through.
 *
 * The guest bears the provider processing fee. Paystack deducts its fee from the
 * settlement, so we gross the charge up so the platform still nets the stay
 * amount. The fee is pass-through only: it is not host gross, not commissionable,
 * and not platform revenue.
 *
 * Defaults approximate Paystack Nigeria's published local-transaction schedule
 * (1.5% + ₦100, capped at ₦2,000). Confirm against the live Paystack dashboard
 * and override per channel with environment variables:
 *
 *   PAYMENT_FEE_<CHANNEL>_RATE    e.g. 0.015
 *   PAYMENT_FEE_<CHANNEL>_FIXED   e.g. 100 (naira)
 *   PAYMENT_FEE_<CHANNEL>_CAP     e.g. 2000 (naira)
 *
 * where <CHANNEL> is CARD, BANK_TRANSFER, or USSD.
 */

const DEFAULT_SCHEDULES = {
  card: { rate: 0.015, fixed: 100, cap: 2000 },
  bank_transfer: { rate: 0.015, fixed: 100, cap: 2000 },
  ussd: { rate: 0.015, fixed: 100, cap: 2000 },
};

const CHANNEL_ENV_KEYS = {
  card: "CARD",
  bank_transfer: "BANK_TRANSFER",
  ussd: "USSD",
};

const readNumber = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const readRate = (name, fallback) => {
  const value = readNumber(name, fallback);
  return value > 0 && value < 1 ? value : fallback;
};

const readInteger = (name, fallback) => Math.round(readNumber(name, fallback));

export const resolveFeeChannel = (value) => {
  const key = String(value || "").trim().toLowerCase();
  if (key === "bank" || key === "bank_transfer" || key === "transfer") return "bank_transfer";
  if (key === "ussd") return "ussd";
  return "card";
};

export const getFeeSchedule = (channelOrMethod = "card") => {
  const channel = resolveFeeChannel(channelOrMethod);
  const envKey = CHANNEL_ENV_KEYS[channel];
  const defaults = DEFAULT_SCHEDULES[channel];
  return {
    channel,
    rate: readRate(`PAYMENT_FEE_${envKey}_RATE`, defaults.rate),
    fixed: readInteger(`PAYMENT_FEE_${envKey}_FIXED`, defaults.fixed),
    cap: readInteger(`PAYMENT_FEE_${envKey}_CAP`, defaults.cap),
  };
};

/**
 * Gross up a stay amount so the platform nets `stayAmount` after Paystack's fee.
 * Returns whole naira.
 */
export const calculateCharge = (amount, channelOrMethod = "card") => {
  const stayAmount = Math.max(0, Math.round(Number(amount) || 0));
  if (stayAmount === 0) {
    return { stayAmount: 0, paymentFee: 0, chargeAmount: 0, channel: resolveFeeChannel(channelOrMethod) };
  }

  const schedule = getFeeSchedule(channelOrMethod);
  const grossed = Math.ceil((stayAmount + schedule.fixed) / (1 - schedule.rate));
  const chargeAmount = Math.max(stayAmount, Math.min(grossed, stayAmount + schedule.cap));

  return {
    stayAmount,
    paymentFee: chargeAmount - stayAmount,
    chargeAmount,
    channel: schedule.channel,
  };
};

export const calculatePaymentFee = (amount, channelOrMethod = "card") =>
  calculateCharge(amount, channelOrMethod).paymentFee;
