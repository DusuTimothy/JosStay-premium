"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  addDays,
  amenityLabel,
  formatDate,
  nightsBetween,
  toIso,
  typeLabel,
} from "@josstay/shared";
import { CalendarPicker } from "@/components/shared/CalendarPicker";
import { ReviewCard } from "@/components/shared/ReviewCard";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RatingStars } from "@/components/ui/RatingStars";
import { Icon } from "@/components/ui/Icon";
import { useBooking, useCurrency, useToast } from "@/components/providers";
import { supportWhatsAppUrl } from "@/lib/contact";
import { EmptyState, ErrorState, LoadingResults } from "@/components/shared/states";
import { api } from "@/lib/api";
import { amenityIcon, typeEyebrow } from "./property-utils";
import { Divider, TrustRow } from "./PropertyPrimitives";
import { DateSheet } from "./DateSheet";
import { GuestStepper } from "./GuestStepper";
import { ReserveWidget } from "./ReserveWidget";

const today = toIso(new Date());

function PropertyDetailContent({ property }) {
  const router = useRouter();
  const { draft, setDraft } = useBooking();
  const { toast } = useToast();
  const { format } = useCurrency();
  const [activeImage, setActiveImage] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const [serverQuote, setServerQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const defaultState = useMemo(() => {
    const useDraft = draft && draft.propertySlug === property?.slug;
    return {
      checkIn: useDraft ? draft.checkIn : addDays(today, 7),
      checkOut: useDraft ? draft.checkOut : addDays(today, 9),
      guests: useDraft ? draft.guests : 2,
      roomId: useDraft ? draft.roomId : property?.rooms?.[0]?.id,
    };
  }, [draft, property]);

  const [state, setState] = useState(defaultState);
  const appliedDraft = useRef(false);

  useEffect(() => {
    setState(defaultState);
    appliedDraft.current = Boolean(draft && draft.propertySlug === property?.slug);
    setActiveImage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.slug]);

  useEffect(() => {
    if (draft && draft.propertySlug === property?.slug && !appliedDraft.current) {
      appliedDraft.current = true;
      setState(defaultState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const anyOverlay = bookingOpen || galleryOpen || dateOpen;

  useEffect(() => {
    document.body.style.overflow = anyOverlay ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [anyOverlay]);

  useEffect(() => {
    if (!property?.slug || !state.checkIn || !state.checkOut) return;
    let active = true;
    setQuoteLoading(true);
    (async () => {
      try {
        const qs = new URLSearchParams({
          checkIn: state.checkIn,
          checkOut: state.checkOut,
          guests: String(state.guests || 1),
        });
        if (state.roomId) qs.set("roomId", state.roomId);
        const res = await api.get(`/api/properties/${encodeURIComponent(property.slug)}/quote?${qs.toString()}`, { cache: "no-store" });
        if (active) setServerQuote(res?.data?.quote || null);
      } catch {
        if (active) setServerQuote(null);
      } finally {
        if (active) setQuoteLoading(false);
      }
    })();
    return () => { active = false; };
  }, [property?.slug, state.checkIn, state.checkOut, state.roomId, state.guests]);

  const quote = serverQuote || {
    nightly: property?.price || 0,
    nights: nightsBetween(state.checkIn, state.checkOut) || 0,
    subtotal: (property?.price || 0) * (nightsBetween(state.checkIn, state.checkOut) || 0),
    cleaning: 0,
    service: 0,
    total: (property?.price || 0) * (nightsBetween(state.checkIn, state.checkOut) || 0),
    room: (property?.rooms || []).find((r) => r.id === state.roomId) || property?.rooms?.[0] || null,
  };
  const room = quote.room;

  const book = () => {
    if (!state.checkIn || !state.checkOut) {
      toast("Choose your check-in and check-out dates first", "error");
      setBookingOpen(true);
      return;
    }
    setDraft({
      propertySlug: property.slug,
      roomId: state.roomId,
      checkIn: state.checkIn,
      checkOut: state.checkOut,
      guests: state.guests,
      airportPickup: false,
      bundle: false,
    });
    setBookingOpen(false);
    router.push("/checkout");
  };

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: property.name, url });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied to clipboard", "success");
    } catch {
      toast("Could not copy the link", "error");
    }
  };

  const ratingBreakdown = [
    { label: "Cleanliness", value: Math.min(5, (property.rating || 0) + 0.1) },
    { label: "Accuracy", value: property.rating || 0 },
    { label: "Check-in", value: Math.max(4, (property.rating || 0) - 0.1) },
    { label: "Communication", value: Math.min(5, (property.rating || 0) + 0.05) },
    { label: "Location", value: Math.max(4.2, (property.rating || 0) - 0.2) },
  ];

  const galleryImages = Array.isArray(property.images) ? property.images.filter(Boolean) : [];
  const gallery = galleryImages.slice(0, Math.max(1, Math.min(5, galleryImages.length || 1)));
  const extraPhotos = Math.max(0, galleryImages.length - gallery.length);
  const visibleAmenities = showAllAmenities ? (property.amenities || []) : (property.amenities || []).slice(0, 6);
  const allReviews = Array.isArray(property.reviews) ? property.reviews : [];
  const hostName = property.host?.name || "Host";
  const hostInitials = hostName.split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("") || "H";

  return (
    <div className="pb-28 lg:pb-0">
      <div className="container-page pt-5">
        <nav className="flex items-center gap-1.5 text-[12px] text-muted">
          <Link href="/" className="transition hover:text-plum-700">Home</Link>
          <Icon name="chevronRight" className="h-3 w-3" />
          <Link href="/search" className="transition hover:text-plum-700">Stays</Link>
          <Icon name="chevronRight" className="h-3 w-3" />
          <span className="truncate text-ink">{property.name}</span>
        </nav>
      </div>

      <div className="container-page mt-4">
        <div className="relative grid gap-2 sm:grid-cols-[1.15fr_1fr]">
          <button
            type="button"
            onClick={() => { setActiveImage(0); setGalleryOpen(true); }}
            className="group relative overflow-hidden rounded-lg bg-gray-100"
            aria-label="Open photo gallery"
          >
            {gallery[0] ? (
              <img
                src={gallery[0]}
                alt={`${property.name} main photo`}
                className="aspect-[16/11] h-full w-full object-cover transition duration-500 group-hover:scale-[1.02] sm:aspect-auto sm:min-h-[420px]"
              />
            ) : (
              <div className="aspect-[16/11] h-full w-full sm:min-h-[420px]" />
            )}
          </button>

          <div className="hidden grid-cols-2 grid-rows-2 gap-2 sm:grid">
            {gallery.slice(1, 5).map((image, index) => (
              <button
                key={image || index}
                type="button"
                onClick={() => { setActiveImage(index + 1); setGalleryOpen(true); }}
                className="group relative overflow-hidden rounded-lg bg-gray-100"
                aria-label={`Open photo ${index + 2}`}
              >
                <img
                  src={image}
                  alt={`${property.name} photo ${index + 2}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                />
                {index === gallery.slice(1, 5).length - 1 && extraPhotos > 0 && (
                  <span className="absolute bottom-2.5 right-2.5 rounded-md bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-ink shadow-sm backdrop-blur">
                    +{extraPhotos} photos
                  </span>
                )}
              </button>
            ))}
          </div>

          {extraPhotos > 0 && (
            <button
              type="button"
              onClick={() => { setActiveImage(0); setGalleryOpen(true); }}
              className="absolute bottom-3 right-3 rounded-md border border-white/70 bg-white/95 px-3 py-2 text-[11.5px] font-semibold text-ink shadow-sm backdrop-blur transition hover:bg-white sm:hidden"
            >
              +{extraPhotos} photos
            </button>
          )}

          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {property.verified && <VerifiedBadge className="bg-white/95 shadow-sm" />}
            {property.badge && (
              <Badge tone="gold" icon="sparkles" className="bg-cream/95 shadow-sm">{property.badge}</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="container-page mt-7 grid gap-10 lg:grid-cols-[1fr_360px] lg:gap-12">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-plum-600">
            {(typeEyebrow[property.type] || typeLabel(property.type)) + " · "}
            {property.area}, Jos
          </p>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <h1 className="max-w-2xl font-display text-[34px] font-bold leading-[1.05] tracking-tightest text-ink sm:text-[46px]">
              {property.name}
            </h1>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={share}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3.5 text-[12.5px] font-semibold text-ink transition hover:border-plum-300 hover:text-plum-700"
              >
                <Icon name="share" className="h-3.5 w-3.5" />
                Share
              </button>
              <button
                type="button"
                onClick={() => {
                  setSaved((s) => !s);
                  toast(saved ? "Removed from saved stays" : "Saved for later", "success");
                }}
                className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3.5 text-[12.5px] font-semibold transition ${
                  saved ? "border-plum-700 bg-plum-700 text-white" : "border-line text-ink hover:border-plum-300 hover:text-plum-700"
                }`}
              >
                <Icon name="heart" className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} />
                {saved ? "Saved" : "Save"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-muted">
            <RatingStars rating={property.rating || 0} count={property.reviewCount || 0} size="md" />
            <span className="inline-flex items-center gap-1.5">
              <Icon name="pin" className="h-4 w-4 text-plum-600" />
              {property.distanceKm} km from city centre
            </span>
          </div>

          <div className="mt-7"><Divider /></div>

          <div className="flex items-start justify-between gap-4 py-6">
            <div>
              <h2 className="font-display text-[21px] font-bold tracking-tight text-ink">
                {room?.name || "Room"} hosted by {hostName.split(" ")[0] || "Host"}
              </h2>
              <p className="mt-1 text-[13px] text-muted">
                {room?.capacity || property.maxGuests || 1} guests · {room?.beds || ""} · {room?.size || ""}
                {property.host?.superhost ? " · Superhost" : ""}
              </p>
            </div>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold-500 font-display text-[15px] font-bold text-plum-900">
              {hostInitials}
            </span>
          </div>

          <Divider />

          <div className="space-y-5 py-6">
            <TrustRow icon="checkCircle" title={property.verified ? "Verified listing" : "Listing details"} text={property.verified ? "This listing has been reviewed for quality and safety." : "Review listing details and policies before booking."} />
            <TrustRow icon="pin" title="Location" text={`${property.area} · ${property.distanceKm} km from the airport`} />
            <TrustRow
              icon="calendar"
              title={property.freeCancellation ? "Free cancellation" : "Booking policy"}
              text={property.freeCancellation ? "Free cancellation options may apply based on room and policy." : "Review the host and room policy before completing your booking."}
            />
          </div>

          <Divider />

          <div className="py-8">
            <h2 className="font-display text-[26px] font-bold leading-tight tracking-tightest text-ink sm:text-[32px]">
              {property.summary}
            </h2>
            <p className="mt-4 text-[14.5px] leading-relaxed text-muted">{property.description}</p>
          </div>

          <Divider />

          <div className="py-8">
            <h2 className="font-display text-[24px] font-bold tracking-tight text-ink sm:text-[28px]">What this place offers</h2>
            <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {visibleAmenities.map((id) => (
                <div key={id} className="flex items-center gap-3">
                  <span className="shrink-0 text-plum-700">
                    <Icon name={amenityIcon[id] || "checkCircle"} className="h-5 w-5" strokeWidth={1.6} />
                  </span>
                  <span className="text-[14px] text-ink">{amenityLabel(id)}</span>
                </div>
              ))}
            </div>
            {(property.amenities || []).length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllAmenities((v) => !v)}
                className="mt-6 rounded-lg border border-line px-4 py-2.5 text-[12.5px] font-semibold text-ink transition hover:border-plum-300"
              >
                {showAllAmenities ? "Show fewer amenities" : `Show all ${(property.amenities || []).length} amenities`}
              </button>
            )}
          </div>

          <Divider />

          <div className="py-8">
            <h2 className="font-display text-[24px] font-bold tracking-tight text-ink sm:text-[28px]">Choose your room</h2>
            <div className="mt-5 space-y-3">
              {(property.rooms || []).map((r) => {
                const selected = state.roomId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setState((s) => ({ ...s, roomId: r.id, guests: Math.min(s.guests, r.capacity || s.guests) }))}
                    className={`flex w-full items-center justify-between gap-4 rounded-lg border p-4 text-left transition ${
                      selected ? "border-plum-500 bg-plum-50/70" : "border-line bg-white hover:border-plum-300"
                    }`}
                    aria-pressed={selected}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${selected ? "border-plum-700 bg-plum-700 text-white" : "border-gray-300 bg-white"}`}>
                        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      <div>
                        <p className="text-[14px] font-bold text-ink">{r.name}</p>
                        <p className="mt-0.5 text-[11.5px] text-muted">{r.beds} · {r.capacity} guest{r.capacity === 1 ? "" : "s"} · {r.size}</p>
                        <p className="mt-1 text-[11px] font-medium text-emerald-700">{r.refundable ? "Refundable options available" : "Check rate conditions"}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[14px] font-bold text-ink">{format(r.price)}</p>
                      <p className="text-[10.5px] text-muted">/ night</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <Divider />

          <div className="py-8">
            <h2 className="font-display text-[24px] font-bold tracking-tight text-ink sm:text-[28px]">Availability</h2>
            <p className="mt-1.5 text-[13px] text-muted">Select your dates to estimate your total before booking.</p>
            <div className="mt-5 rounded-lg border border-line bg-white p-4 sm:p-5">
              <CalendarPicker
                checkIn={state.checkIn}
                checkOut={state.checkOut}
                onChange={({ checkIn, checkOut }) => setState((s) => ({ ...s, checkIn, checkOut }))}
                months={1}
              />
            </div>
          </div>

          <Divider />

          <div className="py-8">
            <h2 className="font-display text-[24px] font-bold tracking-tight text-ink sm:text-[28px]">House rules</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(property.houseRules || []).map((rule) => (
                <div key={rule} className="flex items-start gap-2.5 text-[13.5px] text-muted">
                  <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.4} />
                  {rule}
                </div>
              ))}
            </div>
          </div>

          <Divider />

          <div className="py-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-[24px] font-bold tracking-tight text-ink sm:text-[28px]">Reviews</h2>
              <RatingStars rating={property.rating || 0} count={property.reviewCount || 0} size="md" />
            </div>

            <div className="mt-5 grid gap-5 rounded-lg border border-line bg-white p-5 sm:grid-cols-[150px_1fr]">
              <div className="flex flex-col justify-center gap-1 border-b border-line pb-4 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-5">
                <p className="font-display text-[38px] font-bold leading-none text-ink">{property.rating || 0}</p>
                <RatingStars rating={property.rating || 0} showValue={false} mode="stars" size="md" />
                <p className="text-[11px] text-muted">{property.reviewCount || 0} reviews</p>
              </div>
              <div className="space-y-2.5">
                {ratingBreakdown.map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="w-[92px] shrink-0 text-[11px] text-muted">{item.label}</span>
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <span className="block h-full rounded-full bg-plum-600" style={{ width: `${(item.value / 5) * 100}%` }} />
                    </span>
                    <span className="w-6 text-right text-[11px] font-semibold text-ink">{item.value.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>

            {allReviews.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {allReviews.map((review, idx) => (
                  <ReviewCard key={`${review.name}-${idx}`} review={review} />
                ))}
              </div>
            ) : (
              <p className="mt-4 text-[13px] text-muted">No reviews yet.</p>
            )}
          </div>

          <Divider />

          <div className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-plum-100 font-display text-sm font-bold text-plum-700">
                {hostInitials}
              </span>
              <div>
                <p className="text-[14px] font-bold text-ink">Hosted by {hostName}</p>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  {property.host?.joined ? `Hosting since ${property.host.joined}` : "Host information"}
                  {property.host?.superhost ? " · Superhost" : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                icon="whatsapp"
                onClick={() =>
                  window.open(
                    supportWhatsAppUrl(`Hi JosStay, I have an enquiry about ${property.name}.`),
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                Contact support
              </Button>
              <Button href="/help" variant="ghost" iconRight="arrowRight" className="!px-2">Help centre</Button>
            </div>
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <ReserveWidget property={property} state={state} setState={setState} quote={quote} quoteLoading={quoteLoading} onBook={book} onOpenDates={() => setDateOpen(true)} />
            <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-cream px-4 py-3 text-[11.5px] leading-relaxed text-ink/75">
              <Icon name="shield" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-700" />
              Review the final price and booking details before you confirm your stay.
            </div>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),0.6rem)] pt-2.5 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div>
            <p className="font-display text-[19px] font-bold leading-none text-ink">
              {format(property.price)}
              <span className="ml-1 font-sans text-[11.5px] font-normal text-muted">/ night</span>
            </p>
            <p className="mt-1 text-[10.5px] text-muted">
              {state.checkIn && state.checkOut
                ? `${nightsBetween(state.checkIn, state.checkOut)} night${nightsBetween(state.checkIn, state.checkOut) === 1 ? "" : "s"} · ${format(quote.total || 0)} total`
                : "Choose dates for total"}
            </p>
          </div>
          <Button size="lg" iconRight="arrowRight" className="min-w-[160px]" onClick={() => setBookingOpen(true)}>
            Reserve
          </Button>
        </div>
      </div>

      <DateSheet open={dateOpen} onClose={() => setDateOpen(false)} state={state} setState={setState} property={property} />

      {galleryOpen && galleryImages.length > 0 && (
        <div className="fixed inset-0 z-[85] overflow-y-auto bg-ink/95 p-4 sm:p-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex items-center justify-between text-white">
              <div>
                <p className="font-display text-lg font-bold">{property.name}</p>
                <p className="text-[11px] text-white/60">Photos</p>
              </div>
              <button type="button" onClick={() => setGalleryOpen(false)} className="grid h-10 w-10 place-items-center rounded-full border border-white/25 text-white transition hover:bg-white/10" aria-label="Close gallery">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
            <img
              key={galleryImages[activeImage] ?? activeImage}
              src={galleryImages[activeImage] ?? galleryImages[0]}
              alt={`${property.name} photo ${activeImage + 1}`}
              onError={(event) => {
                if (galleryImages[0] && event.currentTarget.src !== galleryImages[0]) {
                  event.currentTarget.src = galleryImages[0];
                }
              }}
              className="w-full rounded-lg object-cover"
            />
            <div className="mt-3 grid grid-cols-4 gap-2">
              {galleryImages.map((image, index) => (
                <button key={`${image}-${index}`} type="button" onClick={() => setActiveImage(index)} className={`overflow-hidden rounded-md border-2 ${activeImage === index ? "border-gold-400" : "border-transparent"}`} aria-label={`View photo ${index + 1}`}>
                  <img src={image} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {bookingOpen && (
        <div className="fixed inset-0 z-[75] lg:hidden">
          <button type="button" className="absolute inset-0 bg-ink/45 animate-fade-in" aria-label="Close booking panel" onClick={() => setBookingOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-float animate-slide-up">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="font-display text-xl font-bold text-ink">Reserve your stay</h3>
                <p className="text-[12px] text-muted">{property.name}</p>
              </div>
              <button type="button" onClick={() => setBookingOpen(false)} className="grid h-9 w-9 place-items-center rounded-full border border-line" aria-label="Close">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setBookingOpen(false); setDateOpen(true); }} className="rounded-lg border border-line px-3 py-2.5 text-left">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted">Check in</span>
                <span className="mt-1 block text-[12.5px] font-semibold text-ink">{state.checkIn ? formatDate(state.checkIn) : "Add date"}</span>
              </button>
              <button type="button" onClick={() => { setBookingOpen(false); setDateOpen(true); }} className="rounded-lg border border-line px-3 py-2.5 text-left">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted">Check out</span>
                <span className="mt-1 block text-[12.5px] font-semibold text-ink">{state.checkOut ? formatDate(state.checkOut) : "Add date"}</span>
              </button>
              <div className="col-span-2 flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
                <span className="text-[12.5px] font-semibold text-ink">{state.guests} guest{state.guests === 1 ? "" : "s"}</span>
                <GuestStepper state={state} setState={setState} max={property.maxGuests} />
              </div>
            </div>

            <div className="mb-3 space-y-2 rounded-lg bg-canvas px-3.5 py-3 text-[12.5px]">
              <div className="flex justify-between">
                <span className="text-muted">{format(quote.nightly || 0)} × {quote.nights || 0} night{(quote.nights || 0) === 1 ? "" : "s"}</span>
                <span className="font-medium text-ink">{format(quote.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Fees</span>
                <span className="font-medium text-ink">{format((quote.cleaning || 0) + (quote.service || 0))}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-2">
                <span className="font-bold text-ink">Total</span>
                <span className="font-bold text-ink">{format(quote.total || 0)}</span>
              </div>
            </div>

            <Button onClick={book} full size="lg" iconRight="arrowRight">Reserve your stay</Button>
            <p className="mt-2 text-center text-[10.5px] text-muted">Final availability and pricing are confirmed before payment.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function PropertyDetailView() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params?.slug === "string" ? params.slug : Array.isArray(params?.slug) ? params.slug[0] : "";
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError("");
      setProperty(null);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");

    (async () => {
      try {
        const res = await api.get(`/api/properties/${encodeURIComponent(slug)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!active) return;
        setProperty(res?.data || null);
      } catch (err) {
        if (!active || err?.code === "REQUEST_ABORTED" || err?.name === "AbortError") return;
        setProperty(null);
        if (err?.status === 404) {
          setError("not_found");
        } else {
          setError(err?.message || "Failed to load property");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [slug, reloadKey]);

  if (loading) {
    return (
      <div className="container-page py-10">
        <LoadingResults count={3} />
      </div>
    );
  }

  if (error === "not_found" || (!property && !error)) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon="alert"
          title="Stay not found"
          description="This listing may be unavailable. Browse other stays in Jos."
          actionLabel="Browse stays"
          onAction={() => router.push("/search")}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-page py-16">
        <ErrorState
          title="We couldn't load this stay"
          description={error}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    );
  }

  return <PropertyDetailContent property={property} />;
}
