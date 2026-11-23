import { corsOrigins } from "../config/env.js";

const DEFAULT_CLIENT_ORIGIN = "http://localhost:3000";

const clientBaseUrl = () =>
  (corsOrigins[0] || DEFAULT_CLIENT_ORIGIN).replace(/\/+$/, "");

/**
 * Build an absolute client link with a single `token` query parameter.
 * CLIENT_ORIGIN may contain a comma-separated allowlist; the first entry is
 * treated as the canonical public client origin.
 */
export const buildClientTokenLink = (pathname, token) => {
  const path = String(pathname || "/").startsWith("/") ? pathname : `/${pathname}`;
  const url = new URL(`${clientBaseUrl()}${path}`);
  url.searchParams.set("token", String(token));
  return url.toString();
};
