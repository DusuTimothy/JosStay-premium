"use client";

import { CalendarPicker } from "@/components/shared/CalendarPicker";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export function DateSheet({ open, onClose, state, setState, property }) {
  if (!open) return null;

  const apply = ({ checkIn, checkOut }) => {
    setState((s) => ({ ...s, checkIn, checkOut }));
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-ink/45 animate-fade-in"
        aria-label="Close date picker"
        onClick={onClose}
      />
      <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-float animate-slide-up sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="font-display text-xl font-bold text-ink">Availability</h3>
            <p className="mt-1 text-xs text-muted">
              Select your dates — your total updates instantly.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink"
            aria-label="Close"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <CalendarPicker
          checkIn={state.checkIn}
          checkOut={state.checkOut}
          onChange={apply}
          months={1}
          footer={false}
        />

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-[12px] text-muted">{property.name}</span>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}
