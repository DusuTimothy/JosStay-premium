"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate, getProperty, typeLabel } from "@josstay/shared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useBooking, useCurrency, useToast } from "@/components/providers";
import { EmptyState, SkeletonCard } from "@/components/shared/states";

const TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "cancelled", label: "Cancelled" },
];

export function BookingsView() {
  const router = useRouter();
  const { bookings, cancelBooking, hydrated } = useBooking();
  const { toast } = useToast();
  const { format } = useCurrency();
  const [tab, setTab] = useState("upcoming");
  const [cancelRef, setCancelRef] = useState(null);

  const counts = useMemo(
    () => ({
      upcoming: bookings.filter((b) => b.status === "upcoming").length,
      past: bookings.filter((b) => b.status === "completed").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
    }),
    [bookings]
  );

  const visible = useMemo(() => {
    const filtered = bookings.filter((b) => b.status === tab);
    return [...filtered].sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1));
  }, [bookings, tab]);

  const selected = bookings.find((b) => b.reference === cancelRef);
  const selectedProperty = selected ? getProperty(selected.propertySlug) : null;

  const confirmCancel = () => {
    if (!cancelRef) return;
    cancelBooking(cancelRef);
    toast("Booking cancelled. Any eligible refund is on its way (demo).", "success");
    setCancelRef(null);
  };

  return (
    <div className="container-page pb-16 pt-7 sm:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Your trips</span>
          <h1 className="mt-4 font-display text-[34px] font-bold leading-none tracking-tightest text-ink sm:text-[44px]">My bookings</h1>
          <p className="mt-3 text-[13px] text-muted">Manage upcoming stays, revisit past trips, or book again.</p>
        </div>
        <Button href="/search" variant="secondary" icon="search">Find another stay</Button>
      </div>

      <div className="mt-7 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`chip shrink-0 ${active ? "chip-active" : ""}`} aria-pressed={active}>
              {t.label}
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-plum-50 text-plum-700"}`}>{counts[t.id]}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-4">
        {!hydrated ? (
          <><SkeletonCard /><SkeletonCard /></>
        ) : visible.length === 0 ? (
          <EmptyState
            icon="calendar"
            title={tab === "upcoming" ? "No upcoming stays yet" : tab === "past" ? "No past stays yet" : "No cancelled bookings"}
            description={
              tab === "upcoming"
                ? "When you book a stay in Jos, it will show up here with everything you need for arrival."
                : tab === "past"
                  ? "Completed trips will appear here so you can rebook in one tap."
                  : "You haven't cancelled any bookings. That's a good thing."
            }
            actionLabel="Browse stays"
            onAction={() => router.push("/search")}
          />
        ) : (
          visible.map((booking) => {
            const property = getProperty(booking.propertySlug);
            if (!property) return null;
            const room = property.rooms.find((r) => r.id === booking.roomId) || property.rooms[0];

            return (
              <article key={booking.reference} className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
                <div className="flex flex-col sm:flex-row">
                  <div className="relative sm:w-52 sm:shrink-0">
                    <img src={property.images[0]} alt={property.name} className="h-40 w-full object-cover sm:h-full" />
                    <span className="absolute left-2.5 top-2.5">
                      {booking.status === "upcoming" ? <Badge tone="verified" icon="checkCircle">Confirmed</Badge> : booking.status === "completed" ? <Badge tone="white" icon="checkCircle">Completed</Badge> : <Badge tone="danger" icon="x">Cancelled</Badge>}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-plum-600">{typeLabel(property.type)} · {property.area}</p>
                        <h2 className="mt-1 truncate font-display text-[18px] font-bold text-ink">{property.name}</h2>
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                          <span className="font-mono font-semibold text-ink">{booking.reference}</span>
                          <span className="text-line">|</span>
                          <span>{room.name}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-[17px] font-bold leading-none text-ink">{format(booking.total || 0)}</p>
                        <p className="mt-1 text-[10px] text-muted">{booking.paymentMethod === "bank" ? "Bank transfer" : booking.paymentMethod === "ussd" ? "USSD" : "Card"}</p>
                      </div>
                    </div>

                    <div className="mt-3.5 grid grid-cols-2 gap-2 rounded-lg bg-canvas p-3 sm:grid-cols-4">
                      {[
                        { label: "Check-in", value: formatDate(booking.checkIn) },
                        { label: "Check-out", value: formatDate(booking.checkOut) },
                        { label: "Guests", value: `${booking.guests} guest${booking.guests === 1 ? "" : "s"}` },
                        { label: "Extras", value: booking.bundleFlight ? "Flight + stay" : booking.airportPickup ? "Airport pickup" : "—" },
                      ].map((item) => (
                        <div key={item.label}>
                          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">{item.label}</p>
                          <p className="mt-1 text-[11.5px] font-semibold text-ink">{item.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button href={`/confirmation/${booking.reference}`} size="sm" variant="secondary">View booking</Button>
                      {booking.status === "upcoming" && (
                        <>
                          <Button size="sm" variant="danger" onClick={() => setCancelRef(booking.reference)}>Cancel</Button>
                          <Link href={`https://wa.me/2348000000000?text=${encodeURIComponent(`Hi JosStay, I need help with booking ${booking.reference} at ${property.name}.`)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-2 py-2 text-[11.5px] font-semibold text-emerald-700">
                            <Icon name="whatsapp" className="h-4 w-4" /> Contact host
                          </Link>
                        </>
                      )}
                      {(booking.status === "completed" || booking.status === "cancelled") && (
                        <Button size="sm" icon="refresh" onClick={() => router.push(`/property/${property.slug}`)}>Rebook</Button>
                      )}
                      {booking.status === "completed" && <span className="ml-auto text-[10px] text-muted">Thanks for staying with JosStay</span>}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { icon: "shield", title: "Verified stays", text: "Every host is checked before going live." },
          { icon: "refresh", title: "Flexible plans", text: "Free cancellation on eligible bookings." },
          { icon: "whatsapp", title: "24/7 support", text: "We're one message away if plans change." },
        ].map((item) => (
          <div key={item.title} className="flex items-start gap-3 rounded-xl border border-line bg-white p-4">
            <Icon name={item.icon} className="mt-0.5 h-4 w-4 text-plum-600" />
            <div>
              <p className="text-[12px] font-bold text-ink">{item.title}</p>
              <p className="mt-0.5 text-[11px] text-muted">{item.text}</p>
            </div>
          </div>
        ))}
      </div>

      {cancelRef && selected && selectedProperty && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
          <button type="button" className="absolute inset-0 bg-ink/45 animate-fade-in" aria-label="Close cancellation dialog" onClick={() => setCancelRef(null)} />
          <div className="relative w-full max-w-md rounded-t-2xl bg-white p-5 shadow-float animate-slide-up sm:rounded-2xl">
            <h3 className="font-display text-xl font-bold text-ink">Cancel this booking?</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              You&apos;re about to cancel <strong className="font-semibold text-ink">{selectedProperty.name}</strong> ({selected.reference}) for {formatDate(selected.checkIn)} – {formatDate(selected.checkOut)}.
            </p>
            <div className="mt-3 rounded-lg bg-cream p-3 text-[11.5px] leading-relaxed text-ink/75">
              {selectedProperty.freeCancellation
                ? "This stay is eligible for free cancellation up to 48 hours before check-in. In this demo, cancellation is instant."
                : "This rate is non-refundable, so the full amount would normally be retained. This is a demo — you can still cancel."}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setCancelRef(null)}>Keep booking</Button>
              <Button variant="danger" onClick={confirmCancel}>Cancel booking</Button>
            </div>
            <button type="button" onClick={() => setCancelRef(null)} className="mt-3 w-full text-center text-[11px] font-semibold text-muted">Go back</button>
          </div>
        </div>
      )}
    </div>
  );
}
