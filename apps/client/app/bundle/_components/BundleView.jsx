"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, formatDate, formatNaira, toIso } from "@josstay/shared";
import { CalendarPicker } from "@/components/shared/CalendarPicker";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { useBooking, useCurrency, useToast } from "@/components/providers";
import { api } from "@/lib/api";
import { LoadingResults } from "@/components/shared/states";

const today = toIso(new Date());

const DEFAULT_ORIGINS = [
  { id: "LOS", city: "Lagos", airport: "Murtala Muhammed (LOS)", fare: 78000 },
  { id: "ABV", city: "Abuja", airport: "Nnamdi Azikiwe (ABV)", fare: 52000 },
  { id: "KAN", city: "Kano", airport: "Mallam Aminu Kano (KAN)", fare: 60000 },
  { id: "PHC", city: "Port Harcourt", airport: "Omagwa (PHC)", fare: 95000 },
];

const pickProperty = (list, slug) =>
  (Array.isArray(list) ? list : []).find((p) => p?.slug === slug) || (Array.isArray(list) ? list[0] : null);

export function BundleView() {
  const router = useRouter();
  const { setDraft } = useBooking();
  const { toast } = useToast();
  const { format } = useCurrency();

  const [origins, setOrigins] = useState(DEFAULT_ORIGINS);
  const [properties, setProperties] = useState([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [originId, setOriginId] = useState("LOS");
  const [propertySlug, setPropertySlug] = useState("");
  const [checkIn, setCheckIn] = useState(addDays(today, 7));
  const [checkOut, setCheckOut] = useState(addDays(today, 9));
  const [passengers, setPassengers] = useState(2);
  const [dateOpen, setDateOpen] = useState(false);
  const [quoteData, setQuoteData] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [configRes, propsRes] = await Promise.allSettled([
          api.get("/api/bundle/config", { cache: "no-store" }),
          api.get("/api/properties", { cache: "no-store" }),
        ]);

        if (!active) return;

        if (configRes.status === "fulfilled") {
          const cfg = configRes.value?.data || configRes.value || {};
          const cfgOrigins = Array.isArray(cfg.origins) && cfg.origins.length ? cfg.origins : DEFAULT_ORIGINS;
          setOrigins(cfgOrigins);
          setOriginId((current) => (cfgOrigins.some((o) => o.id === current) ? current : cfgOrigins[0]?.id || "LOS"));
        }

        if (propsRes.status === "fulfilled") {
          const data = Array.isArray(propsRes.value?.data) ? propsRes.value.data : [];
          setProperties(data);
          setPropertySlug((current) => (data.some((p) => p.slug === current) ? current : data[0]?.slug || ""));
        } else {
          setProperties([]);
        }
      } catch {
        // Leave empty state; user can retry.
      } finally {
        if (active) setLoadingProperties(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = dateOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [dateOpen]);

  const origin = origins.find((o) => o.id === originId) || origins[0];
  const property = useMemo(() => pickProperty(properties, propertySlug), [properties, propertySlug]);
  const room = property?.rooms?.[0] || null;

  useEffect(() => {
    let active = true;
    if (!property?.slug || !origin?.id || !checkIn || !checkOut) {
      setQuoteData(null);
      return () => {
        active = false;
      };
    }

    setQuoteLoading(true);
    (async () => {
      try {
        const res = await api.post("/api/bundle/quote", {
          propertySlug: property.slug,
          originId: origin.id,
          checkIn,
          checkOut,
          ...(room?.id ? { roomId: room.id } : {}),
          guests: Math.min(passengers, property.maxGuests || passengers),
          passengers,
          airportPickup: false,
        }, { cache: "no-store" });
        if (!active) return;
        setQuoteData(res?.data || null);
      } catch {
        if (!active) return;
        setQuoteData(null);
      } finally {
        if (active) setQuoteLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [property?.slug, property?.maxGuests, room?.id, origin?.id, checkIn, checkOut, passengers]);

  const quote = quoteData?.quote || null;
  const flightTotal = quoteData?.flight?.total ?? (origin ? origin.fare * passengers : 0);
  const total = quoteData?.totals?.total ?? (quote ? flightTotal + quote.total : flightTotal);
  const savings = quoteData?.totals?.savings ?? quote?.discount ?? 0;

  const reserve = () => {
    if (!property || !room || !quote || !origin) {
      toast("Bundle details are not ready yet. Please try again.", "error");
      return;
    }
    if (!checkIn || !checkOut) {
      toast("Choose your travel dates first", "error");
      return;
    }
    setDraft({
      propertySlug: property.slug,
      roomId: room.id || room.code,
      checkIn,
      checkOut,
      guests: Math.min(passengers, property.maxGuests || passengers),
      airportPickup: false,
      bundle: true,
      bundleFlight: {
        origin: origin.city,
        originCode: origin.id,
        passengers,
        fare: origin.fare,
        flightTotal,
      },
    });
    router.push("/checkout");
  };

  if (loadingProperties && properties.length === 0) {
    return (
      <div className="container-page pb-16 pt-8">
        <LoadingResults count={2} />
      </div>
    );
  }

  if (!property || !room) {
    return (
      <div className="container-page pb-16 pt-8">
        <div className="rounded-xl border border-line bg-white p-6">
          <h1 className="font-display text-[24px] font-bold text-ink">Bundle unavailable</h1>
          <p className="mt-2 text-sm text-muted">We couldn&apos;t load stay options for this bundle right now. Please try again.</p>
          <div className="mt-4">
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page pb-16 pt-6 sm:pt-9">
      <div className="max-w-2xl">
        <Badge tone="gold" icon="sparkles">Save on your stay</Badge>
        <span className="eyebrow mt-5 block">Optional travel extra</span>
        <h1 className="mt-4 font-display text-[36px] font-bold leading-[1.02] tracking-tightest text-ink sm:text-[50px]">
          Flight + stay,<br className="hidden sm:block" /> bundled.
        </h1>
        <p className="mt-4 text-[14px] leading-relaxed text-muted sm:text-[15px]">
          Fly into Jos and settle into a verified stay. Pick your route, dates and guests — we&apos;ll bundle the discount into one clear price.
        </p>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="space-y-4">
          <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-plum-50 text-plum-700"><Icon name="plane" className="h-4 w-4" /></span>
              <div>
                <h2 className="font-display text-[18px] font-bold tracking-tight text-ink">Your flight</h2>
                <p className="text-[11.5px] text-muted">Indicative fares · return · economy.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">Flying from</span>
                <select value={origin?.id || ""} onChange={(e) => setOriginId(e.target.value)} className="field">
                  {origins.map((o) => (
                    <option key={o.id} value={o.id}>{o.city} — {o.id}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Passengers</span>
                <select value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} className="field">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n} passenger{n === 1 ? "" : "s"}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 rounded-lg border border-line bg-canvas p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-center">
                  <p className="font-display text-[22px] font-bold leading-none text-ink">{origin?.id || "---"}</p>
                  <p className="mt-1 text-[10.5px] text-muted">{origin?.city || ""}</p>
                </div>
                <div className="flex flex-1 items-center gap-2 px-2">
                  <span className="h-px flex-1 bg-line" />
                  <Icon name="plane" className="h-4 w-4 text-plum-600" />
                  <span className="h-px flex-1 bg-line" />
                </div>
                <div className="text-center">
                  <p className="font-display text-[22px] font-bold leading-none text-ink">JOS</p>
                  <p className="mt-1 text-[10.5px] text-muted">Jos</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-[11.5px] text-muted">
                <span>{formatDate(checkIn, { year: undefined })} → {formatDate(checkOut)}</span>
                <span className="font-semibold text-ink">{origin ? format(origin.fare) : "—"} / passenger</span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-plum-50 text-plum-700"><Icon name="bed" className="h-4 w-4" /></span>
              <div>
                <h2 className="font-display text-[18px] font-bold tracking-tight text-ink">Your stay</h2>
                <p className="text-[11.5px] text-muted">Bundle discount is applied automatically when available.</p>
              </div>
            </div>

            <label className="mt-5 block">
              <span className="label">Property</span>
              <select value={property.slug} onChange={(e) => setPropertySlug(e.target.value)} className="field">
                {properties.map((p) => (
                  <option key={p.slug} value={p.slug}>{p.name} · {p.area} · {formatNaira(p.price)}/night</option>
                ))}
              </select>
            </label>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setDateOpen(true)} className="rounded-lg border border-line px-3.5 py-3 text-left transition hover:border-plum-300 hover:bg-plum-50/40">
                <span className="label">Check-in</span>
                <span className="text-[13px] font-semibold text-ink">{formatDate(checkIn)}</span>
              </button>
              <button type="button" onClick={() => setDateOpen(true)} className="rounded-lg border border-line px-3.5 py-3 text-left transition hover:border-plum-300 hover:bg-plum-50/40">
                <span className="label">Check-out</span>
                <span className="text-[13px] font-semibold text-ink">{formatDate(checkOut)}</span>
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-lg border border-line p-3">
              {property.images?.[0] ? (
                <img src={property.images[0]} alt={property.name} className="h-16 w-20 shrink-0 rounded-md object-cover" />
              ) : (
                <div className="h-16 w-20 shrink-0 rounded-md bg-canvas" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-ink">{property.name}</p>
                <p className="text-[11px] text-muted">{property.area} · {quote?.room?.name || room.name || "Selected room"} · {quote?.nights || "—"} night{quote?.nights === 1 ? "" : "s"}</p>
                <p className="mt-0.5 text-[11px] font-medium text-emerald-700">{property.verified ? "Verified" : "Listing"}{property.freeCancellation ? " · free cancellation" : ""}</p>
              </div>
              <p className="shrink-0 text-[13px] font-bold text-ink">{format(property.price)}<span className="text-[10px] font-normal text-muted"> /night</span></p>
            </div>
          </section>

          <div className="rounded-lg bg-cream p-4 text-[11.5px] leading-relaxed text-ink/75">
            <strong className="font-semibold text-ink">How the bundle works:</strong> your flight and stay are reserved together. Any bundle discount is shown in the summary and confirmed at checkout.
          </div>
        </div>

        <aside>
          <div className="sticky top-24 rounded-xl border border-line bg-white p-5 shadow-card">
            <h2 className="font-display text-[18px] font-bold tracking-tight text-ink">Bundle summary</h2>
            <p className="mt-0.5 text-[11.5px] text-muted">{origin?.city || ""} → Jos · {passengers} passenger{passengers === 1 ? "" : "s"}</p>

            {!quote ? (
              <div className="mt-4 rounded-lg border border-line bg-canvas p-4 text-[12px] text-muted">
                {quoteLoading ? "Calculating bundle price…" : "Select valid dates and options to see pricing."}
              </div>
            ) : (
              <>
                <div className="mt-4 space-y-2.5 text-[12.5px]">
                  <div className="flex items-center justify-between gap-3"><span className="text-muted">Flights ({passengers} × {format(origin?.fare || 0)})</span><span className="font-medium text-ink">{format(flightTotal)}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-muted">Stay ({quote.nights} nights)</span><span className="font-medium text-ink">{format(quote.subtotal)}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-muted">Cleaning fee</span><span className="font-medium text-ink">{format(quote.cleaning)}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-muted">Service fee</span><span className="font-medium text-ink">{format(quote.service)}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-emerald-700">Bundle discount</span><span className="font-semibold text-emerald-700">−{format(savings)}</span></div>
                </div>

                <div className="mt-4 border-t border-line pt-4">
                  <div className="flex items-end justify-between">
                    <p className="text-[12px] text-muted">Bundle total</p>
                    <p className="font-display text-[22px] font-bold leading-none text-ink">{format(total)}</p>
                  </div>
                  <p className="mt-1.5 text-[10.5px] text-muted">You save {format(savings)} vs booking separately</p>
                </div>
              </>
            )}

            <Button full size="lg" className="mt-4" iconRight="arrowRight" onClick={reserve} disabled={!quote || quoteLoading || !origin}>
              Reserve bundle
            </Button>
            <p className="mt-2 text-center text-[10.5px] text-muted">You&apos;ll confirm guest details and payment next.</p>
          </div>
        </aside>
      </div>

      {dateOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
          <button type="button" className="absolute inset-0 bg-ink/45 animate-fade-in" aria-label="Close dates" onClick={() => setDateOpen(false)} />
          <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-float animate-slide-up sm:rounded-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-display text-xl font-bold text-ink">Flight &amp; stay dates</h3>
                <p className="mt-1 text-[11.5px] text-muted">Your return date is also your check-out date.</p>
              </div>
              <button type="button" onClick={() => setDateOpen(false)} className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink" aria-label="Close"><Icon name="x" className="h-4 w-4" /></button>
            </div>
            <CalendarPicker checkIn={checkIn} checkOut={checkOut} onChange={({ checkIn: ci, checkOut: co }) => { setCheckIn(ci); setCheckOut(co); }} months={1} />
            <div className="mt-4 flex justify-end border-t border-line pt-4">
              <Button onClick={() => { if (checkIn && checkOut) setDateOpen(false); else toast("Select both dates to continue", "error"); }}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
