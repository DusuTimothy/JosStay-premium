"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  amenityLabel,
  formatDate,
  properties,
  quoteStay,
  typeLabel,
} from "@josstay/shared";
import { SearchBar } from "@/components/shared/SearchBar";
import { PropertyCard } from "@/components/shared/PropertyCard";
import { FilterPanel, DEFAULT_FILTERS } from "@/components/shared/FilterPanel";
import { EmptyState, ErrorState, LoadingResults } from "@/components/shared/states";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

const SORTS = [
  { id: "recommended", label: "Recommended" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "rating", label: "Top rated" },
  { id: "distance", label: "Closest to airport" },
];

const TYPE_TABS = [
  { id: "", label: "All stays" },
  { id: "hotel", label: "Hotel" },
  { id: "airbnb", label: "Airbnb-style" },
  { id: "shortlet", label: "Shortlet" },
  { id: "guesthouse", label: "Guest house" },
  { id: "apartment", label: "Apartment" },
];

export function SearchView() {
  const router = useRouter();
  const params = useSearchParams();

  const [query, setQuery] = useState(() => ({
    destination: params.get("destination") || "",
    checkIn: params.get("checkIn") || "",
    checkOut: params.get("checkOut") || "",
    guests: Number(params.get("guests") || 2),
    type: params.get("type") || "",
  }));

  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_FILTERS,
    types: params.get("type") ? [params.get("type")] : [],
  }));
  const [sort, setSort] = useState("recommended");
  const [loading, setLoading] = useState(true);
  const [demoState, setDemoState] = useState("default");
  const [filterOpen, setFilterOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const filterKey = useMemo(
    () => JSON.stringify([filters, sort, query]),
    [filters, sort, query]
  );

  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => setLoading(false), 450);
    return () => window.clearTimeout(timer);
  }, [filterKey]);

  useEffect(() => {
    document.body.style.overflow = filterOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [filterOpen]);

  const results = useMemo(() => {
    const term = query.destination.trim().toLowerCase();

    const filtered = properties.filter((property) => {
      const matchesDestination =
        !term ||
        property.area.toLowerCase().includes(term) ||
        property.name.toLowerCase().includes(term) ||
        property.address.toLowerCase().includes(term);
      const matchesType =
        filters.types.length === 0 || filters.types.includes(property.type);
      const matchesPrice =
        property.price >= filters.minPrice && property.price <= filters.maxPrice;
      const matchesRating = property.rating >= filters.rating;
      const matchesAmenities = filters.amenities.every((a) =>
        property.amenities.includes(a)
      );
      const matchesDistance =
        !filters.maxDistance || property.distanceKm <= filters.maxDistance;
      const matchesCancellation =
        !filters.freeCancellation || property.freeCancellation;

      return (
        matchesDestination &&
        matchesType &&
        matchesPrice &&
        matchesRating &&
        matchesAmenities &&
        matchesDistance &&
        matchesCancellation
      );
    });

    const sorted = [...filtered];
    if (sort === "price-asc") sorted.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") sorted.sort((a, b) => b.price - a.price);
    if (sort === "rating") sorted.sort((a, b) => b.rating - a.rating);
    if (sort === "distance") sorted.sort((a, b) => a.distanceKm - b.distanceKm);
    if (sort === "recommended") {
      sorted.sort(
        (a, b) =>
          Number(b.verified) - Number(a.verified) ||
          b.rating - a.rating ||
          b.reviewCount - a.reviewCount
      );
    }
    return sorted;
  }, [filters, query.destination, sort]);

  const quoteFor = (property) => {
    if (!query.checkIn || !query.checkOut) return null;
    return quoteStay(property, query.checkIn, query.checkOut);
  };

  const updateQuery = (next) => {
    const merged = { ...query, ...next };
    setQuery(merged);
    if ("type" in next) {
      setFilters((f) => ({ ...f, types: next.type ? [next.type] : [] }));
    }
    const search = new URLSearchParams();
    if (merged.destination) search.set("destination", merged.destination);
    if (merged.checkIn) search.set("checkIn", merged.checkIn);
    if (merged.checkOut) search.set("checkOut", merged.checkOut);
    if (merged.guests) search.set("guests", String(merged.guests));
    if (merged.type) search.set("type", merged.type);
    router.replace(`/search${search.toString() ? `?${search.toString()}` : ""}`);
  };

  const resetAll = () => {
    setFilters({ ...DEFAULT_FILTERS });
    setSort("recommended");
    setDemoState("default");
  };

  const activeChips = [];
  filters.types.forEach((type) =>
    activeChips.push({
      key: `type-${type}`,
      label: typeLabel(type),
      clear: () =>
        setFilters((f) => ({ ...f, types: f.types.filter((t) => t !== type) })),
    })
  );
  filters.amenities.forEach((amenity) =>
    activeChips.push({
      key: `amenity-${amenity}`,
      label: amenityLabel(amenity),
      clear: () =>
        setFilters((f) => ({
          ...f,
          amenities: f.amenities.filter((a) => a !== amenity),
        })),
    })
  );
  if (filters.rating > 0) {
    activeChips.push({
      key: "rating",
      label: `${filters.rating}+ rating`,
      clear: () => setFilters((f) => ({ ...f, rating: 0 })),
    });
  }
  if (filters.maxDistance) {
    activeChips.push({
      key: "distance",
      label: `Within ${filters.maxDistance} km`,
      clear: () => setFilters((f) => ({ ...f, maxDistance: 0 })),
    });
  }
  if (filters.freeCancellation) {
    activeChips.push({
      key: "cancellation",
      label: "Free cancellation",
      clear: () => setFilters((f) => ({ ...f, freeCancellation: false })),
    });
  }
  if (query.destination) {
    activeChips.push({
      key: "destination",
      label: query.destination,
      clear: () => updateQuery({ destination: "" }),
    });
  }

  const showLoading = loading || demoState === "loading";
  const showError = demoState === "error";
  const showEmpty = demoState === "empty" || (!showLoading && results.length === 0);

  const resultsMeta = () => {
    const bits = [
      `${properties.length} sample properties`,
      query.checkIn && query.checkOut
        ? `${formatDate(query.checkIn, { year: undefined })} – ${formatDate(query.checkOut, { year: undefined })}`
        : "Any dates",
      "Prices include fees",
    ];
    return bits.join(" · ");
  };

  return (
    <div className="container-page pb-16 pt-6 sm:pt-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-[13px] text-muted transition hover:text-plum-700"
      >
        <Icon name="chevronLeft" className="h-4 w-4" />
        Back
      </Link>

      <div className="mt-6">
        <span className="eyebrow">Jos, Plateau State</span>
        <h1 className="mt-4 font-display text-[36px] font-bold leading-none tracking-tightest text-ink sm:text-[44px]">
          Stays in Jos
        </h1>
        <p className="mt-3 text-[13px] text-muted">{resultsMeta()}</p>
      </div>

      <div className="mt-6">
        <div className="hidden md:block">
          <SearchBar
            initial={query}
            onSubmit={updateQuery}
            submitLabel="Search stays"
            variant="compact"
          />
        </div>
        <div className="md:hidden">
          {editOpen ? (
            <SearchBar
              initial={query}
              onSubmit={(next) => {
                updateQuery(next);
                setEditOpen(false);
              }}
              submitLabel="Search stays"
              variant="compact"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex w-full items-center gap-3 rounded-xl border border-line bg-white p-3.5 text-left shadow-card"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-plum-50 text-plum-700">
                <Icon name="search" className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-ink">
                  {query.destination || "Jos, Plateau State"}
                </span>
                <span className="block truncate text-[11px] text-muted">
                  {query.checkIn && query.checkOut
                    ? `${formatDate(query.checkIn, { year: undefined })} → ${formatDate(query.checkOut, { year: undefined })}`
                    : "Any dates"}{" "}
                  · {query.guests} guest{query.guests === 1 ? "" : "s"}
                </span>
              </span>
              <span className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-plum-700">
                Edit
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {TYPE_TABS.map((tab) => {
            const active =
              tab.id === "" ? filters.types.length === 0 : filters.types.includes(tab.id);
            return (
              <button
                key={tab.id || "all"}
                type="button"
                onClick={() => {
                  setFilters((f) => ({ ...f, types: tab.id ? [tab.id] : [] }));
                  updateQuery({ type: tab.id });
                }}
                className={`chip shrink-0 ${active ? "chip-active" : "bg-white text-ink"}`}
                aria-pressed={active}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 hidden lg:block">
        <FilterPanel
          filters={filters}
          onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          onReset={resetAll}
        />
      </div>
      <div className="mt-4 lg:hidden">
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink"
        >
          <Icon name="sliders" className="h-4 w-4 text-plum-600" />
          Filters
          {activeChips.length > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-plum-700 px-1 text-[10px] text-white">
              {activeChips.length}
            </span>
          )}
        </button>
      </div>

      {activeChips.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="chip !border-plum-200 !bg-plum-50 !text-plum-700 !py-1.5 !text-[12px]"
            >
              {chip.label}
              <Icon name="x" className="h-3 w-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={resetAll}
            className="text-[12px] font-semibold text-muted underline underline-offset-4 hover:text-ink"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="text-[13px] text-muted">
          {showLoading ? (
            "Searching stays…"
          ) : (
            <>
              <strong className="font-semibold text-ink">{results.length}</strong> stay
              {results.length === 1 ? "" : "s"} match your filters
            </>
          )}
        </p>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          Sort
          <span className="relative inline-flex items-center">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="appearance-none bg-transparent pr-5 text-[13px] font-semibold text-ink outline-none"
              aria-label="Sort results"
            >
              {SORTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <Icon
              name="chevronDown"
              className="pointer-events-none absolute right-0 h-3.5 w-3.5 text-ink"
            />
          </span>
        </label>
      </div>

      <div className="mt-2">
        <div className="divide-y divide-line">
          {showError ? (
            <div className="pt-6">
              <ErrorState
                title="We couldn't load these stays"
                description="This is the demo error state. Your filters are safe — try again to reload the results."
                onRetry={() => setDemoState("default")}
              />
            </div>
          ) : showLoading ? (
            <div className="pt-6">
              <LoadingResults count={4} />
            </div>
          ) : showEmpty ? (
            <div className="pt-6">
              <EmptyState
                title="No stays match your search"
                description="Try removing an amenity, widening the price range, or searching another area of Jos."
                onAction={resetAll}
              />
            </div>
          ) : (
            results.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                quote={quoteFor(property)}
                layout="row"
              />
            ))
          )}
        </div>
      </div>

      <details className="mt-10 rounded-lg border border-line bg-white px-4 py-3 text-xs text-muted">
        <summary className="cursor-pointer font-semibold text-ink">
          Prototype states (for review)
        </summary>
        <p className="mt-2">Preview the required loading, empty, and error states.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { id: "default", label: "Results" },
            { id: "loading", label: "Loading" },
            { id: "empty", label: "Empty" },
            { id: "error", label: "Error" },
          ].map((state) => (
            <button
              key={state.id}
              type="button"
              onClick={() => setDemoState(state.id)}
              className={`chip !py-1.5 !text-[12px] ${demoState === state.id ? "chip-active" : ""}`}
            >
              {state.label}
            </button>
          ))}
        </div>
      </details>

      {filterOpen && (
        <div className="fixed inset-0 z-[75] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/45 animate-fade-in"
            aria-label="Close filters"
            onClick={() => setFilterOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-float animate-slide-up">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-ink">Filters</h3>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full border border-line"
                aria-label="Close"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
            <FilterPanel
              filters={filters}
              onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
              onReset={resetAll}
            />
            <div className="sticky bottom-0 mt-5 grid grid-cols-2 gap-2 border-t border-line bg-white py-3">
              <Button variant="secondary" onClick={resetAll}>
                Reset
              </Button>
              <Button onClick={() => setFilterOpen(false)}>
                Show {results.length} stays
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
