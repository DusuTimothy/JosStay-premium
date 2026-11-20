"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatDate, getProperty, typeLabel } from "@josstay/shared";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useBooking, useCurrency, useToast } from "@/components/providers";
import { supportWhatsAppUrl } from "@/lib/contact";
import { EmptyState, SkeletonCard } from "@/components/shared/states";

export function ConfirmationView() {
  const params = useParams();
  const { getBooking, hydrated } = useBooking();
  const { toast } = useToast();
  const { format } = useCurrency();
  const [copied, setCopied] = useState(false);

  const booking = getBooking(params.reference);
  const property = booking ? getProperty(booking.propertySlug) : null;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = property
      ? `I just booked ${property.name} in Jos with JosStay. Ref: ${params.reference}`
      : `My JosStay booking ${params.reference}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "My JosStay booking", text, url });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(`${text} — ${url}`);
      setCopied(true);
      toast("Booking link copied", "success");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast("Could not share this booking", "error");
    }
  };

  if (!hydrated && !booking) {
    return (
      <div className="container-page max-w-2xl py-10">
        <SkeletonCard />
      </div>
    );
  }

  if (!booking || !property) {
    return (
      <div className="container-page max-w-2xl py-16">
        <EmptyState
          icon="alert"
          title="Booking not found"
          description="We couldn't find that reference on this device. Check My bookings, or start a new search."
          actionLabel="View my bookings"
          onAction={() => {
            window.location.href = "/bookings";
          }}
        />
      </div>
    );
  }

  const room = property.rooms.find((r) => r.id === booking.roomId) || property.rooms[0];
  const nights = Math.max(
    1,
    Math.round(
      (new Date(`${booking.checkOut}T12:00:00`) - new Date(`${booking.checkIn}T12:00:00`)) / 86400000
    )
  );

  const rows = [
    { label: "Reference", value: booking.reference, mono: true },
    { label: "Guest", value: `${booking.guest?.firstName || ""} ${booking.guest?.lastName || ""}`.trim() || "Guest" },
    { label: "Stay", value: `${property.name} · ${room.name}` },
    { label: "Dates", value: `${formatDate(booking.checkIn)} → ${formatDate(booking.checkOut)}` },
    { label: "Guests", value: `${booking.guests} guest${booking.guests === 1 ? "" : "s"} · ${nights} night${nights === 1 ? "" : "s"}` },
    { label: "Payment", value: booking.paymentMethod === "card" ? "Card (Paystack)" : booking.paymentMethod === "bank" ? "Bank transfer" : "USSD" },
  ];

  if (booking.bundleFlight) {
    rows.push({
      label: "Flight bundle",
      value: `${booking.bundleFlight.origin} (${booking.bundleFlight.originCode}) → Jos · ${booking.bundleFlight.passengers} passenger${booking.bundleFlight.passengers === 1 ? "" : "s"}`,
    });
  }

  return (
    <div className="container-page max-w-4xl pb-16 pt-8 sm:pt-12">
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gold-500 text-plum-900 animate-slide-up">
          <Icon name="check" className="h-7 w-7" strokeWidth={2.4} />
        </span>
        <span className="eyebrow mt-6">Booking confirmed</span>
        <h1 className="mt-4 font-display text-[34px] font-bold leading-[1.02] tracking-tightest text-ink sm:text-[46px]">You&apos;re booked.</h1>
        <p className="mx-auto mt-3 max-w-md text-[13.5px] leading-relaxed text-muted">
          Your stay in Jos is confirmed. A confirmation has been sent to <strong className="font-semibold text-ink">{booking.guest?.email || "your email"}</strong> (demo — no email is actually sent).
        </p>

        <div className="mt-5 inline-flex items-center gap-3 rounded-lg border border-line bg-white px-4 py-2.5">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted">Reference</span>
          <span className="font-mono text-[13px] font-bold text-plum-700">{booking.reference}</span>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(booking.reference);
                setCopied(true);
                toast("Reference copied", "success");
                setTimeout(() => setCopied(false), 2000);
              } catch {
                toast("Could not copy", "error");
              }
            }}
            className="text-muted transition hover:text-plum-700"
            aria-label="Copy booking reference"
          >
            <Icon name={copied ? "check" : "copy"} className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-line bg-white shadow-card">
        <div className="flex gap-4 border-b border-line p-4 sm:p-5">
          <img src={property.images[0]} alt={property.name} className="h-[76px] w-24 shrink-0 rounded-lg object-cover sm:h-24 sm:w-32" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1.5">
              <VerifiedBadge />
              <Badge tone="neutral">{typeLabel(property.type)}</Badge>
            </div>
            <h2 className="mt-1.5 truncate font-display text-[17px] font-bold text-ink">{property.name}</h2>
            <p className="text-[11.5px] text-muted">{property.area}, Jos · {room.name}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
              <Icon name="checkCircle" className="h-3.5 w-3.5" />
              Confirmed · free cancellation on eligible stays
            </p>
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2 sm:p-5">
          {rows.map((row) => (
            <div key={row.label}>
              <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted">{row.label}</p>
              <p className={`mt-1 text-[13px] ${row.mono ? "font-mono font-bold" : "font-medium"} text-ink`}>{row.value}</p>
            </div>
          ))}
          {booking.airportPickup && (
            <div className="sm:col-span-2">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted">Add-on</p>
              <p className="mt-1 text-[13px] font-medium text-ink">Airport pickup · driver meets you at Yakubu Gowon Airport</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-canvas px-4 py-4 sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Total paid</p>
            <p className="mt-1 font-display text-[22px] font-bold leading-none text-ink">{format(booking.total || 0)}</p>
            <p className="mt-1 text-[10.5px] text-muted">No hidden fees · Paystack secured</p>
          </div>
          <Badge tone="success" icon="checkCircle">Paid</Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        <Button href="/bundle" variant="gold" icon="plane" full>Add flight</Button>
        <Button href="/bookings" variant="secondary" full>View booking</Button>
        <Button variant="ghost" icon={copied ? "check" : "share"} onClick={share} full>{copied ? "Copied" : "Share"}</Button>
      </div>

      <div className="mt-5 rounded-xl border border-line bg-white p-5 sm:p-6">
        <h3 className="font-display text-[17px] font-bold text-ink">What happens next</h3>
        <ol className="mt-4 space-y-3.5">
          {[
            "Your host is notified and will confirm your arrival time.",
            "You'll get directions and check-in details 24 hours before arrival (Brevo email).",
            booking.airportPickup ? "Your driver will be waiting at arrivals with your name." : "Need a ride? Add an airport pickup from My bookings.",
            "Support is on WhatsApp 24/7 if anything changes.",
          ].map((step, i) => (
            <li key={step} className="flex items-start gap-3 text-[12.5px] leading-relaxed text-muted">
              <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-plum-50 text-[10px] font-bold text-plum-700">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
          <Icon name="whatsapp" className="h-4 w-4 text-emerald-600" />
          <a href={supportWhatsAppUrl()} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-emerald-700 underline underline-offset-4">Chat with support on WhatsApp</a>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[11px] text-muted">
        <Icon name="shield" className="h-3.5 w-3.5 text-plum-600" />
        Demo booking · sample data · no payment was taken
        <Link href="/" className="font-semibold text-plum-700 underline decoration-plum-300 underline-offset-4">Back home</Link>
      </div>
    </div>
  );
}
