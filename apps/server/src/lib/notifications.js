import { sendTransactionalEmail } from "./brevo.js";

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
