"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { formatDate, typeLabel } from "@josstay/shared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useAuth, useBooking, useCurrency, useToast } from "@/components/providers";
import { api } from "@/lib/api";
import { openPaystackInline } from "@/lib/paystackInline";
import { supportWhatsAppUrl } from "@/lib/contact";
import { EmptyState, ErrorState, LoadingResults } from "@/components/shared/states";

export function ConfirmationView() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const auth = useAuth();
  const { fetchBooking, initializePayment } = useBooking();
  const { toast } = useToast();
  const { format } = useCurrency();

  const bookingReference = typeof params.reference === "string" ? params.reference : Array.isArray(params.reference) ? params.reference[0] : "";
  const paymentRef = searchParams.get("reference") || searchParams.get("trxref") || "";

  const [booking, setBooking] = useState(null);
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    if (!bookingReference) return;
    if (auth.isLoading) return;
    if (!auth.isAuthenticated) {
      setLoading(false);
      setError("auth_required");
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    (async () => {
      try {
        if (paymentRef) {
          setVerifying(true);
          try {
            const verifyRes = await api.get(
              `/api/payments/paystack/verify?reference=${encodeURIComponent(paymentRef)}`,
              { cache: "no-store" },
            );
            const payment = verifyRes?.data?.payment;
            if (active && payment?.requiresRefund) {
              setPaymentNotice({
                tone: "warning",
                title: "Payment received — refund review required",
                description:
                  "Your payment was received by Paystack, but this booking could not be confirmed automatically. Support will review the charge and arrange a refund if needed. Keep your booking reference and payment reference handy.",
                reference: payment.reference,
              });
            }
          } catch {
            // Verification may be handled by webhook or retried; continue to load booking state.
          } finally {
            if (active) setVerifying(false);
          }
        }

        const data = await fetchBooking(bookingReference, { cache: "no-store" });
        if (!active) return;
        setBooking(data);

        const slug = data?.propertySlug;
        if (slug) {
          try {
            const propRes = await api.get(`/api/properties/${encodeURIComponent(slug)}`, { cache: "no-store" });
            if (active) setProperty(propRes?.data || null);
          } catch {
            if (active) setProperty(null);
          }
        }
      } catch (err) {
        if (!active) return;
        if (err?.status === 404) setError("not_found");
        else setError(err?.message || "Could not load booking");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [bookingReference, paymentRef, auth.isLoading, auth.isAuthenticated, fetchBooking]);

  const roomName = useMemo(() => {
    if (booking?.roomName) return booking.roomName;
    const room = property?.rooms?.find((r) => r.id === booking?.roomId) || property?.rooms?.[0];
    return room?.name || "Selected room";
  }, [booking, property]);

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `My JosStay booking ${bookingReference}`;
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

  const handleRetryPayment = async () => {
    if (!booking?.reference || retryingPayment) return;
    setRetryingPayment(true);
    try {
      const result = await initializePayment(booking.reference);
      const updatedBooking = result?.booking || booking;
      const payment = result?.payment;

      if (updatedBooking?.reference) setBooking(updatedBooking);

      const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";
      if (payment?.provider === "paystack" && payment?.reference) {
        if (paystackPublicKey) {
          const inlineResult = await openPaystackInline({
            key: paystackPublicKey,
            email: payment.email || updatedBooking?.guest?.email || booking.guest?.email,
            amountKobo: payment.amountKobo,
            amount: payment.amount ?? ((updatedBooking?.total ?? booking.total ?? 0) + (updatedBooking?.paymentFee ?? booking.paymentFee ?? 0)),
            reference: payment.reference,
            currency: payment.currency || updatedBooking?.currency || "NGN",
            method: updatedBooking?.paymentMethod || booking.paymentMethod || "card",
            metadata: {
              bookingReference: updatedBooking?.reference || booking.reference,
              custom_fields: [
                {
                  display_name: "Booking Reference",
                  variable_name: "booking_reference",
                  value: updatedBooking?.reference || booking.reference,
                },
              ],
            },
          });

          if (inlineResult?.status === "success") {
            const paidRef = inlineResult?.response?.reference || payment.reference;
            let verifyPayment = null;
            try {
              const verifyRes = await api.get(
                `/api/payments/paystack/verify?reference=${encodeURIComponent(paidRef)}`,
                { cache: "no-store" },
              );
              verifyPayment = verifyRes?.data?.payment || null;
            } catch {}
            const refreshed = await fetchBooking(booking.reference, { cache: "no-store" }).catch(() => null);
            if (refreshed) setBooking(refreshed);
            if (verifyPayment?.requiresRefund) {
              setPaymentNotice({
                tone: "warning",
                title: "Payment received — refund review required",
                description:
                  "Your payment was received, but the booking could not be confirmed automatically. Support will review the charge and arrange a refund if needed.",
                reference: paidRef,
              });
              toast("Payment received. Support review is required.", "info");
            } else {
              toast("Payment received. Confirming your booking…", "success");
            }
            router.replace(`/confirmation/${encodeURIComponent(booking.reference)}?reference=${encodeURIComponent(paidRef)}`);
            return;
          }

          toast("Payment was not completed. You can try again.", "info");
          return;
        }

        if (payment.authorizationUrl) {
          window.location.assign(payment.authorizationUrl);
          return;
        }
      }

      toast("Could not start payment for this booking", "error");
    } catch (err) {
      toast(err?.message || "Could not initialize payment", "error");
    } finally {
      setRetryingPayment(false);
    }
  };

  if (auth.isLoading || loading) {
    return (
      <div className="container-page max-w-2xl py-10">
        <LoadingResults count={2} />
        {verifying && <p className="mt-3 text-center text-[12px] text-muted">Confirming payment…</p>}
      </div>
    );
  }

  if (error === "auth_required" || (!auth.isAuthenticated && !booking)) {
    return (
      <div className="container-page max-w-2xl py-16">
        <EmptyState
          icon="calendar"
          title="Sign in to view this booking"
          description="For your security, booking details are available when you are signed in."
          actionLabel="Sign in"
          onAction={() => router.push("/account")}
        />
      </div>
    );
  }

  if (error === "not_found" || (!booking && error)) {
    return (
      <div className="container-page max-w-2xl py-16">
        {error === "not_found" ? (
          <EmptyState
            icon="alert"
            title="Booking not found"
            description="We couldn't find this booking. Check your bookings or contact support if you need help."
            actionLabel="View my bookings"
            onAction={() => router.push("/bookings")}
          />
        ) : (
          <ErrorState
            title="Could not load booking"
            description={error}
            onRetry={() => router.refresh()}
          />
        )}
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="container-page max-w-2xl py-16">
        <EmptyState
          icon="alert"
          title="Booking not found"
          description="We couldn't find this booking."
          actionLabel="View my bookings"
          onAction={() => router.push("/bookings")}
        />
      </div>
    );
  }

  const nights = Math.max(
    1,
    Math.round(
      (new Date(`${booking.checkOut}T12:00:00`) - new Date(`${booking.checkIn}T12:00:00`)) / 86400000,
    ),
  );

  const isPaid = booking.paymentStatus === "paid";
  const isFailedPayment = booking.paymentStatus === "failed";
  const isPendingPayment = !isPaid && ["pending", "initialized", "abandoned", undefined, null].includes(booking.paymentStatus) && booking.status !== "cancelled";
  const canRetryPayment = !isPaid && !["cancelled", "completed", "no_show"].includes(booking.status) && booking.paymentStatus !== "paid";
  const showRefundNotice = Boolean(paymentNotice?.requiresRefund || (paymentNotice && booking.status === "cancelled"));

  const rows = [
    { label: "Reference", value: booking.reference, mono: true },
    { label: "Guest", value: `${booking.guest?.firstName || ""} ${booking.guest?.lastName || ""}`.trim() || "Guest" },
    { label: "Stay", value: `${booking.propertyName || property?.name || "Stay"} · ${roomName}` },
    { label: "Dates", value: `${formatDate(booking.checkIn)} → ${formatDate(booking.checkOut)}` },
    { label: "Guests", value: `${booking.guests || 1} guest${(booking.guests || 1) === 1 ? "" : "s"} · ${nights} night${nights === 1 ? "" : "s"}` },
    { label: "Payment", value: booking.paymentMethod === "card" ? "Card" : booking.paymentMethod === "bank" ? "Bank transfer" : "USSD" },
  ];

  return (
    <div className="container-page max-w-4xl pb-16 pt-8 sm:pt-12">
      <div className="text-center">
        <span className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${isPaid ? "bg-gold-500 text-plum-900" : isFailedPayment ? "bg-red-100 text-red-700" : "bg-plum-100 text-plum-700"} animate-slide-up`}>
          <Icon name={isPaid ? "check" : isFailedPayment ? "x" : "clock"} className="h-7 w-7" strokeWidth={2.4} />
        </span>
        <span className="eyebrow mt-6">{isPaid ? "Booking confirmed" : isFailedPayment ? "Payment not completed" : "Booking created"}</span>
        <h1 className="mt-4 font-display text-[34px] font-bold leading-[1.02] tracking-tightest text-ink sm:text-[46px]">
          {isPaid ? "You\u2019re booked." : isFailedPayment ? "Payment was not completed." : "Almost there."}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[13.5px] leading-relaxed text-muted">
          {isPaid
            ? `Your booking details are available below${booking.guest?.email ? ` for ${booking.guest.email}` : ""}.`
            : isFailedPayment
              ? "Your booking was created but payment was not completed. You can try again to confirm your stay."
              : "Your booking was created. If you just completed payment, confirmation may take a moment to update."}
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

        {canRetryPayment && (
          <div className="mt-5 flex flex-col items-center gap-2">
            <Button onClick={handleRetryPayment} loading={retryingPayment} icon={retryingPayment ? undefined : "lock"} size="lg">
              {retryingPayment ? "Starting payment…" : isFailedPayment ? "Try payment again" : "Complete payment"}
            </Button>
            <p className="text-[11px] text-muted">Secure payment powered by Paystack. Your booking total is confirmed by the server.</p>
          </div>
        )}

        {paymentNotice && (
          <div className={`mx-auto mt-6 max-w-2xl rounded-xl border p-4 text-left ${showRefundNotice ? "border-amber-200 bg-amber-50" : "border-line bg-white"}`}>
            <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${showRefundNotice ? "text-amber-700" : "text-muted"}`}>{paymentNotice.title}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink">{paymentNotice.description}</p>
            {paymentNotice.reference ? (
              <p className="mt-2 text-[11px] text-muted">Payment reference: <span className="font-mono font-semibold text-ink">{paymentNotice.reference}</span></p>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-line bg-white shadow-card">
        <div className="flex gap-4 border-b border-line p-4 sm:p-5">
          {property?.images?.[0] ? (
            <img src={property.images[0]} alt={property.name || booking.propertyName || "Stay"} className="h-[76px] w-24 shrink-0 rounded-lg object-cover sm:h-24 sm:w-32" />
          ) : (
            <div className="h-[76px] w-24 shrink-0 rounded-lg bg-canvas sm:h-24 sm:w-32" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1.5">
              {property?.verified ? <Badge tone="verified" icon="shield">Verified</Badge> : null}
              {property?.type ? <Badge tone="neutral">{typeLabel(property.type)}</Badge> : null}
              {isPendingPayment ? <Badge tone="warning" icon="clock">Payment pending</Badge> : null}
              {isFailedPayment ? <Badge tone="danger" icon="x">Payment failed</Badge> : null}
            </div>
            <h2 className="mt-1.5 truncate font-display text-[17px] font-bold text-ink">{booking.propertyName || property?.name || "Stay"}</h2>
            <p className="text-[11.5px] text-muted">{[property?.area, "Jos"].filter(Boolean).join(", ")} · {roomName}</p>
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
              <p className="mt-1 text-[13px] font-medium text-ink">Airport pickup requested</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-canvas px-4 py-4 sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{isPaid ? "Total paid" : "Total"}</p>
            <p className="mt-1 font-display text-[22px] font-bold leading-none text-ink">{format((booking.total || 0) + (booking.paymentFee || 0))}</p>
            {booking.paymentFee > 0 ? (
              <p className="mt-1 text-[10.5px] text-muted">Stay {format(booking.total || 0)} + payment fee {format(booking.paymentFee)}</p>
            ) : null}
            <p className="mt-1 text-[10.5px] text-muted">Final amount confirmed by JosStay.</p>
          </div>
          {isPaid ? <Badge tone="success" icon="checkCircle">Paid</Badge> : isFailedPayment ? <Badge tone="danger" icon="x">Not paid</Badge> : <Badge tone="warning" icon="clock">Pending</Badge>}
        </div>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        <Button href="/bookings" variant="secondary" full>View bookings</Button>
        <Button href="/search" variant="gold" icon="search" full>Find another stay</Button>
        <Button variant="ghost" icon={copied ? "check" : "share"} onClick={share} full>{copied ? "Copied" : "Share"}</Button>
      </div>

      <div className="mt-5 rounded-xl border border-line bg-white p-5 sm:p-6">
        <h3 className="font-display text-[17px] font-bold text-ink">Need help?</h3>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">If you have questions about this booking or payment status, contact support with your booking reference.</p>
        <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
          <Icon name="whatsapp" className="h-4 w-4 text-emerald-600" />
          <a href={supportWhatsAppUrl(`Hi JosStay, I need help with booking ${booking.reference}.`)} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-emerald-700 underline underline-offset-4">Chat with support on WhatsApp</a>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[11px] text-muted">
        <Link href="/" className="font-semibold text-plum-700 underline decoration-plum-300 underline-offset-4">Back home</Link>
      </div>
    </div>
  );
}
