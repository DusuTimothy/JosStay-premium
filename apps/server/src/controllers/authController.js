import bcrypt from "bcryptjs";
import { HttpError, asyncHandler } from "../lib/http.js";
import { signAccessToken } from "../lib/tokens.js";
import {
  clearRefreshCookie,
  createRefreshSession,
  getRefreshTokenFromRequest,
  revokeRefreshSession,
  rotateRefreshSession,
  setRefreshCookie,
} from "../lib/authSession.js";
import { verifyGoogleIdToken } from "../lib/googleAuth.js";
import {
  DUMMY_PASSWORD_HASH,
  createOrLinkGoogleUser,
  createUser,
  findUserByEmail,
  findUserById,
  publicUser,
  touchLastLogin,
} from "../store/userStore.js";
import { GoogleAuthSchema, LoginSchema, RegisterSchema } from "../validators/authSchemas.js";

const issueAuthResponse = async ({ req, res, user, status = 200, message }) => {
  const session = await createRefreshSession({ userId: user.id, req });
  setRefreshCookie(res, session.token, session.expiresAt);

  const accessToken = signAccessToken(user);
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

export const register = asyncHandler(async (req, res) => {
  const payload = RegisterSchema.parse(req.body);

  const user = await createUser({
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: "guest",
  });

  return issueAuthResponse({
    req,
    res,
    user,
    status: 201,
    message: "Account created",
  });
});

export const login = asyncHandler(async (req, res) => {
  const payload = LoginSchema.parse(req.body);
  const user = await findUserByEmail(payload.email);

  // Always run a bcrypt comparison so a missing account and a wrong password
  // take a similar amount of time.
  const valid = await bcrypt.compare(
    payload.password,
    user?.passwordHash || DUMMY_PASSWORD_HASH,
  );

  if (!user || !valid) {
    throw new HttpError(401, "Invalid email or password");
  }

  await touchLastLogin(user.id);

  return issueAuthResponse({ req, res, user });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = getRefreshTokenFromRequest(req);
  if (!token) {
    throw new HttpError(401, "Authentication required");
  }

  const session = await rotateRefreshSession({ token, req });
  const user = await findUserById(session.userId);
  if (!user) {
    clearRefreshCookie(res);
    throw new HttpError(401, "Account no longer exists");
  }

  setRefreshCookie(res, session.token, session.expiresAt);
  const accessToken = signAccessToken(user);

  res.json({
    data: {
      token: accessToken,
      accessToken,
      user: publicUser(user),
    },
  });
});

export const googleAuth = asyncHandler(async (req, res) => {
  const payload = GoogleAuthSchema.parse(req.body);
  const profile = await verifyGoogleIdToken(payload.credential);
  const user = await createOrLinkGoogleUser({
    email: profile.email,
    name: profile.name,
    googleSub: profile.sub,
  });

  await touchLastLogin(user.id);

  return issueAuthResponse({
    req,
    res,
    user,
    message: "Signed in with Google",
  });
});

export const logout = asyncHandler(async (req, res) => {
  const token = getRefreshTokenFromRequest(req);
  await revokeRefreshSession(token);
  clearRefreshCookie(res);
  res.status(204).send();
});

export const me = asyncHandler(async (req, res) => {
  const user = await findUserById(req.auth.userId);
  if (!user) {
    throw new HttpError(401, "Account no longer exists");
  }
  res.json({ data: publicUser(user) });
});
