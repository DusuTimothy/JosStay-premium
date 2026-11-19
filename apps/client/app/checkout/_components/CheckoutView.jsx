"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addDays,
  formatDate,
  getProperty,
  quoteStay,
  toIso,
  typeLabel,
} from "@josstay/shared";
import { PriceSummary } from "@/components/shared/PriceSummary";
import { Button } from "@/components/ui/Button";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { useBooking, useCurrency, useToast } from "@/components/providers";
import { EmptyState } from "@/components/shared/states";

const today = toIso(new Date());

const PAYMENT_METHODS = [
  { id: "card", label: "Card", description: "Visa, Mastercard or Verve", icon: "card" },
  { id: "bank", label: "Bank transfer", description: "Wema, GTBank, Zenith, Access", icon: "bank" },
  { id: "ussd", label: "USSD", description: "Dial a code from your phone", icon: "phone" },
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

function formatCard(value) {
  return value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

export function CheckoutView() {
  const router = useRouter();
  const { draft, setDraft, createBooking } = useBooking();
  const { toast } = useToast();
  const { format, currency } = useCurrency();

  const property = draft ? getProperty(draft.propertySlug) : null;
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
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" });
  const [errors, setErrors] = useState({});
  const [paymentError, setPaymentError] = useState("");
  const [paying, setPaying] = useState(false);

  const quote = useMemo(() => {
    if (!property || !draft) return null;
    return quoteStay(property, draft.checkIn, draft.checkOut, {
      roomId: draft.roomId,
      airportPickup: pickup,
      bundleDiscount: draft.bundle,
    });
  }, [property, draft, pickup]);

  const useSample = () => {
    setDraft({
      propertySlug: "crestview-boutique-hotel",
      roomId: "deluxe",
      checkIn: addDays(today, 7),
      checkOut: addDays(today, 9),
      guests: 2,
      airportPickup: false,
      bundle: false,
    });
  };

  if (!draft || !property || !quote) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon="calendar"
          title="Your booking is empty"
          description="Choose a stay and your dates first, then we'll bring you back here to complete the booking."
          actionLabel="Browse stays"
          onAction={() => router.push("/search")}
        >
          <div className="mt-4">
            <button type="button" onClick={useSample} className="text-xs font-semibold text-plum-700 underline underline-offset-4">
              Or start a sample booking at Crestview Boutique Hotel
            </button>
          </div>
        </EmptyState>
      </div>
    );
  }

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

    if (method === "card") {
      if (card.number.replace(/\s/g, "").length !== 16) next.cardNumber = "Enter a 16-digit card number";
      if (!card.name.trim()) next.cardName = "Enter the name on the card";
      if (!/^\d{2}\/\d{2}$/.test(card.expiry)) next.expiry = "Use MM/YY";
      if (card.cvv.length < 3) next.cvv = "Enter the CVV";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const pay = async () => {
    setPaymentError("");
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast("Please check the highlighted fields", "error");
      return;
    }

    setPaying(true);
    await new Promise((resolve) => setTimeout(resolve, 1800));

    if (method === "card" && card.number.replace(/\s/g, "").endsWith("0000")) {
      setPaying(false);
      setPaymentError("Your card was declined by the demo gateway. No money was taken. Try another card or use bank transfer.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const booking = createBooking({
      propertySlug: property.slug,
      roomId: quote.room.id,
      checkIn: draft.checkIn,
      checkOut: draft.checkOut,
      guests: draft.guests,
      airportPickup: pickup,
      bundle: Boolean(draft.bundle),
      bundleFlight: draft.bundleFlight || null,
      paymentMethod: method,
      guest: {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      },
      requests: form.requests.trim(),
    });

    setPaying(false);
    toast("Payment successful — booking confirmed", "success");
    router.push(`/confirmation/${booking.reference}`);
  };

  const grandTotal = quote.total + (draft.bundleFlight?.flightTotal || 0);

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
        <ol className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
          <li className="text-muted">1. Stay</li>
          <Icon name="chevronRight" className="h-3 w-3 text-line" />
          <li className="text-plum-700">2. Details</li>
          <Icon name="chevronRight" className="h-3 w-3 text-line" />
          <li className="text-muted">3. Payment</li>
        </ol>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-white p-4">
            <div className="flex gap-3.5">
              <img src={property.images[0]} alt={property.name} className="h-[84px] w-[104px] shrink-0 rounded-lg object-cover sm:h-24 sm:w-32" />
              <div className="min-w-0 flex-1">
                <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-plum-600">{typeLabel(property.type)} · {property.area}, Jos</p>
                <h2 className="mt-1.5 truncate font-display text-[17px] font-bold text-ink sm:text-[19px]">{property.name}</h2>
                <p className="mt-0.5 text-[11.5px] text-muted">{quote.room.name} · {draft.guests} guest{draft.guests === 1 ? "" : "s"}</p>
                <p className="mt-1.5 text-[11.5px] text-muted">
                  {formatDate(draft.checkIn, { year: undefined })} → {formatDate(draft.checkOut)} · {quote.nights} night{quote.nights === 1 ? "" : "s"}
                </p>
              </div>
              <Link href={`/property/${property.slug}`} className="hidden shrink-0 self-start text-[12px] font-semibold text-plum-700 underline decoration-plum-300 underline-offset-4 sm:block">Edit</Link>
            </div>
          </div>

          {draft.bundleFlight && (
            <div className="rounded-xl border border-plum-200 bg-plum-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-2 text-[12.5px] font-bold text-plum-700">
                  <Icon name="plane" className="h-4 w-4" />
                  Flight + stay bundle · {draft.bundleFlight.origin} → Jos
                </p>
                <Badge tone="gold">10% stay discount applied</Badge>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-plum-700/80">
                {draft.bundleFlight.passengers} passenger{draft.bundleFlight.passengers === 1 ? "" : "s"} · {format(draft.bundleFlight.flightTotal)} flight total included in your payment below.
              </p>
            </div>
          )}

          {paymentError && (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div className="flex-1">
                <p className="text-[13px] font-bold text-red-800">Payment failed</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-red-700">{paymentError}</p>
              </div>
              <button type="button" onClick={() => setPaymentError("")} className="text-red-700 transition hover:text-red-900" aria-label="Dismiss">
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
              <Field label="Phone number" error={errors.phone} hint="We'll use this for arrival updates.">
                <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} className={`field ${errors.phone ? "!border-red-400" : ""}`} placeholder="+234 800 000 0000" autoComplete="tel" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Special requests" hint="Optional — early check-in, high floor, dietary needs.">
                  <textarea rows={3} value={form.requests} onChange={(e) => update("requests", e.target.value)} className="field resize-none" placeholder="Let your host know anything that would make your stay better." />
                </Field>
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-canvas px-3.5 py-3">
              <input type="checkbox" checked={pickup} onChange={(e) => setPickup(e.target.checked)} className="mt-0.5 h-4 w-4 accent-plum-700" />
              <span className="flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink">Add airport pickup</span>
                  <span className="text-[12px] font-bold text-ink">+{format(12000)}</span>
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">A driver meets you at Yakubu Gowon Airport and brings you to the property.</span>
              </span>
            </label>
          </SectionCard>

          <SectionCard number="2" title="Payment method" aside={<Badge tone="verified" icon="lock">Paystack secured</Badge>}>
            <div className="grid gap-2 sm:grid-cols-3">
              {PAYMENT_METHODS.map((option) => {
                const active = method === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => { setMethod(option.id); setPaymentError(""); }}
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

            {method === "card" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Card number" error={errors.cardNumber}>
                    <input
                      inputMode="numeric"
                      value={card.number}
                      onChange={(e) => {
                        setCard((c) => ({ ...c, number: formatCard(e.target.value) }));
                        setErrors((er) => ({ ...er, cardNumber: undefined }));
                      }}
                      className={`field font-mono tracking-wider ${errors.cardNumber ? "!border-red-400" : ""}`}
                      placeholder="4242 4242 4242 4242"
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={() => {
                      setCard({
                        number: "4242 4242 4242 4242",
                        name: `${form.firstName || "Demo"} ${form.lastName || "Guest"}`.toUpperCase(),
                        expiry: "12/28",
                        cvv: "123",
                      });
                      setErrors((er) => ({ ...er, cardNumber: undefined, cardName: undefined, expiry: undefined, cvv: undefined }));
                    }}
                    className="mt-1.5 text-[10.5px] font-semibold text-plum-700 underline decoration-plum-300 underline-offset-4"
                  >
                    Use demo card details
                  </button>
                </div>
                <Field label="Name on card" error={errors.cardName}>
                  <input value={card.name} onChange={(e) => { setCard((c) => ({ ...c, name: e.target.value })); setErrors((er) => ({ ...er, cardName: undefined })); }} className={`field ${errors.cardName ? "!border-red-400" : ""}`} placeholder="TUNDE ADEYEMI" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Expiry" error={errors.expiry}>
                    <input
                      value={card.expiry}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\D/g, "").slice(0, 4);
                        if (value.length > 2) value = `${value.slice(0, 2)}/${value.slice(2)}`;
                        setCard((c) => ({ ...c, expiry: value }));
                        setErrors((er) => ({ ...er, expiry: undefined }));
                      }}
                      className={`field ${errors.expiry ? "!border-red-400" : ""}`}
                      placeholder="MM/YY"
                    />
                  </Field>
                  <Field label="CVV" error={errors.cvv}>
                    <input
                      inputMode="numeric"
                      type="password"
                      value={card.cvv}
                      onChange={(e) => { setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })); setErrors((er) => ({ ...er, cvv: undefined })); }}
                      className={`field ${errors.cvv ? "!border-red-400" : ""}`}
                      placeholder="123"
                    />
                  </Field>
                </div>
                <p className="rounded-lg bg-cream px-3 py-2 text-[11px] leading-relaxed text-ink/75 sm:col-span-2">
                  <strong className="font-semibold text-ink">Demo payment.</strong> Any 16-digit number works. To preview a failed payment, use a card ending in <strong className="font-semibold text-ink">0000</strong>.
                </p>
              </div>
            )}

            {method === "bank" && (
              <div className="mt-4 rounded-lg border border-line bg-canvas p-4">
                <p className="text-[12px] font-semibold text-ink">Transfer to</p>
                <div className="mt-2 grid gap-3 text-[12px] sm:grid-cols-3">
                  <div><p className="text-muted">Account name</p><p className="font-semibold text-ink">JosStay Premium Ltd</p></div>
                  <div><p className="text-muted">Account number</p><p className="font-mono font-semibold text-ink">0123456789</p></div>
                  <div><p className="text-muted">Bank</p><p className="font-semibold text-ink">Wema Bank</p></div>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted">Demo mode: no real transfer is required. Click the button below and we&apos;ll simulate a confirmed transfer.</p>
              </div>
            )}

            {method === "ussd" && (
              <div className="mt-4 rounded-lg border border-line bg-canvas p-4">
                <p className="text-[12px] font-semibold text-ink">Dial on your phone</p>
                <p className="mt-2 rounded-lg bg-white px-3 py-3 font-mono text-[17px] font-bold tracking-wide text-plum-700">*737*000*{grandTotal}#</p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted">Works with GTBank, Zenith, Access and First Bank. Demo mode: no charge will be made.</p>
              </div>
            )}

            <label className="mt-4 flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" checked={form.terms} onChange={(e) => update("terms", e.target.checked)} className="mt-0.5 h-4 w-4 accent-plum-700" />
              <span className="text-[11px] leading-relaxed text-muted">I agree to the JosStay booking terms and the cancellation policy. I understand this is a demo and no real payment will be taken.</span>
            </label>
            {errors.terms && <p className="mt-1 text-[11px] font-medium text-red-600">{errors.terms}</p>}

            <div className="mt-5 hidden lg:block">
              <Button full size="lg" loading={paying} onClick={pay} icon={paying ? undefined : "lock"}>
                {paying ? "Processing payment…" : method === "card" ? `Pay ${format(grandTotal)}` : `Confirm booking · ${format(grandTotal)}`}
              </Button>
              <p className="mt-2 text-center text-[10.5px] text-muted">Your card details are encrypted. Free cancellation up to 48 hours before check-in on eligible stays.</p>
            </div>
          </SectionCard>
        </div>

        <aside>
          <div className="sticky top-24 space-y-3">
            <div className="rounded-xl border border-line bg-white p-5 shadow-card">
              <PriceSummary quote={quote} checkIn={draft.checkIn} checkOut={draft.checkOut} pickup={pickup} bundle={Boolean(draft.bundle)} flight={draft.bundleFlight} />
            </div>

            {property.freeCancellation && (
              <div className="flex items-start gap-2.5 rounded-lg bg-cream px-4 py-3 text-[11.5px] leading-relaxed text-ink/75">
                <Icon name="checkCircle" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-700" />
                Free cancellation until 48 hours before check-in.
              </div>
            )}

            <div className="rounded-xl border border-line bg-white p-4">
              <p className="flex items-center gap-2 text-[12px] font-semibold text-ink"><Icon name="shield" className="h-4 w-4 text-plum-700" />Book with confidence</p>
              <ul className="mt-2 space-y-1.5 text-[11px] text-muted">
                <li>Verified property and host</li>
                <li>No hidden fees at checkout</li>
                <li>24/7 WhatsApp support</li>
              </ul>
            </div>
            <p className="px-1 text-[10.5px] leading-relaxed text-muted">Paying in {currency}. Totals include cleaning and service fees.</p>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),0.6rem)] pt-2.5 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="flex-1">
            <p className="font-display text-[19px] font-bold leading-none text-ink">{format(grandTotal)}</p>
            <p className="mt-1 text-[10.5px] text-muted">{quote.nights} night{quote.nights === 1 ? "" : "s"} · fees included</p>
          </div>
          <Button size="lg" loading={paying} onClick={pay} className="min-w-[170px]">
            {paying ? "Processing…" : method === "card" ? "Pay securely" : "Confirm booking"}
          </Button>
        </div>
      </div>
    </div>
  );
}
