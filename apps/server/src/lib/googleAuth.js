import { GOOGLE_CLIENT_ID } from "../config/env.js";
import { HttpError } from "./http.js";

const TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

const isTruthy = (value) => value === true || value === "true" || value === "1";

export const verifyGoogleIdToken = async (credential) => {
  if (!GOOGLE_CLIENT_ID) {
    throw new HttpError(503, "Google sign-in is not configured");
  }
  if (!credential || typeof credential !== "string") {
    throw new HttpError(400, "Google credential is required");
  }

  const url = `${TOKENINFO_URL}?id_token=${encodeURIComponent(credential)}`;
  let response;
  try {
    response = await fetch(url, { method: "GET", headers: { accept: "application/json" } });
  } catch {
    throw new HttpError(503, "Unable to verify Google sign-in right now");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload) {
    throw new HttpError(401, "Invalid Google credential");
  }

  if (payload.aud !== GOOGLE_CLIENT_ID) {
    throw new HttpError(401, "Google credential is not valid for this app");
  }

  const exp = Number(payload.exp);
  if (Number.isFinite(exp) && exp * 1000 <= Date.now()) {
    throw new HttpError(401, "Google credential has expired");
  }

  if (!isTruthy(payload.email_verified)) {
    throw new HttpError(401, "Google account email is not verified");
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const sub = String(payload.sub || "").trim();
  if (!email || !sub) {
    throw new HttpError(401, "Google account information is incomplete");
  }

  return {
    sub,
    email,
    name: String(payload.name || payload.given_name || "").trim(),
  };
};