import { BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME, IS_PRODUCTION } from "../config/env.js";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export const isBrevoConfigured = () =>
  Boolean(BREVO_API_KEY && BREVO_SENDER_EMAIL);

const normalizeRecipient = (to) => {
  if (!to) return null;
  if (typeof to === "string") return { email: to };
  if (to.email) return { email: String(to.email), ...(to.name ? { name: String(to.name) } : {}) };
  return null;
};

export async function sendTransactionalEmail({
  to,
  subject,
  htmlContent,
  textContent,
  tags = [],
}) {
  const recipient = normalizeRecipient(to);
  if (!recipient?.email) return { skipped: true, reason: "missing_recipient" };

  if (!isBrevoConfigured()) {
    if (!IS_PRODUCTION) {
      console.info("[brevo] skipped (not configured)", {
        to: recipient.email,
        subject,
        tags,
      });
    }
    return { skipped: true, reason: "not_configured" };
  }

  const body = {
    sender: {
      email: BREVO_SENDER_EMAIL,
      ...(BREVO_SENDER_NAME ? { name: BREVO_SENDER_NAME } : {}),
    },
    to: [recipient],
    subject: String(subject || "JosStay notification"),
    ...(htmlContent ? { htmlContent: String(htmlContent) } : {}),
    ...(textContent ? { textContent: String(textContent) } : {}),
    ...(Array.isArray(tags) && tags.length ? { tags: tags.map(String).slice(0, 10) } : {}),
  };

  if (!body.htmlContent && !body.textContent) {
    body.textContent = String(subject || "JosStay notification");
  }

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.message || data?.code || `Brevo request failed (${response.status})`;
      if (!IS_PRODUCTION) console.warn("[brevo] send failed", { message, to: recipient.email, subject });
      return { ok: false, error: message };
    }

    return { ok: true, messageId: data?.messageId || null };
  } catch (error) {
    if (!IS_PRODUCTION) console.warn("[brevo] send error", { message: error?.message || String(error) });
    return { ok: false, error: error?.message || "Brevo request failed" };
  }
}
