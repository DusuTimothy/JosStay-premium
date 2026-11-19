"use client";

import { useMemo, useState } from "react";
import { formatDate, nightsBetween, toIso } from "@josstay/shared";
import { Icon } from "@/components/ui/Icon";

const startOfMonth = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

const addMonths = (date, n) => new Date(date.getFullYear(), date.getMonth() + n, 1);

const monthDays = (monthDate) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
  const total = new Date(year, month + 1, 0).getDate();
  const lead = (firstDay + 6) % 7; // Monday-first
  const days = [];
  for (let i = 0; i < lead; i += 1) days.push(null);
  for (let d = 1; d <= total; d += 1) {
    days.push(
      `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    );
  }
  return days;
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function Month({ monthDate, checkIn, checkOut, onPick, today, blocked }) {
  const days = useMemo(() => monthDays(monthDate), [monthDate]);
  const label = monthDate.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex-1">
      <p className="mb-4 text-center font-display text-[17px] font-bold text-ink">
        {label}
      </p>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((d, i) => (
          <span
            key={`${d}-${i}`}
            className="pb-2 text-[11px] font-medium text-muted"
          >
            {d}
          </span>
        ))}
        {days.map((iso, i) => {
          if (!iso) return <span key={`empty-${i}`} />;
          const disabled = iso < today || blocked.includes(iso);
          const isStart = iso === checkIn;
          const isEnd = iso === checkOut;
          const inRange = checkIn && checkOut && iso > checkIn && iso < checkOut;
          const selected = isStart || isEnd || inRange;
          const dayNumber = Number(iso.slice(-2));

          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onPick(iso)}
              className={`mx-auto grid h-10 w-10 place-items-center rounded-full text-[13px] font-medium transition ${
                selected
                  ? "bg-plum-700 text-white"
                  : disabled
                    ? "cursor-not-allowed text-gray-300"
                    : "text-ink hover:bg-plum-50 hover:text-plum-700"
              } ${isStart || isEnd ? "ring-2 ring-plum-700 ring-offset-2" : ""}`}
              aria-label={formatDate(iso)}
              aria-pressed={selected}
            >
              {dayNumber}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarPicker({
  checkIn,
  checkOut,
  onChange,
  months = 2,
  blockedDates = [],
  footer = true,
}) {
  const today = toIso(new Date());
  const [cursor, setCursor] = useState(() => startOfMonth(checkIn || today));

  const pick = (iso) => {
    if (!checkIn || (checkIn && checkOut)) {
      onChange({ checkIn: iso, checkOut: "" });
      return;
    }
    if (iso <= checkIn) {
      onChange({ checkIn: iso, checkOut: "" });
      return;
    }
    onChange({ checkIn, checkOut: iso });
  };

  const nights = nightsBetween(checkIn, checkOut);
  const canGoBack = cursor > startOfMonth(today);
  const visibleMonths = Array.from({ length: months }, (_, i) => addMonths(cursor, i));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => canGoBack && setCursor((c) => addMonths(c, -1))}
          disabled={!canGoBack}
          className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink transition hover:border-plum-300 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous month"
        >
          <Icon name="chevronLeft" className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-plum-700" /> Selected
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full border border-line" /> Available
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, 1))}
          className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink transition hover:border-plum-300"
          aria-label="Next month"
        >
          <Icon name="chevronRight" className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-8">
        {visibleMonths.map((month, index) => (
          <div
            key={month.toISOString()}
            className={index > 0 ? "hidden flex-1 sm:block" : "flex-1"}
          >
            <Month
              monthDate={month}
              checkIn={checkIn}
              checkOut={checkOut}
              onPick={pick}
              today={today}
              blocked={blockedDates}
            />
          </div>
        ))}
      </div>

      {footer && (
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs">
          <span className="text-muted">
            {checkIn && checkOut
              ? `${nights} night${nights === 1 ? "" : "s"} selected`
              : checkIn
                ? "Now choose your check-out date"
                : "Choose your check-in date"}
          </span>
          <span className="font-semibold text-ink">
            {checkIn ? formatDate(checkIn, { year: undefined }) : "—"}
            {checkOut ? ` → ${formatDate(checkOut, { year: undefined })}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
