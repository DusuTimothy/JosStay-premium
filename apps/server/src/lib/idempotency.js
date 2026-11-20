import crypto from "node:crypto";
import { isDatabaseEnabled, query } from "./db.js";
import { HttpError } from "./http.js";

const IDEMPOTENCY_KEY_HEADER = "idempotency-key";
const MAX_KEY_LENGTH = 128;
const KEY_PATTERN = /^[A-Za-z0-9._:-]+$/;

export const getIdempotencyKey = (req) => {
  const raw = req.header(IDEMPOTENCY_KEY_HEADER);
  if (raw == null || raw === "") return null;
  const key = String(raw).trim();
  if (!key || key.length > MAX_KEY_LENGTH || !KEY_PATTERN.test(key)) {
    throw new HttpError(400, "Invalid Idempotency-Key header");
  }
  return key;
};

export const hashIdempotencyPayload = (payload) => {
  const normalized = JSON.stringify(payload ?? null);
  return crypto.createHash("sha256").update(normalized).digest("hex");
};

/**
 * Claim or replay an idempotent operation.
 *
 * scope: stable identifier for the caller/operation boundary (e.g. `user:<id>:booking:create`)
 * key: client-provided idempotency key
 * operation: logical operation name/path for observability
 * requestHash: hash of the canonical request payload
 *
 * Returns:
 * - { type: "replay", status, body } when a completed matching request exists
 * - { type: "claimed" } when this request owns the key and should proceed
 */
export const beginIdempotency = async ({ scope, key, operation, requestHash }) => {
  if (!isDatabaseEnabled) {
    // Non-DB environments cannot persist idempotency records; callers should fail
    // closed in production or explicitly allow non-idempotent demo behavior.
    return { type: "unavailable" };
  }

  const insert = await query(
    `
      insert into public.idempotency_keys (scope, idempotency_key, operation, request_hash, status)
      values ($1, $2, $3, $4, 'in_progress')
      on conflict (scope, idempotency_key) do nothing
      returning id
    `,
    [scope, key, operation, requestHash],
  );

  if (insert.rowCount === 1) {
    return { type: "claimed" };
  }

  const existing = await query(
    `
      select request_hash, status, response_status, response_body, updated_at, expires_at
      from public.idempotency_keys
      where scope = $1 and idempotency_key = $2
      limit 1
    `,
    [scope, key],
  );

  const row = existing.rows[0];
  if (!row) {
    throw new HttpError(409, "Unable to claim idempotency key");
  }

  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    throw new HttpError(409, "Idempotency key has expired; retry with a new key");
  }

  if (row.request_hash !== requestHash) {
    throw new HttpError(409, "Idempotency key reuse with a different request payload");
  }

  if (row.status === "completed" && row.response_status != null) {
    return {
      type: "replay",
      status: row.response_status,
      body: row.response_body,
    };
  }

  if (row.status === "in_progress") {
    throw new HttpError(409, "A request with this idempotency key is already in progress");
  }

  if (row.status === "failed") {
    throw new HttpError(409, "Previous request with this idempotency key failed; retry with a new key");
  }

  throw new HttpError(409, "Idempotency key is not reusable in its current state");
};

export const completeIdempotency = async ({ scope, key, status, body }) => {
  if (!isDatabaseEnabled) return;
  await query(
    `
      update public.idempotency_keys
      set status = 'completed',
          response_status = $3,
          response_body = $4::jsonb,
          updated_at = now()
      where scope = $1 and idempotency_key = $2
    `,
    [scope, key, status, JSON.stringify(body ?? null)],
  );
};

export const failIdempotency = async ({ scope, key, status = 500, body = null }) => {
  if (!isDatabaseEnabled) return;
  await query(
    `
      update public.idempotency_keys
      set status = 'failed',
          response_status = $3,
          response_body = $4::jsonb,
          updated_at = now()
      where scope = $1 and idempotency_key = $2
    `,
    [scope, key, status, JSON.stringify(body ?? null)],
  );
};
