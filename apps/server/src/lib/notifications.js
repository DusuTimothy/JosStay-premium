import { IS_PRODUCTION } from "../config/env.js";
import { isBrevoConfigured, sendTransactionalEmail } from "./brevo.js";

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatNaira = (amount) => `₦${Number(amount || 0).toLocaleString("en-NG")}`;

export async function sendBookingConfirmationEmail(booking) {
  const to = booking?.guest?.email;
  if (!to) return { skipped: true, reason: "missing_email" };

  const reference = esc(booking.reference || "");
  const property = esc(booking.propertyName || "your stay");
  const room = esc(booking.roomName || "Selected room");
  const checkIn = esc(booking.checkIn || "");
  const checkOut = esc(booking.checkOut || "");
  const total = esc(formatNaira(booking.total));
  const guestName = esc([booking?.guest?.firstName, booking?.guest?.lastName].filter(Boolean).join(" ") || "Guest");

  const subject = `JosStay booking confirmation ${booking.reference || ""}`.trim();
  const textContent = [
    `Hi ${guestName},`,
    "",
    `Your JosStay booking is confirmed.`,
    `Reference: ${booking.reference || ""}`,
    `Property: ${booking.propertyName || ""}`,
    `Room: ${booking.roomName || ""}`,
    `Check-in: ${booking.checkIn || ""}`,
    `Check-out: ${booking.checkOut || ""}`,
    `Total: ${formatNaira(booking.total)}`,
    "",
    "Thank you for booking with JosStay.",
  ].join("\n");

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">Booking confirmed</h2>
      <p>Hi ${guestName}, your JosStay booking is confirmed.</p>
      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
        <tr><td><strong>Reference</strong></td><td>${reference}</td></tr>
        <tr><td><strong>Property</strong></td><td>${property}</td></tr>
        <tr><td><strong>Room</strong></td><td>${room}</td></tr>
        <tr><td><strong>Check-in</strong></td><td>${checkIn}</td></tr>
        <tr><td><strong>Check-out</strong></td><td>${checkOut}</td></tr>
        <tr><td><strong>Total</strong></td><td>${total}</td></tr>
      </table>
      <p style="margin-top:16px">Thank you for booking with JosStay.</p>
    </div>
  `;

  return sendTransactionalEmail({ to, subject, htmlContent, textContent, tags: ["booking", "confirmation"] });
}

export async function sendHostListingSubmittedEmail({ to, name, listingName }) {
  if (!to) return { skipped: true, reason: "missing_email" };
  const subject = "Your JosStay listing was submitted for review";
  const safeName = esc(name || "Host");
  const safeListing = esc(listingName || "your listing");
  const textContent = `Hi ${name || "Host"},\n\nYour listing "${listingName || "your listing"}" was submitted and is pending verification/review.\n\nJosStay`;
  const htmlContent = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111"><p>Hi ${safeName},</p><p>Your listing <strong>${safeListing}</strong> was submitted and is pending verification/review.</p><p>JosStay</p></div>`;
  return sendTransactionalEmail({ to, subject, htmlContent, textContent, tags: ["host", "listing-submitted"] });
}

export async function sendHostWelcomeEmail({ to, name }) {
  if (!to) return { skipped: true, reason: "missing_email" };
  const subject = "Welcome to JosStay hosting";
  const safeName = esc(name || "Host");
  const textContent = `Hi ${name || "Host"},\n\nYour JosStay host account is ready. You can now create and manage your listings from your host dashboard.\n\nJosStay`;
  const htmlContent = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111"><p>Hi ${safeName},</p><p>Your JosStay host account is ready. You can now create and manage your listings from your host dashboard.</p><p>JosStay</p></div>`;
  return sendTransactionalEmail({ to, subject, htmlContent, textContent, tags: ["host", "welcome"] });
}

const sendAuthEmail = async ({ to, subject, htmlContent, textContent, tags, link }) => {
  // Local/dev fallback: when email is not configured, log the action link so
  // the flow can be tested. Never log tokens in production.
  if (!IS_PRODUCTION && !isBrevoConfigured()) {
    console.info("[auth] email link (development only)", { to, subject, link });
  }
  return sendTransactionalEmail({ to, subject, htmlContent, textContent, tags });
};

export async function sendEmailVerificationEmail({ to, name, link, expiresInMinutes }) {
  if (!to) return { skipped: true, reason: "missing_email" };
  const safeName = esc(name || "there");
  const safeLink = esc(link);
  const hours = Math.max(1, Math.round(Number(expiresInMinutes || 0) / 60));
  const subject = "Verify your JosStay email address";
  const textContent = `Hi ${name || "there"},\n\nConfirm your email address to finish setting up your JosStay account:\n${link}\n\nThis link expires in about ${hours} hour(s). If you did not create a JosStay account, you can ignore this email.\n\nJosStay`;
  const htmlContent = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Verify your email</h2>
      <p>Hi ${safeName},</p>
      <p>Confirm your email address to finish setting up your JosStay account.</p>
      <p style="margin:24px 0">
        <a href="${safeLink}" style="display:inline-block;background:#c9a227;color:#111;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Verify email</a>
      </p>
      <p style="font-size:13px;color:#555">Or paste this link into your browser:<br /><span style="word-break:break-all">${safeLink}</span></p>
      <p style="font-size:13px;color:#555">This link expires in about ${hours} hour(s). If you did not create a JosStay account, you can ignore this email.</p>
      <p>JosStay</p>
    </div>
  `;
  return sendAuthEmail({
    to,
    subject,
    htmlContent,
    textContent,
    tags: ["auth", "email-verification"],
    link,
  });
}

export async function sendPasswordResetEmail({ to, name, link, expiresInMinutes }) {
  if (!to) return { skipped: true, reason: "missing_email" };
  const safeName = esc(name || "there");
  const safeLink = esc(link);
  const minutes = Math.max(1, Math.round(Number(expiresInMinutes || 0)));
  const subject = "Reset your JosStay password";
  const textContent = `Hi ${name || "there"},\n\nWe received a request to reset your JosStay password. Use this link to choose a new password:\n${link}\n\nThis link expires in about ${minutes} minute(s) and can only be used once. If you did not request a reset, you can ignore this email; your password will not change.\n\nJosStay`;
  const htmlContent = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Reset your password</h2>
      <p>Hi ${safeName},</p>
      <p>We received a request to reset your JosStay password. Choose a new password using the button below.</p>
      <p style="margin:24px 0">
        <a href="${safeLink}" style="display:inline-block;background:#c9a227;color:#111;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Reset password</a>
      </p>
      <p style="font-size:13px;color:#555">Or paste this link into your browser:<br /><span style="word-break:break-all">${safeLink}</span></p>
      <p style="font-size:13px;color:#555">This link expires in about ${minutes} minute(s) and can only be used once. If you did not request a reset, you can ignore this email; your password will not change.</p>
      <p>JosStay</p>
    </div>
  `;
  return sendAuthEmail({
    to,
    subject,
    htmlContent,
    textContent,
    tags: ["auth", "password-reset"],
    link,
  });
}

export async function sendHostListingReviewEmail({ to, name, listingName, approved, notes }) {
  if (!to) return { skipped: true, reason: "missing_email" };
  const safeName = esc(name || "Host");
  const safeListing = esc(listingName || "your listing");
  const safeNotes = esc(notes || "");
  const subject = approved
    ? "Your JosStay listing has been approved"
    : "Update on your JosStay listing review";
  const statusLine = approved
    ? `Your listing <strong>${safeListing}</strong> has been approved and is now live.`
    : `Your listing <strong>${safeListing}</strong> needs attention before it can go live.`;
  const notesHtml = !approved && safeNotes ? `<p><strong>Review notes:</strong> ${safeNotes}</p>` : "";
  const notesText = !approved && notes ? `\nReview notes: ${notes}\n` : "";
  const textContent = `Hi ${name || "Host"},\n\n${approved ? `Your listing "${listingName || "your listing"}" has been approved and is now live.` : `Your listing "${listingName || "your listing"}" was reviewed and needs attention before it can go live.`}${notesText}\nJosStay`;
  const htmlContent = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111"><p>Hi ${safeName},</p><p>${statusLine}</p>${notesHtml}<p>JosStay</p></div>`;
  return sendTransactionalEmail({ to, subject, htmlContent, textContent, tags: ["host", "listing-review"] });
}
