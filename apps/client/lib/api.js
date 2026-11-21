const DEFAULT_TIMEOUT_MS = 15000;

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

export const getApiBaseUrl = () => trimTrailingSlash(process.env.NEXT_PUBLIC_API_URL || "");

export class ApiError extends Error {
  constructor(message, { status = 0, code, data, requestId } = {}) {
    super(message || "Request failed");
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
    this.requestId = requestId;
  }
}

let authHandlers = {
  getAccessToken: () => null,
  refreshSession: null,
};

let refreshPromise = null;

export const setApiAuthHandlers = (handlers = {}) => {
  authHandlers = {
    getAccessToken:
      typeof handlers.getAccessToken === "function" ? handlers.getAccessToken : () => null,
    refreshSession:
      typeof handlers.refreshSession === "function" ? handlers.refreshSession : null,
  };
};

const refreshSessionOnce = async () => {
  if (typeof authHandlers.refreshSession !== "function") return null;
  if (!refreshPromise) {
    refreshPromise = Promise.resolve()
      .then(() => authHandlers.refreshSession())
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

const isJsonContentType = (contentType) => /application\/json|application\/problem\+json/i.test(contentType || "");

const parseBody = async (response) => {
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  if (isJsonContentType(contentType)) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    const text = await response.text();
    return text || null;
  } catch {
    return null;
  }
};

const resolveErrorMessage = (data, response) => {
  if (data && typeof data === "object") {
    if (typeof data.error === "string" && data.error) return data.error;
    if (typeof data.message === "string" && data.message) return data.message;
  }
  if (typeof data === "string" && data) return data;
  return `Request failed (${response.status})`;
};

export const createIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const shouldSkipAuthRefresh = (path) => {
  const normalized = String(path || "");
  return (
    normalized.includes("/api/auth/refresh") ||
    normalized.includes("/api/auth/login") ||
    normalized.includes("/api/auth/register") ||
    normalized.includes("/api/auth/google") ||
    normalized.includes("/api/auth/logout")
  );
};

const resolveToken = (explicitToken) => {
  if (explicitToken) return explicitToken;
  try {
    return authHandlers.getAccessToken?.() || null;
  } catch {
    return null;
  }
};

/**
 * Low-level API request helper for the JosStay backend.
 */
export async function apiRequest(path, options = {}) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new ApiError("API base URL is not configured (NEXT_PUBLIC_API_URL)", { status: 0 });
  }

  const {
    method = "GET",
    body,
    headers = {},
    token,
    idempotencyKey,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    cache,
    credentials = "include",
    _retriedAuth = false,
  } = options;

  const url = /^https?:\/\//i.test(path)
    ? path
    : `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const doFetch = async (activeToken) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
    const abortHandler = () => controller.abort(signal?.reason);
    if (signal) {
      if (signal.aborted) controller.abort(signal.reason);
      else signal.addEventListener("abort", abortHandler, { once: true });
    }

    const finalHeaders = new Headers(headers);
    if (!finalHeaders.has("X-JosStay-Request")) finalHeaders.set("X-JosStay-Request", "1");
    if (activeToken) finalHeaders.set("Authorization", `Bearer ${activeToken}`);
    if (idempotencyKey) finalHeaders.set("Idempotency-Key", idempotencyKey);

    let payload = body;
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    if (body !== undefined && body !== null && !isFormData && typeof body !== "string") {
      if (!finalHeaders.has("Content-Type")) finalHeaders.set("Content-Type", "application/json");
      payload = JSON.stringify(body);
    } else if (typeof body === "string" && !finalHeaders.has("Content-Type")) {
      finalHeaders.set("Content-Type", "application/json");
    }
    if (!finalHeaders.has("Accept")) finalHeaders.set("Accept", "application/json");

    try {
      const response = await fetch(url, {
        method,
        headers: finalHeaders,
        body: method === "GET" || method === "HEAD" ? undefined : payload,
        signal: controller.signal,
        cache,
        credentials,
      });

      const data = await parseBody(response);
      const requestId = response.headers.get("x-request-id") || data?.requestId || undefined;

      if (!response.ok) {
        throw new ApiError(resolveErrorMessage(data, response), {
          status: response.status,
          code: data?.code,
          data,
          requestId,
        });
      }

      return data;
    } finally {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener("abort", abortHandler);
    }
  };

  const initialToken = resolveToken(token);

  try {
    return await doFetch(initialToken);
  } catch (error) {
    if (error instanceof ApiError) {
      if (
        error.status === 401 &&
        !_retriedAuth &&
        !shouldSkipAuthRefresh(path) &&
        typeof authHandlers.refreshSession === "function"
      ) {
        try {
          const refreshed = await refreshSessionOnce();
          const nextToken = refreshed?.token || refreshed?.accessToken || resolveToken(null);
          if (nextToken) {
            return await apiRequest(path, { ...options, token: nextToken, _retriedAuth: true });
          }
        } catch {
          // Fall through to original auth error.
        }
      }
      throw error;
    }
    if (error?.name === "AbortError") {
      throw new ApiError("Request timed out or was aborted", { status: 0, code: "REQUEST_ABORTED" });
    }
    throw new ApiError(error?.message || "Network request failed", { status: 0, code: "NETWORK_ERROR" });
  }
}

export const api = {
  get: (path, options) => apiRequest(path, { ...options, method: "GET" }),
  post: (path, body, options) => apiRequest(path, { ...options, method: "POST", body }),
  put: (path, body, options) => apiRequest(path, { ...options, method: "PUT", body }),
  patch: (path, body, options) => apiRequest(path, { ...options, method: "PATCH", body }),
  delete: (path, options) => apiRequest(path, { ...options, method: "DELETE" }),
};
