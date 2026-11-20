"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate, getProperty, quoteStay, typeLabel } from "@josstay/shared";
import { PriceSummary } from "@/components/shared/PriceSummary";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { useAuth, useBooking, useCurrency, useToast } from "@/components/providers";
import { api } from "@/lib/api";
import { openPaystackInline } from "@/lib/paystackInline";
import { EmptyState, ErrorState, LoadingResults } from "@/components/shared/states";

const PAYMENT_METHODS = [
  { id: "card", label: "Card", description: "Pay securely with card", icon: "card" },
  { id: "bank", label: "Bank transfer", description: "Pay via bank options", icon: "bank" },
  { id: "ussd", label: "USSD", description: "Pay with USSD where available", icon: "phone" },
];

function Field({ label, error, children, hint }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] font-medium text-red-600">{error}</span>}
    </label>
  );
}

function SectionCard({ number, title, aside, children }) {
  return (
    <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-plum-50 text-[11px] font-bold text-plum-700">
          {number}
        </span>
        <h2 className="font-display text-[19px] font-bold tracking-tight text-ink">{title}</h2>
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export function CheckoutView() {
  const router = useRouter();
  const auth = useAuth();
  const { draft, setDraft, clearDraft, createBooking } = useBooking();
  const { toast } = useToast();
  const { format, currency } = useCurrency();

  const [property, setProperty] = useState(null);
  const [propertyLoading, setPropertyLoading] = useState(false);
  const [propertyError, setPropertyError] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    requests: "",
    terms: false,
  });
  const [pickup, setPickup] = useState(draft?.airportPickup || false);
  const [method, setMethod] = useState("card");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!draft?.propertySlug) return;
    let active = true;
    setPropertyLoading(true);
    setPropertyError("");

    (async () => {
      try {
        const res = await api.get(`/api/properties/${encodeURIComponent(draft.propertySlug)}`, { cache: "no-store" });
        if (!active) return;
        setProperty(res?.data || null);
      } catch (error) {
        if (!active) return;
        // Fallback to bundled data for resilience in demo/local environments.
        const fallback = getProperty(draft.propertySlug);
        if (fallback) setProperty(fallback);
        else setPropertyError(error?.message || "Could not load property details");
      } finally {
        if (active) setPropertyLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [draft?.propertySlug]);

  useEffect(() => {
    if (!auth.user) return;
    setForm((f) => ({
      ...f,
      email: f.email || auth.user.email || "",
      firstName: f.firstName || (auth.user.name ? auth.user.name.split(" ")[0] : ""),
      lastName: f.lastName || (auth.user.name ? auth.user.name.split(" ").slice(1).join(" ") : ""),
    }));
  }, [auth.user]);

  const quote = useMemo(() => {
    if (!property || !draft) return null;
    try {
      return quoteStay(property, draft.checkIn, draft.checkOut, {
        roomId: draft.roomId,
        airportPickup: pickup,
        bundleDiscount: draft.bundle,
      });
    } catch {
      return null;
    }
  }, [property, draft, pickup]);

  const update = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.firstName.trim()) next.firstName = "First name is required";
    if (!form.lastName.trim()) next.lastName = "Last name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) next.email = "Enter a valid email address";
    if (form.phone.replace(/\D/g, "").length < 10) next.phone = "Enter a valid phone number";
    if (!form.terms) next.terms = "Please accept the booking terms";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitBooking = async () => {
    setSubmitError("");
    if (!auth.isAuthenticated) {
      router.push("/account");
      return;
    }
    if (!draft || !property) return;
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast("Please check the highlighted fields", "error");
      return;
    }

    setPaying(true);
    try {
      const payload = {
        propertySlug: draft.propertySlug,
        ...(draft.roomId ? { roomId: draft.roomId } : {}),
        checkIn: draft.checkIn,
        checkOut: draft.checkOut,
        guests: Number(draft.guests || 1),
        airportPickup: Boolean(pickup),
        paymentMethod: method,
        ...(form.requests.trim() ? { requests: form.requests.trim() } : {}),
        guest: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
        },
      };

      const result = await createBooking(payload);
      const booking = result?.booking;
      const payment = result?.payment;

      // Persist pickup choice in draft for UX continuity; server is source of truth for booking.
      setDraft({ ...draft, airportPickup: Boolean(pickup) });

      const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";

      if (payment?.provider === "paystack" && payment?.reference) {
        // Prefer Paystack Inline checkout when configured.
        if (paystackPublicKey) {
          const inlineResult = await openPaystackInline({
            key: paystackPublicKey,
            email: payment.email || payload.guest.email,
            amountKobo: payment.amountKobo,
            amount: payment.amount ?? booking?.total,
            reference: payment.reference,
            currency: payment.currency || booking?.currency || "NGN",
            method,
            metadata: {
              bookingReference: booking?.reference,
              custom_fields: [
                {
                  display_name: "Booking Reference",
                  variable_name: "booking_reference",
                  value: booking?.reference || "",
                },
              ],
            },
          });

          if (inlineResult?.status === "success") {
            const paidRef = inlineResult?.response?.reference || payment.reference;
            try {
              await api.get(`/api/payments/paystack/verify?reference=${encodeURIComponent(paidRef)}`, {
                cache: "no-store",
              });
            } catch {
              // Webhook/confirmation page can reconcile final state; continue to confirmation.
            }
            clearDraft();
            toast("Payment received. Confirming your booking…", "success");
            router.push(`/confirmation/${encodeURIComponent(booking.reference)}?reference=${encodeURIComponent(paidRef)}`);
            return;
          }

          // Inline closed/cancelled: booking reservation exists with initialized payment.
          toast("Payment was not completed. You can try again from your booking.", "info");
          router.push(`/confirmation/${encodeURIComponent(booking.reference)}`);
          return;
        }

        // Fallback to hosted Paystack checkout if inline key is unavailable.
        if (payment.authorizationUrl) {
          window.location.assign(payment.authorizationUrl);
          return;
        }
      }

      if (payment?.authorizationUrl) {
        window.location.assign(payment.authorizationUrl);
        return;
      }

      if (booking?.reference) {
        clearDraft();
        toast(payment?.status === "paid" ? "Booking confirmed" : "Booking created", "success");
        router.push(`/confirmation/${booking.reference}`);
        return;
      }

      throw new Error("Booking could not be completed");
    } catch (error) {
      const message = error?.message || "Could not complete your booking";
      setSubmitError(message);
      toast(message, "error");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setPaying(false);
    }
  };

  if (!draft) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon="calendar"
          title="Your booking is empty"
          description="Choose a stay and your dates first, then come back here to complete your booking."
          actionLabel="Browse stays"
          onAction={() => router.push("/search")}
        />
      </div>
    );
  }

  if (propertyLoading && !property) {
    return (
      <div className="container-page py-10">
        <LoadingResults count={2} />
      </div>
    );
  }

  if (propertyError && !property) {
    return (
      <div className="container-page py-16">
        <ErrorState
          title="Could not load checkout"
          description={propertyError}
          onRetry={() => router.refresh()}
        />
      </div>
    );
  }

  if (!property || !quote) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon="alert"
          title="Unable to prepare checkout"
          description="We couldn't load the selected stay details. Please try selecting your stay again."
          actionLabel="Back to search"
          onAction={() => router.push("/search")}
        />
      </div>
    );
  }

  const grandTotal = quote.total;

  return (
    <div className="container-page pb-32 pt-6 lg:pb-16 lg:pt-8">
      <Link href={`/property/${property.slug}`} className="inline-flex items-center gap-2 text-[12.5px] text-muted transition hover:text-plum-700">
        <Icon name="chevronLeft" className="h-4 w-4" />
        Back to stay
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Secure checkout</span>
          <h1 className="mt-4 font-display text-[34px] font-bold leading-none tracking-tightest text-ink sm:text-[42px]">Confirm and pay</h1>
        </div>
        <Badge tone="verified" icon="lock">Secure booking</Badge>
      </div>

      {!auth.isLoading && !auth.isAuthenticated && (
        <div className="mt-6 rounded-xl border border-gold-200 bg-cream p-4 sm:p-5">
          <p className="text-[13px] font-semibold text-ink">Sign in to complete your booking</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">Bookings are linked to your account for secure payment confirmation and management.</p>
          <div className="mt-3">
            <Button href="/account" size="sm" iconRight="arrowRight">Sign in or create account</Button>
          </div>
        </div>
      )}

      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-white p-4">
            <div className="flex gap-3.5">
              {property.images?.[0] ? (
                <img src={property.images[0]} alt={property.name} className="h-[84px] w-[104px] shrink-0 rounded-lg object-cover sm:h-24 sm:w-32" />
              ) : (
                <div className="h-[84px] w-[104px] shrink-0 rounded-lg bg-canvas sm:h-24 sm:w-32" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-plum-600">{typeLabel(property.type)} · {property.area}, Jos</p>
                <h2 className="mt-1.5 truncate font-display text-[17px] font-bold text-ink sm:text-[19px]">{property.name}</h2>
                <p className="mt-0.5 text-[11.5px] text-muted">{quote.room?.name || "Selected room"} · {draft.guests} guest{draft.guests === 1 ? "" : "s"}</p>
                <p className="mt-1.5 text-[11.5px] text-muted">
                  {formatDate(draft.checkIn, { year: undefined })} → {formatDate(draft.checkOut)} · {quote.nights} night{quote.nights === 1 ? "" : "s"}
                </p>
              </div>
              <Link href={`/property/${property.slug}`} className="hidden shrink-0 self-start text-[12px] font-semibold text-plum-700 underline decoration-plum-300 underline-offset-4 sm:block">Edit</Link>
            </div>
          </div>

          {submitError && (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div className="flex-1">
                <p className="text-[13px] font-bold text-red-800">Could not complete booking</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-red-700">{submitError}</p>
              </div>
              <button type="button" onClick={() => setSubmitError("")} className="text-red-700 transition hover:text-red-900" aria-label="Dismiss">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
          )}

          <SectionCard number="1" title="Guest details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" error={errors.firstName}>
                <input value={form.firstName} onChange={(e) => update("firstName", e.target.value)} className={`field ${errors.firstName ? "!border-red-400" : ""}`} placeholder="Tunde" autoComplete="given-name" />
              </Field>
              <Field label="Last name" error={errors.lastName}>
                <input value={form.lastName} onChange={(e) => update("lastName", e.target.value)} className={`field ${errors.lastName ? "!border-red-400" : ""}`} placeholder="Adeyemi" autoComplete="family-name" />
              </Field>
              <Field label="Email address" error={errors.email}>
                <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className={`field ${errors.email ? "!border-red-400" : ""}`} placeholder="you@example.com" autoComplete="email" />
              </Field>
              <Field label="Phone number" error={errors.phone} hint="We'll use this for booking updates.">
                <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} className={`field ${errors.phone ? "!border-red-400" : ""}`} placeholder="+234 800 000 0000" autoComplete="tel" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Special requests" hint="Optional.">
                  <textarea rows={3} value={form.requests} onChange={(e) => update("requests", e.target.value)} className="field resize-none" placeholder="Any requests for your stay." />
                </Field>
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-canvas px-3.5 py-3">
              <input type="checkbox" checked={pickup} onChange={(e) => setPickup(e.target.checked)} className="mt-0.5 h-4 w-4 accent-plum-700" />
              <span className="flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink">Add airport pickup</span>
                  <span className="text-[12px] font-bold text-ink">Included in quote</span>
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">If available for this stay, pickup will be reflected in the final price.</span>
              </span>
            </label>
          </SectionCard>

          <SectionCard number="2" title="Payment" aside={<Badge tone="verified" icon="lock">Secured</Badge>}>
            <div className="grid gap-2 sm:grid-cols-3">
              {PAYMENT_METHODS.map((option) => {
                const active = method === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setMethod(option.id)}
                    className={`rounded-lg border p-3 text-left transition ${active ? "border-plum-600 bg-plum-50/70" : "border-line hover:border-plum-300"}`}
                    aria-pressed={active}
                  >
                    <span className="flex items-center gap-2">
                      <Icon name={option.icon} className={`h-4 w-4 ${active ? "text-plum-700" : "text-muted"}`} />
                      <span className="text-[13px] font-semibold text-ink">{option.label}</span>
                    </span>
                    <span className="mt-1 block text-[10px] text-muted">{option.description}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-lg border border-line bg-canvas p-4 text-[11.5px] leading-relaxed text-muted">
              You&apos;ll complete payment securely. Final availability and amount are confirmed by the server before payment is accepted.
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" checked={form.terms} onChange={(e) => update("terms", e.target.checked)} className="mt-0.5 h-4 w-4 accent-plum-700" />
              <span className="text-[11px] leading-relaxed text-muted">I agree to the booking terms and cancellation policy.</span>
            </label>
            {errors.terms && <p className="mt-1 text-[11px] font-medium text-red-600">{errors.terms}</p>}

            <div className="mt-5 hidden lg:block">
              <Button full size="lg" loading={paying} disabled={!auth.isAuthenticated} onClick={submitBooking} icon={paying ? undefined : "lock"}>
                {paying ? "Processing…" : `Continue to payment · ${format(grandTotal)}`}
              </Button>
              <p className="mt-2 text-center text-[10.5px] text-muted">Secure checkout powered by Paystack. Payment opens in a secure inline window when available.</p>
            </div>
          </SectionCard>
        </div>

        <aside>
          <div className="sticky top-24 space-y-3">
            <div className="rounded-xl border border-line bg-white p-5 shadow-card">
              <PriceSummary quote={quote} checkIn={draft.checkIn} checkOut={draft.checkOut} pickup={pickup} bundle={Boolean(draft.bundle)} flight={draft.bundleFlight} />
            </div>

            <div className="rounded-xl border border-line bg-white p-4">
              <p className="flex items-center gap-2 text-[12px] font-semibold text-ink"><Icon name="shield" className="h-4 w-4 text-plum-700" />Book with confidence</p>
              <ul className="mt-2 space-y-1.5 text-[11px] text-muted">
                <li>Server-verified pricing and availability</li>
                <li>Secure payment processing</li>
                <li>Support available if you need help</li>
              </ul>
            </div>
            <p className="px-1 text-[10.5px] leading-relaxed text-muted">Paying in {currency}.</p>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),0.6rem)] pt-2.5 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="flex-1">
            <p className="font-display text-[19px] font-bold leading-none text-ink">{format(grandTotal)}</p>
            <p className="mt-1 text-[10.5px] text-muted">{quote.nights} night{quote.nights === 1 ? "" : "s"} · fees included</p>
          </div>
          <Button size="lg" loading={paying} disabled={!auth.isAuthenticated} onClick={submitBooking} className="min-w-[170px]">
            {paying ? "Processing…" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
