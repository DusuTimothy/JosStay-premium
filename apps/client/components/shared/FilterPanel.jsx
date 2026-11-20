"use client";

import { AMENITIES } from "@josstay/shared";
import { Icon } from "@/components/ui/Icon";
import { SearchSelect } from "@/components/shared/SearchSelect";

const RATINGS = [
  { value: 0, label: "Any rating" },
  { value: 4, label: "4.0+" },
  { value: 4.5, label: "4.5+" },
  { value: 4.8, label: "4.8+" },
];

const DISTANCES = [
  { value: 0, label: "Any distance" },
  { value: 10, label: "Within 10 km" },
  { value: 15, label: "Within 15 km" },
  { value: 20, label: "Within 20 km" },
  { value: 30, label: "Within 30 km" },
];

export const DEFAULT_FILTERS = {
  minPrice: 0,
  maxPrice: 150000,
  types: [],
  rating: 0,
  amenities: [],
  maxDistance: 0,
  freeCancellation: false,
  sort: "recommended",
};

export function FilterPanel({ filters, onChange, onReset, compact = false }) {
  const toggleAmenity = (value) => {
    const current = filters.amenities || [];
    onChange({
      amenities: current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    });
  };

  return (
    <div>
      <div className="grid divide-y divide-line rounded-xl border border-line bg-white sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-[1.4fr_1fr_1fr_0.9fr]">
        {/* Price */}
        <div className="px-5 py-4 transition-colors hover:bg-canvas/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Price up to</span>
            <span className="text-[13px] font-bold text-ink">
              ₦{Number(filters.maxPrice).toLocaleString("en-NG")}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={150000}
            step={2500}
            value={filters.maxPrice}
            onChange={(e) => onChange({ maxPrice: Number(e.target.value) })}
            className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-plum-700 accent-plum-700"
            aria-label="Maximum price per night"
          />
          <div className="mt-1.5 flex justify-between text-[10px] text-muted">
            <span>₦0</span>
            <span>₦150,000</span>
          </div>
        </div>

        {/* Rating */}
        <div className="px-5 py-4 transition-colors hover:bg-canvas/30">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Minimum rating</span>
          <div className="mt-1.5">
            <SearchSelect
              variant="filter"
              icon="star"
              label="Minimum rating"
              panelTitle="Minimum rating"
              ariaLabel="Minimum rating"
              value={filters.rating}
              onChange={(value) => onChange({ rating: Number(value) })}
              options={RATINGS.map((r) => ({ value: r.value, label: r.label }))}
            />
          </div>
        </div>

        {/* Distance */}
        <div className="px-5 py-4 transition-colors hover:bg-canvas/30">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">From airport</span>
          <div className="mt-1.5">
            <SearchSelect
              variant="filter"
              icon="pin"
              label="Distance from airport"
              panelTitle="Distance from airport"
              ariaLabel="Distance from airport"
              value={filters.maxDistance}
              onChange={(value) => onChange({ maxDistance: Number(value) })}
              options={DISTANCES.map((d) => ({ value: d.value, label: d.label }))}
            />
          </div>
        </div>

        {/* Cancellation */}
        <div className="px-5 py-4">
          <label className="flex h-full cursor-pointer items-center gap-2.5">
            <span
              className={`grid h-[18px] w-[18px] place-items-center rounded border transition ${
                filters.freeCancellation
                  ? "border-plum-700 bg-plum-700 text-white"
                  : "border-line bg-white"
              }`}
            >
              {filters.freeCancellation && (
                <Icon name="check" className="h-3 w-3" strokeWidth={2.5} />
              )}
            </span>
            <input
              type="checkbox"
              checked={filters.freeCancellation}
              onChange={(e) => onChange({ freeCancellation: e.target.checked })}
              className="sr-only"
            />
            <span className="text-[13px] font-medium text-ink">Free cancellation</span>
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[12px] font-semibold text-ink">Amenities</span>
        {AMENITIES.map((amenity) => {
          const active = filters.amenities.includes(amenity.id);
          return (
            <button
              key={amenity.id}
              type="button"
              onClick={() => toggleAmenity(amenity.id)}
              className={`chip !px-3.5 !py-1.5 !text-[12px] ${
                active ? "chip-active" : ""
              }`}
              aria-pressed={active}
            >
              {amenity.label}
            </button>
          );
        })}
        {(filters.amenities.length > 0 ||
          filters.rating > 0 ||
          filters.maxDistance > 0 ||
          filters.freeCancellation ||
          filters.maxPrice < 150000) && (
          <button
            type="button"
            onClick={onReset}
            className="ml-1 text-[12px] font-semibold text-plum-700 underline underline-offset-4"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
