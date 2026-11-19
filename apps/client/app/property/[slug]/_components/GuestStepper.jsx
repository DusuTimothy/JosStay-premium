"use client";

import { Icon } from "@/components/ui/Icon";

export function GuestStepper({ state, setState, max }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setState((s) => ({ ...s, guests: Math.max(1, s.guests - 1) }))}
        disabled={state.guests <= 1}
        aria-label="Fewer guests"
        className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink transition hover:border-plum-300 disabled:opacity-40"
      >
        <Icon name="minus" className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setState((s) => ({ ...s, guests: Math.min(max, s.guests + 1) }))}
        disabled={state.guests >= max}
        aria-label="More guests"
        className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink transition hover:border-plum-300 disabled:opacity-40"
      >
        <Icon name="plus" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
