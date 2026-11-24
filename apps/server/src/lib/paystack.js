import crypto from "node:crypto";
import { PAYSTACK_SECRET_KEY } from "../config/env.js";
import { HttpError } from "./http.js";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

const getSecretKey = () => {
  if (!PAYSTACK_SECRET_KEY) {
    throw new HttpError(503, "Payment service is not configured");
  }
  return PAYSTACK_SECRET_KEY;
};

const paystackRequest = async (path, { method = "GET", body } = {}) => {
  const secretKey = getSecretKey();
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !data?.status) {
    const message =
      data?.message ||
      data?.error ||
      `Payment provider request failed (${response.status})`;
    throw new HttpError(response.status >= 400 && response.status < 500 ? response.status : 502, message);
  }

  return data.data;
};

export const initializePaystackTransaction = async ({
  email,
  amountKobo,
  reference,
  callbackUrl,
  metadata,
}) => {
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
    throw new HttpError(400, "Invalid payment amount");
  }
  return paystackRequest("/transaction/initialize", {
    method: "POST",
    body: {
      email,
      amount: amountKobo,
      reference,
      currency: "NGN",
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
      ...(metadata ? { metadata } : {}),
    },
  });
};

export const verifyPaystackTransaction = async (reference) => {
  if (!reference) throw new HttpError(400, "Payment reference is required");
  return paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
};

export const isPaystackConfigured = () => Boolean(PAYSTACK_SECRET_KEY);

export const listPaystackBanks = async () => {
  const banks = await paystackRequest("/bank?currency=NGN");
  return Array.isArray(banks) ? banks : [];
};

export const resolvePaystackAccount = async ({ accountNumber, bankCode }) => {
  if (!accountNumber || !bankCode) {
    throw new HttpError(400, "Account number and bank are required");
  }
  return paystackRequest(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
  );
};

export const verifyPaystackWebhookSignature = (req) => {
  const signature = req.header("x-paystack-signature");
  if (!signature) return false;
  const secretKey = getSecretKey();

  const raw = Buffer.isBuffer(req.rawBody)
    ? req.rawBody
    : Buffer.from(JSON.stringify(req.body ?? {}));

  const hash = crypto.createHmac("sha512", secretKey).update(raw).digest("hex");
  const a = Buffer.from(hash);
  const b = Buffer.from(String(signature));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

export const toKobo = (amountNaira) => Math.round(Number(amountNaira) * 100);
