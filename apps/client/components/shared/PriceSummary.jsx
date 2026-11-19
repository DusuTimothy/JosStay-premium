"use client";

import { formatDate } from "@josstay/shared";
import { useCurrency } from "@/components/providers";
import { Icon } from "@/components/ui/Icon";

export function PriceSummary({
  quote,
  checkIn,
  checkOut,
  pickup = false,
  bundle = false,
  flight = null,
  className = "",
  compact = false,
}) {
  const { format, currency } = useCurrency();
  if (!quote) return null;

  const flightTotal = flight?.flightTotal || 0;
  const rows = [];

  if (flight) {
    rows.push({
      label: `Flights (${flight.passengers} × ${format(flight.fare)})`,
      value: format(flightTotal),
    });
  }

  rows.push(
    {
      label: `${format(quote.nightly)} × ${quote.nights} night${quote.nights === 1 ? "" : "s"}`,
      value: format(quote.subtotal),
    },
    { label: "Cleaning fee", value: format(quote.cleaning) },
    { label: "Service fee", value: format(quote.service) }
  );

  if (pickup && quote.pickup) {
    rows.push({ label: "Airport pickup", value: format(quote.pickup) });
  }
  if (bundle && quote.discount) {
    rows.push({
      label: "Flight + stay discount",
      value: `−${format(quote.discount)}`,
      discount: true,
    });
  }

  return (
    <div className={className}>
      {!compact && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">Price details</h3>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              <Icon name="checkCircle" className="h-3.5 w-3.5" /> No hidden fees
            </span>
          </div>
          {checkIn && checkOut && (
            <p className="mt-1 text-xs text-muted">
              {formatDate(checkIn, { year: undefined })} → {formatDate(checkOut)}
            </p>
          )}
        </>
      )}

      <div className={`${compact ? "" : "mt-4"} space-y-2.5 text-[13px]`}>
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-muted">{row.label}</span>
            <span
              className={`font-medium ${row.discount ? "text-emerald-700" : "text-ink"}`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <p className="text-[15px] font-bold text-ink">Total ({currency})</p>
        <p className="text-[17px] font-bold text-ink">
          {format(quote.total + flightTotal)}
        </p>
      </div>

      {!compact && (
        <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-[11px] leading-relaxed text-ink/70">
          <strong className="font-semibold text-ink">Free cancellation</strong> until 48
          hours before check-in on eligible stays. Pay securely with Paystack.
        </p>
      )}
    </div>
  );
}
