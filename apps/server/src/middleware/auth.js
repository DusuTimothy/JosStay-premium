import { HttpError } from "../lib/http.js";
import { verifyAccessToken } from "../lib/tokens.js";

const ROLES = new Set(["guest", "host", "admin"]);

const readBearerToken = (req) => {
  const header = req.header("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (!token || scheme?.toLowerCase() !== "bearer") return null;
  return token.trim();
};

const toAuth = (payload) => {
  if (!payload?.sub || !ROLES.has(payload.role)) {
    throw new HttpError(401, "Invalid or expired token");
  }
  return {
    userId: payload.sub,
    role: payload.role,
    email: payload.email,
  };
};

export const requireAuth = (req, _res, next) => {
  const token = readBearerToken(req);
  if (!token) {
    return next(new HttpError(401, "Authentication required"));
  }

  try {
    req.auth = toAuth(verifyAccessToken(token));
    return next();
  } catch {
    return next(new HttpError(401, "Invalid or expired token"));
  }
};

export const optionalAuth = (req, _res, next) => {
  const token = readBearerToken(req);
  if (!token) {
    req.auth = null;
    return next();
  }

  try {
    req.auth = toAuth(verifyAccessToken(token));
    return next();
  } catch {
    return next(new HttpError(401, "Invalid or expired token"));
  }
};

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.auth) {
    return next(new HttpError(401, "Authentication required"));
  }
  if (!roles.includes(req.auth.role)) {
    return next(new HttpError(403, "Forbidden"));
  }
  return next();
};
