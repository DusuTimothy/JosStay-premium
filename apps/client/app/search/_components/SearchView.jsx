"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { amenityLabel, formatDate, quoteStay, typeLabel } from "@josstay/shared";
import { SearchBar } from "@/components/shared/SearchBar";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { PropertyCard } from "@/components/shared/PropertyCard";
import { FilterPanel, DEFAULT_FILTERS } from "@/components/shared/FilterPanel";
import { EmptyState, ErrorState, LoadingResults } from "@/components/shared/states";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api";

const SearchMap = dynamic(() => import("./SearchMap").then((mod) => mod.SearchMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] w-full items-center justify-center rounded-xl border border-line bg-[#E8EDE6] text-[12px] font-medium text-muted">
      Loading map…
    </div>
  ),
});

const SORTS = [
  { value: "recommended", label: "Recommended", hint: "Best match for your filters" },
  { value: "price-asc", label: "Price: low to high", hint: "Budget-friendly stays first" },
  { value: "price-desc", label: "Price: high to low", hint: "Premium stays first" },
  { value: "rating", label: "Top rated", hint: "Highest guest ratings" },
  { value: "distance", label: "Closest to airport", hint: "Shortest transfer time" },
];

const TYPE_TABS = [
  { id: "", label: "All stays" },
  { id: "hotel", label: "Hotel" },
  { id: "airbnb", label: "Airbnb-style" },
  { id: "shortlet", label: "Shortlet" },
  { id: "guesthouse", label: "Guest house" },
  { id: "apartment", label: "Apartment" },
];

const toPositiveInt = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

export function SearchView() {
  const router = useRouter();
  const params = useSearchParams();

  const [query, setQuery] = useState(() => ({
    destination: params.get("destination") || "",
    checkIn: params.get("checkIn") || "",
    checkOut: params.get("checkOut") || "",
    guests: toPositiveInt(params.get("guests"), 2),
    type: params.get("type") || "",
  }));

  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_FILTERS,
    types: params.get("type") ? [params.get("type")] : [],
  }));
  const [sort, setSort] = useState("recommended");
  const [results, setResults] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [serverQuotes, setServerQuotes] = useState({});
  const [view, setView] = useState("list");
  const [filterOpen, setFilterOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = filterOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [filterOpen]);

  const requestParams = useMemo(() => {
    const selectedType = query.type || filters.types[0] || "";
    const search = new URLSearchParams();
    const destination = query.destination.trim();

    if (destination) search.set("destination", destination);
    if (selectedType) search.set("type", selectedType);
    if (Number(filters.minPrice) > 0) search.set("minPrice", String(filters.minPrice));
    if (Number(filters.maxPrice) > 0) search.set("maxPrice", String(filters.maxPrice));
    if (Number(filters.rating) > 0) search.set("rating", String(filters.rating));
    if (Array.isArray(filters.amenities) && filters.amenities.length) {
      search.set("amenities", filters.amenities.join(","));
    }
    if (filters.freeCancellation) search.set("freeCancellation", "true");
    if (Number(filters.maxDistance) > 0) search.set("maxDistance", String(filters.maxDistance));
    if (sort) search.set("sort", sort);

    return search;
  }, [filters, query.destination, query.type, sort]);

  const requestKey = requestParams.toString();

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");

    const timer = window.setTimeout(async () => {
      try {
        const path = `/api/properties${requestKey ? `?${requestKey}` : ""}`;
        const res = await api.get(path, { signal: controller.signal, cache: "no-store" });
        if (!active) return;
        const data = Array.isArray(res?.data) ? res.data : [];
        setResults(data);
        setCount(Number.isFinite(res?.count) ? res.count : data.length);
      } catch (err) {
        if (!active || err?.code === "REQUEST_ABORTED" || err?.name === "AbortError") return;
        setResults([]);
        setCount(0);
        setError(err?.message || "Failed to load properties");
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [requestKey, reloadKey]);

  useEffect(() => {
    if (!query.checkIn || !query.checkOut || !Array.isArray(all) || all.length === 0) {
      setServerQuotes({});
      return;
    }
    let active = true;
    const targets = all.slice(0, 24);
    (async () => {
      const entries = await Promise.all(targets.map(async (property) => {
        try {
          const qs = new URLSearchParams({ checkIn: query.checkIn, checkOut: query.checkOut, guests: String(query.guests || 1) });
          const res = await api.get(`/api/properties/${encodeURIComponent(property.slug)}/quote?${qs.toString()}`, { cache: "no-store" });
          return [property.slug, res?.data?.quote || null];
        } catch {
          return [property.slug, null];
        }
      }));
      if (!active) return;
      const map = {};
      for (const [slug, q] of entries) if (slug && q) map[slug] = q;
      setServerQuotes(map);
    })();
    return () => { active = false; };
  }, [all, query.checkIn, query.checkOut, query.guests]);

  const quoteFor = useCallback(
    (property) => {
      if (!query.checkIn || !query.checkOut) return null;
      return serverQuotes[property.slug] || quoteStay(property, query.checkIn, query.checkOut);
    },
    [query.checkIn, query.checkOut, serverQuotes],
  );

  const updateQuery = (next) => {
    const merged = { ...query, ...next };
    if ("type" in next) {
      merged.type = next.type || "";
    }
    merged.guests = toPositiveInt(merged.guests, 2);
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
  };

  const activeChips = [];
  (filters.types[0] ? [filters.types[0]] : []).forEach((type) =>
    activeChips.push({
      key: `type-${type}`,
      label: typeLabel(type),
      clear: () => {
        setFilters((f) => ({ ...f, types: [] }));
        updateQuery({ type: "" });
      },
    }),
  );
  (filters.amenities || []).forEach((amenity) =>
    activeChips.push({
      key: `amenity-${amenity}`,
      label: amenityLabel(amenity),
      clear: () =>
        setFilters((f) => ({
          ...f,
          amenities: f.amenities.filter((a) => a !== amenity),
        })),
    }),
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

  const showEmpty = !loading && !error && results.length === 0;
  const resultCount = loading ? 0 : (count || results.length);

  const resultsMeta = () => {
    const bits = [
      query.checkIn && query.checkOut
        ? `${formatDate(query.checkIn, { year: undefined })} – ${formatDate(query.checkOut, { year: undefined })}`
        : "Any dates",
      `${query.guests} guest${query.guests === 1 ? "" : "s"}`,
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
        <div className="no-scrollbar -mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-1">
          {TYPE_TABS.map((tab) => {
            const active =
              tab.id === "" ? !filters.types[0] && !query.type : (filters.types[0] === tab.id || query.type === tab.id);
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

        <button
          type="button"
          onClick={() => setView(view === "map" ? "list" : "map")}
          className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-semibold transition ${
            view === "map"
              ? "border-plum-700 bg-plum-700 text-white"
              : "border-line bg-white text-ink hover:border-plum-300"
          }`}
          aria-pressed={view === "map"}
        >
          <Icon name={view === "map" ? "grid" : "pin"} className="h-4 w-4" />
          {view === "map" ? "List view" : "Map view"}
        </button>
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
          {loading ? (
            "Searching stays…"
          ) : error ? (
            "Unable to load stays"
          ) : (
            <>
              <strong className="font-semibold text-ink">{resultCount}</strong> stay
              {resultCount === 1 ? "" : "s"} match your filters
            </>
          )}
        </p>
        <SearchSelect
          variant="inline"
          icon="sliders"
          label="Sort by"
          value={sort}
          onChange={setSort}
          options={SORTS}
          panelTitle="Sort stays"
          ariaLabel="Sort results"
        />
      </div>

      <div
        className={
          view === "map" && !loading && !showEmpty && !error
            ? "mt-2 grid gap-6 lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_480px]"
            : "mt-2"
        }
      >
        <div className={`divide-y divide-line ${view === "map" ? "order-2 lg:order-1" : ""}`}>
          {error ? (
            <div className="pt-6">
              <ErrorState
                title="We couldn't load these stays"
                description={error}
                onRetry={() => setReloadKey((k) => k + 1)}
              />
            </div>
          ) : loading ? (
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
                key={property.id || property.slug}
                property={property}
                quote={quoteFor(property)}
                layout="row"
              />
            ))
          )}
        </div>

        {view === "map" && !loading && !showEmpty && !error && (
          <div className="order-1 h-[420px] lg:order-2 lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
            <SearchMap properties={results} />
          </div>
        )}
      </div>

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
                Show {resultCount} stays
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
