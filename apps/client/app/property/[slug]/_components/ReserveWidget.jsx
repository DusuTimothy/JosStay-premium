"use client";

import { formatDate } from "@josstay/shared";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useCurrency } from "@/components/providers";
import { GuestStepper } from "./GuestStepper";

export function ReserveWidget({ property, state, setState, quote, quoteLoading, onBook, onOpenDates }) {
  const { format, currency } = useCurrency();
  const nightly = quote?.nightly ?? property?.price ?? 0;
  const nights = quote?.nights ?? 0;
  const subtotal = quote?.subtotal ?? 0;
  const cleaning = quote?.cleaning ?? 0;
  const total = quote?.total ?? 0;

  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-card sm:p-6">
      <p className="font-display text-[24px] font-bold leading-none tracking-tight text-ink">
        {format(nightly)}
        <span className="ml-1.5 font-sans text-[13px] font-normal text-muted">/ night</span>
      </p>

      <div className="mt-5 overflow-hidden rounded-lg border border-line">
        <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
          <button type="button" onClick={onOpenDates} className="px-4 py-3 text-left transition hover:bg-plum-50/60">
            <span className="flex items-center justify-between gap-2">
              <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted">Check in</span>
              <Icon name="calendar" className="h-3.5 w-3.5 text-ink" />
            </span>
            <span className="mt-1.5 block text-[13px] font-semibold text-ink">{state.checkIn ? formatDate(state.checkIn) : "Add date"}</span>
          </button>
          <button type="button" onClick={onOpenDates} className="px-4 py-3 text-left transition hover:bg-plum-50/60">
            <span className="flex items-center justify-between gap-2">
              <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted">Check out</span>
              <Icon name="calendar" className="h-3.5 w-3.5 text-ink" />
            </span>
            <span className="mt-1.5 block text-[13px] font-semibold text-ink">{state.checkOut ? formatDate(state.checkOut) : "Add date"}</span>
          </button>
        </div>
        <div className="px-4 py-3">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted">Guests</span>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold text-ink">{state.guests} guest{state.guests === 1 ? "" : "s"}</span>
            <GuestStepper state={state} setState={setState} max={property.maxGuests} />
          </div>
        </div>
      </div>

      <Button onClick={onBook} full size="lg" iconRight="arrowRight" className="mt-4" disabled={quoteLoading}>
        {quoteLoading ? "Updating price…" : "Reserve your stay"}
      </Button>
      <p className="mt-2.5 text-center text-[11px] text-muted">You won&apos;t be charged yet</p>

      <div className="mt-5 space-y-2.5 border-t border-line pt-4 text-[13px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">{format(nightly)} × {nights} night{nights === 1 ? "" : "s"}</span>
          <span className="font-medium text-ink">{quoteLoading ? "…" : format(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">Cleaning fee</span>
          <span className="font-medium text-ink">{quoteLoading ? "…" : format(cleaning)}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
        <p className="text-[14px] font-bold text-ink">Total ({currency})</p>
        <p className="font-display text-[19px] font-bold text-ink">{quoteLoading ? "…" : format(total)}</p>
      </div>
    </div>
  );
}
