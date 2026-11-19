"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AREAS, PROPERTY_TYPES, formatDate } from "@josstay/shared";
import { CalendarPicker } from "@/components/shared/CalendarPicker";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { Icon } from "@/components/ui/Icon";

const destinationOptions = [
  { value: "", label: "Jos, Plateau State", hint: "All areas" },
  ...AREAS.map((area) => ({ value: area, label: `${area}, Jos`, hint: "Plateau State" })),
];

const guestOptions = Array.from({ length: 8 }, (_, index) => {
  const count = index + 1;
  return {
    value: count,
    label: `${count} guest${count === 1 ? "" : "s"}`,
    hint:
      count === 1 ? "Solo traveller" : count === 2 ? "Couple" : count <= 4 ? "Family" : "Group",
  };
});

const typeHints = {
  hotel: "Full-service comfort",
  apartment: "Entire home",
  airbnb: "Unique local homes",
  shortlet: "Flexible stays",
  guesthouse: "Warm & welcoming",
};

const typeOptions = [
  { value: "", label: "Any stay type", hint: "Show everything" },
  ...PROPERTY_TYPES.map((type) => ({
    value: type.id,
    label: type.label,
    hint: typeHints[type.id],
  })),
];

export function SearchBar({
  initial = {},
  onSubmit,
  submitLabel = "Search stays",
  variant = "hero",
}) {
  const router = useRouter();
  const [destination, setDestination] = useState(initial.destination || "");
  const [checkIn, setCheckIn] = useState(initial.checkIn || "");
  const [checkOut, setCheckOut] = useState(initial.checkOut || "");
  const [guests, setGuests] = useState(initial.guests || 2);
  const [type, setType] = useState(initial.type || "");
  const [dateOpen, setDateOpen] = useState(false);
  const [tempDates, setTempDates] = useState({ checkIn, checkOut });

  useEffect(() => {
    if (dateOpen) setTempDates({ checkIn, checkOut });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateOpen]);

  useEffect(() => {
    document.body.style.overflow = dateOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [dateOpen]);

  const applyDates = () => {
    setCheckIn(tempDates.checkIn);
    setCheckOut(tempDates.checkOut);
    setDateOpen(false);
  };

  const submit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (destination) params.set("destination", destination);
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    if (guests) params.set("guests", String(guests));
    if (type) params.set("type", type);

    if (onSubmit) {
      onSubmit({ destination, checkIn, checkOut, guests, type });
      return;
    }
    router.push(`/search${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <>
      <form
        onSubmit={submit}
        className={`grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-line sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.05fr_auto] lg:items-stretch lg:gap-0 lg:bg-white ${
          variant === "compact"
            ? "border border-line shadow-card"
            : "rounded-2xl border border-white/70 shadow-[0_28px_70px_-24px_rgba(10,5,20,.72)] ring-1 ring-black/5"
        }`}
      >
        {/* Where */}
        <SearchSelect
          icon="pin"
          label="Where"
          value={destination}
          onChange={setDestination}
          options={destinationOptions}
          placeholder="Jos, Plateau State"
          ariaLabel="Where"
          panelTitle="Destination"
        />

        {/* Check in */}
        <button
          type="button"
          onClick={() => setDateOpen(true)}
          className="flex items-center gap-3 border-t border-line bg-white px-4 py-3 text-left sm:border-t-0 lg:border-l lg:border-line lg:px-5"
        >
          <Icon name="calendar" className="h-5 w-5 shrink-0 text-plum-600" />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              Check in
            </span>
            <span className="block truncate text-[15px] font-semibold text-ink">
              {checkIn ? formatDate(checkIn, { year: undefined }) : "Add date"}
            </span>
          </span>
        </button>

        {/* Check out */}
        <button
          type="button"
          onClick={() => setDateOpen(true)}
          className="flex items-center gap-3 border-t border-line bg-white px-4 py-3 text-left sm:border-t-0 lg:border-l lg:border-line lg:px-5"
        >
          <Icon name="calendar" className="h-5 w-5 shrink-0 text-plum-600" />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              Check out
            </span>
            <span className="block truncate text-[15px] font-semibold text-ink">
              {checkOut ? formatDate(checkOut, { year: undefined }) : "Add date"}
            </span>
          </span>
        </button>

        {/* Guests */}
        <SearchSelect
          icon="users"
          label="Guests"
          value={guests}
          onChange={setGuests}
          options={guestOptions}
          ariaLabel="Guests"
          panelTitle="Who's coming?"
          className="border-t border-line sm:border-t-0 lg:border-l lg:border-line"
        />

        {/* Stay type */}
        <SearchSelect
          icon="bed"
          label="Stay type"
          value={type}
          onChange={setType}
          options={typeOptions}
          ariaLabel="Stay type"
          panelTitle="Stay type"
          className="border-t border-line sm:border-t-0 lg:border-l lg:border-line"
        />

        <div className="bg-white p-2 lg:w-[190px] lg:shrink-0">
          <button
            type="submit"
            className={`inline-flex h-full min-h-[52px] w-full items-center justify-center gap-2 rounded-lg px-5 text-[15px] font-bold text-[#241405] transition ${
              variant === "compact"
                ? "bg-gold-500 hover:bg-gold-400"
                : "bg-[linear-gradient(135deg,#FFD66B_0%,#F6C453_55%,#E8AF3C_100%)] shadow-[0_10px_24px_-10px_rgba(246,196,83,.85)] hover:brightness-105 active:scale-[0.99]"
            }`}
          >
            <Icon name="search" className="h-4 w-4" strokeWidth={2.2} />
            {submitLabel}
          </button>
        </div>
      </form>

      {dateOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-ink/45 animate-fade-in"
            aria-label="Close date picker"
            onClick={() => setDateOpen(false)}
          />
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-float animate-slide-up sm:rounded-2xl sm:p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-display text-xl font-bold text-ink">
                  Select your dates
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Prices update automatically with the length of your stay.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDateOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink"
                aria-label="Close"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>

            <CalendarPicker
              checkIn={tempDates.checkIn}
              checkOut={tempDates.checkOut}
              onChange={setTempDates}
            />

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setTempDates({ checkIn: "", checkOut: "" })}
                className="text-xs font-semibold text-muted underline underline-offset-4 hover:text-ink"
              >
                Clear dates
              </button>
              <button
                type="button"
                onClick={applyDates}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-gold-500 px-5 text-sm font-bold text-ink transition hover:bg-gold-400"
              >
                Apply dates
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
