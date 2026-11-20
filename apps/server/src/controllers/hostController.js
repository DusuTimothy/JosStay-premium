import { asyncHandler, HttpError } from "../lib/http.js";
import { createUser, findUserByEmail, publicUser, touchLastLogin } from "../store/userStore.js";
import {
  createHostListing,
  createHostListingBlock,
  deleteHostListingBlock,
  ensureHostProfile,
  getHostDashboard,
  listHostBookings,
  listHostListingBlocks,
  listHostListings,
  updateHostListingPricing,
} from "../store/hostStore.js";
import { getPayoutRecords } from "../store/payoutStore.js";
import {
  HostListingBlockSchema,
  HostListingCreateSchema,
  HostListingPricingSchema,
  HostOnboardSchema,
  HostRegisterSchema,
} from "../validators/hostSchemas.js";
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

  return issueAuth({ req, res, user: { ...user, role: "host" }, status: 201, message: "Host account created" });
});


export const createListing = asyncHandler(async (req, res) => {
  const payload = HostListingCreateSchema.parse(req.body);
  const result = await createHostListing(req.auth, payload);
  res.status(201).json(result);
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
