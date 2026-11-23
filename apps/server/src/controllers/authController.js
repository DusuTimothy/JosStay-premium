import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "../config/env.js";
import { HttpError, asyncHandler } from "../lib/http.js";
import { signAccessToken } from "../lib/tokens.js";
import {
  clearRefreshCookie,
  createRefreshSession,
  getRefreshTokenFromRequest,
  revokeAllRefreshSessionsForUser,
  revokeRefreshSession,
  rotateRefreshSession,
  setRefreshCookie,
} from "../lib/authSession.js";
import { buildClientTokenLink } from "../lib/authTokens.js";
import { verifyGoogleIdToken } from "../lib/googleAuth.js";
import {
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from "../lib/notifications.js";
import {
  AUTH_TOKEN_PURPOSES,
  consumeAuthToken,
  issueAuthToken,
  markEmailVerified,
  updateUserPassword,
} from "../store/authTokenStore.js";
import {
  DUMMY_PASSWORD_HASH,
  createOrLinkGoogleUser,
  createUser,
  findUserByEmail,
  findUserById,
  publicUser,
  touchLastLogin,
} from "../store/userStore.js";
import {
  EmailOnlySchema,
  GoogleAuthSchema,
  LoginSchema,
  RegisterSchema,
  ResetPasswordSchema,
  TokenSchema,
} from "../validators/authSchemas.js";

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

const isAlreadyVerifiedError = (error) =>
  error?.code === "42703" || /email_verified/i.test(error?.message || "");

// Use a stable, generic response for endpoints that would otherwise reveal
// whether an email address is registered.
const GENERIC_EMAIL_ACK = {
  message: "If an account matches that email, we sent a message with next steps.",
};

const sendVerificationForUser = async ({ user, req }) => {
  const issued = await issueAuthToken({
    userId: user.id,
    purpose: AUTH_TOKEN_PURPOSES.EMAIL_VERIFICATION,
    req,
  });
  if (!issued.token) return issued;

  const link = buildClientTokenLink("/verify-email", issued.token);
  const delivery = await sendEmailVerificationEmail({
    to: user.email,
    name: user.name || user.full_name,
    link,
    expiresInMinutes: issued.ttlMinutes,
  });
  if (delivery?.ok === false) {
    console.warn("[auth] verification email delivery failed", {
      userId: user.id,
      error: delivery.error,
    });
  }
  return issued;
};

export const register = asyncHandler(async (req, res) => {
  const payload = RegisterSchema.parse(req.body);

  const user = await createUser({
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: "guest",
  });

  // Best-effort: the account is created even if email delivery is unavailable.
  try {
    await sendVerificationForUser({ user, req });
  } catch (error) {
    console.warn("[auth] could not issue verification email on registration", {
      userId: user?.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return res.status(201).json({
    message: "Account created. Please verify your email address before signing in.",
    data: {
      user: publicUser(user),
      requiresEmailVerification: true,
    },
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

  if (!user.emailVerified) {
    throw new HttpError(403, "Please verify your email address before signing in.", {
      code: "EMAIL_NOT_VERIFIED",
      email: user.email,
    });
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

  if (!user.emailVerified) {
    await revokeRefreshSession(token);
    clearRefreshCookie(res);
    throw new HttpError(403, "Please verify your email address before signing in.", {
      code: "EMAIL_NOT_VERIFIED",
    });
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

export const requestEmailVerification = asyncHandler(async (req, res) => {
  const payload = EmailOnlySchema.parse(req.body);
  const user = await findUserByEmail(payload.email);

  // Generic response prevents account enumeration.
  if (!user || user.emailVerified) {
    return res.json(GENERIC_EMAIL_ACK);
  }

  try {
    await sendVerificationForUser({ user, req });
  } catch (error) {
    // Do not reveal whether sending failed because the account exists.
    console.warn("[auth] could not issue verification email", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return res.json(GENERIC_EMAIL_ACK);
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const payload = TokenSchema.parse(req.body);
  let userId;
  try {
    userId = await consumeAuthToken({
      token: payload.token,
      purpose: AUTH_TOKEN_PURPOSES.EMAIL_VERIFICATION,
    });
  } catch (error) {
    if (isAlreadyVerifiedError(error)) {
      return res.json({ message: "Email address verified" });
    }
    throw error;
  }

  if (!userId) {
    throw new HttpError(400, "This verification link is invalid or has expired");
  }

  try {
    await markEmailVerified(userId);
  } catch (error) {
    if (isAlreadyVerifiedError(error)) {
      return res.json({ message: "Email address verified" });
    }
    throw error;
  }

  const user = await findUserById(userId);
  return res.json({
    message: "Email address verified",
    ...(user ? { data: { user: publicUser(user) } } : {}),
  });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const payload = EmailOnlySchema.parse(req.body);
  const user = await findUserByEmail(payload.email);

  // Always return the same shape, even when the account does not exist or has
  // no password (Google-only). This avoids account enumeration.
  if (!user || !user.passwordHash) {
    return res.json(GENERIC_EMAIL_ACK);
  }

  try {
    const issued = await issueAuthToken({
      userId: user.id,
      purpose: AUTH_TOKEN_PURPOSES.PASSWORD_RESET,
      req,
    });
    if (issued.token) {
      const link = buildClientTokenLink("/reset-password", issued.token);
      const delivery = await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        link,
        expiresInMinutes: issued.ttlMinutes,
      });
      if (delivery?.ok === false) {
        console.warn("[auth] password reset email delivery failed", {
          userId: user.id,
          error: delivery.error,
        });
      }
    }
  } catch (error) {
    console.warn("[auth] could not issue password reset email", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return res.json(GENERIC_EMAIL_ACK);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const payload = ResetPasswordSchema.parse(req.body);

  const userId = await consumeAuthToken({
    token: payload.token,
    purpose: AUTH_TOKEN_PURPOSES.PASSWORD_RESET,
  });

  if (!userId) {
    throw new HttpError(400, "This reset link is invalid or has expired");
  }

  const passwordHash = await bcrypt.hash(payload.password, BCRYPT_ROUNDS);
  await updateUserPassword(userId, passwordHash);
  await revokeAllRefreshSessionsForUser(userId);

  clearRefreshCookie(res);
  return res.json({
    message: "Password updated. Please sign in with your new password.",
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
