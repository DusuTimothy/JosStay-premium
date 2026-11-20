"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PropertyCard } from "@/components/shared/PropertyCard";
import { SkeletonCard } from "@/components/shared/states";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api";

const selectPopular = (list) =>
  [...(Array.isArray(list) ? list : [])]
    .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0) || (Number(b.reviewCount) || 0) - (Number(a.reviewCount) || 0))
    .slice(0, 3);

export function PopularStays() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get("/api/properties", { cache: "no-store" });
        const data = Array.isArray(res?.data) ? res.data : [];
        if (!active) return;
        setProperties(selectPopular(data));
      } catch {
        if (active) setProperties([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const popular = useMemo(() => selectPopular(properties), [properties]);

  return (
    <section className="container-page pt-14 sm:pt-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Loved by travellers</span>
          <h2 className="mt-4 font-display text-[32px] font-bold leading-none tracking-tightest text-ink sm:text-[40px]">
            Popular in Jos
          </h2>
        </div>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 text-[14px] font-semibold text-plum-700 transition hover:text-plum-900"
        >
          View all stays <Icon name="arrowRight" className="h-4 w-4" />
        </Link>
      </div>

      {loading && popular.length === 0 ? (
        <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : popular.length === 0 ? null : (
        <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {popular.map((property) => (
            <PropertyCard key={property.slug || property.id} property={property} />
          ))}
        </div>
      )}
    </section>
  );
}
