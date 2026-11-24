import { asyncHandler, HttpError } from "../lib/http.js";
import {
  beginIdempotency,
  completeIdempotency,
  failIdempotency,
  getIdempotencyKey,
  hashIdempotencyPayload,
} from "../lib/idempotency.js";
import { sendHostListingSubmittedEmail, sendHostWelcomeEmail } from "../lib/notifications.js";
import { isDatabaseEnabled } from "../lib/postgres.js";
import { createUser, findUserByEmail, findUserById, publicUser, touchLastLogin } from "../store/userStore.js";
import {
  createHostListing,
  createHostListingBlock,
  deleteHostListingBlock,
  ensureHostProfile,
  getHostDashboard,
  listHostBookings,
  listHostListingBlocks,
  listHostListings,
  submitHostListingForReview,
  updateHostListing,
  updateHostListingPricing,
} from "../store/hostStore.js";
import {
  cancelHostPayoutRequest,
  createHostPayoutMethod,
  createHostPayoutRequest,
  disableHostPayoutMethod,
  getHostPayoutMethods,
  getHostPayoutSummary,
  getPayoutRecords,
  listHostEarnings,
  listHostPayoutRequests,
  listPayoutBanks,
} from "../store/payoutStore.js";
import {
  HostListingBlockSchema,
  HostListingCreateSchema,
  HostListingPricingSchema,
  HostListingSubmitSchema,
  HostListingUpdateSchema,
  HostOnboardSchema,
  HostRegisterSchema,
} from "../validators/hostSchemas.js";
import {
  PayoutMethodCreateSchema,
  PayoutRequestCreateSchema,
} from "../validators/payoutSchemas.js";
import { createRefreshSession, setRefreshCookie } from "../lib/authSession.js";
import { signAccessToken } from "../lib/tokens.js";

const issueAuth = async ({ req, res, user, status = 200, message }) => {
  const session = await createRefreshSession({ userId: user.id, req });
  setRefreshCookie(res, session.token, session.expiresAt);
  const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role || "host" });
  const payload = {
    data: {
      token: accessToken,
      accessToken,
      user: publicUser(user),
    },
  };
  if (message) payload.message = message;
  return res.status(status).json(payload);
};

export const getPayouts = asyncHandler(async (req, res) => {
  const result = await getPayoutRecords(req.auth);
  res.json(result);
});

export const getPayoutSummary = asyncHandler(async (req, res) => {
  const result = await getHostPayoutSummary(req.auth);
  res.json(result);
});

export const getPayoutEarnings = asyncHandler(async (req, res) => {
  const result = await listHostEarnings(req.auth, {
    status: req.query.status ? String(req.query.status) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
  });
  res.json(result);
});

export const getPayoutRequests = asyncHandler(async (req, res) => {
  const result = await listHostPayoutRequests(req.auth, {
    status: req.query.status ? String(req.query.status) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json(result);
});

export const createPayoutRequest = asyncHandler(async (req, res) => {
  const payload = PayoutRequestCreateSchema.parse(req.body || {});
  const idempotencyKey = getIdempotencyKey(req);
  const scope = `user:${req.auth.userId}:host:payout-request`;
  const requestHash = hashIdempotencyPayload(payload);

  let idem = { type: "skipped" };
  if (isDatabaseEnabled) {
    if (!idempotencyKey) {
      throw new HttpError(400, "Idempotency-Key header is required for payout requests");
    }
    idem = await beginIdempotency({
      scope,
      key: idempotencyKey,
      operation: "host.payout.request",
      requestHash,
    });
    if (idem.type === "replay") {
      return res.status(idem.status || 200).json(idem.body);
    }
  }

  try {
    const result = await createHostPayoutRequest({
      auth: req.auth,
      amount: payload.amount,
      note: payload.note,
    });
    const body = { data: result.data, sampleData: result.sampleData };
    if (idem.type === "claimed") {
      await completeIdempotency({ scope, key: idempotencyKey, status: 201, body });
    }
    return res.status(201).json(body);
  } catch (error) {
    if (idem.type === "claimed") {
      const status = error instanceof HttpError ? error.status : 500;
      await failIdempotency({
        scope,
        key: idempotencyKey,
        status,
        body: { error: error.message || "Could not create payout request" },
      }).catch(() => {});
    }
    throw error;
  }
});

export const cancelPayoutRequest = asyncHandler(async (req, res) => {
  const result = await cancelHostPayoutRequest({
    auth: req.auth,
    requestId: req.params.id,
  });
  res.json({ data: result.data, sampleData: result.sampleData });
});

export const getPayoutMethods = asyncHandler(async (req, res) => {
  const result = await getHostPayoutMethods(req.auth);
  res.json(result);
});

export const getPayoutBanks = asyncHandler(async (_req, res) => {
  const result = await listPayoutBanks();
  res.json(result);
});

export const createPayoutMethod = asyncHandler(async (req, res) => {
  const payload = PayoutMethodCreateSchema.parse(req.body || {});
  const result = await createHostPayoutMethod({
    auth: req.auth,
    bankCode: payload.bankCode,
    bankName: payload.bankName,
    accountNumber: payload.accountNumber,
  });
  res.status(201).json({ data: result.data, sampleData: result.sampleData });
});

export const deletePayoutMethod = asyncHandler(async (req, res) => {
  const result = await disableHostPayoutMethod({
    auth: req.auth,
    methodId: req.params.id,
  });
  res.json({ data: result.data, sampleData: result.sampleData });
});

export const getHostMe = asyncHandler(async (req, res) => {
  const result = await getHostDashboard(req.auth);
  res.json(result);
});

export const getHostListings = asyncHandler(async (req, res) => {
  const result = await listHostListings(req.auth);
  res.json(result);
});

export const getHostBookings = asyncHandler(async (req, res) => {
  const result = await listHostBookings(req.auth);
  res.json(result);
});

export const onboardHost = asyncHandler(async (req, res) => {
  const payload = HostOnboardSchema.parse(req.body || {});
  const host = await ensureHostProfile({ userId: req.auth.userId, name: payload.name || req.auth.email?.split("@")[0] || "Host" });
  const dashboard = await getHostDashboard(req.auth);
  try {
    const user = await findUserById(req.auth.userId);
    if (user?.email) await sendHostWelcomeEmail({ to: user.email, name: host?.name || user.name });
  } catch {}
  res.status(201).json({
    data: {
      host: {
        id: host.id,
        name: host.name,
        joinedYear: host.joined_year,
        superhost: Boolean(host.superhost),
      },
      dashboard: dashboard.data,
    },
    sampleData: dashboard.sampleData,
    message: "Host profile ready",
  });
});

export const registerHost = asyncHandler(async (req, res) => {
  const payload = HostRegisterSchema.parse(req.body);

  const existing = await findUserByEmail(payload.email);
  if (existing) {
    throw new HttpError(409, "Email already registered");
  }

  const user = await createUser({
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: "host",
  });

  await ensureHostProfile({ userId: user.id, name: payload.name });
  await touchLastLogin(user.id).catch(() => {});
  try {
    await sendHostWelcomeEmail({ to: user.email, name: payload.name });
  } catch {}

  return issueAuth({ req, res, user: { ...user, role: "host" }, status: 201, message: "Host account created" });
});


export const createListing = asyncHandler(async (req, res) => {
  const payload = HostListingCreateSchema.parse(req.body);
  const result = await createHostListing(req.auth, payload);
  try {
    const user = await findUserById(req.auth.userId);
    if (user?.email) {
      await sendHostListingSubmittedEmail({
        to: user.email,
        name: user.name || "Host",
        listingName: result?.data?.name || payload.name,
      });
    }
  } catch {}
  res.status(201).json(result);
});

export const updateListing = asyncHandler(async (req, res) => {
  const payload = HostListingUpdateSchema.parse(req.body || {});
  const result = await updateHostListing(req.auth, req.params.id, payload);
  res.json(result);
});

export const submitListingForReview = asyncHandler(async (req, res) => {
  HostListingSubmitSchema.parse(req.body || {});
  const result = await submitHostListingForReview(req.auth, req.params.id);
  try {
    const user = await findUserById(req.auth.userId);
    if (user?.email) {
      await sendHostListingSubmittedEmail({
        to: user.email,
        name: user.name || "Host",
        listingName: result?.data?.name || "Your listing",
      });
    }
  } catch {}
  res.json(result);
});

export const updateListingPricing = asyncHandler(async (req, res) => {
  const payload = HostListingPricingSchema.parse(req.body);
  const result = await updateHostListingPricing(req.auth, req.params.id, payload);
  res.json(result);
});

export const getListingBlocks = asyncHandler(async (req, res) => {
  const result = await listHostListingBlocks(req.auth, req.params.id);
  res.json(result);
});

export const createListingBlock = asyncHandler(async (req, res) => {
  const payload = HostListingBlockSchema.parse(req.body);
  const result = await createHostListingBlock(req.auth, req.params.id, payload);
  res.status(201).json(result);
});

export const deleteListingBlock = asyncHandler(async (req, res) => {
  await deleteHostListingBlock(req.auth, req.params.id, req.params.blockId);
  res.status(204).send();
});
