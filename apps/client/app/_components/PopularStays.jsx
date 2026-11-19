import Link from "next/link";
import { properties } from "@josstay/shared";
import { PropertyCard } from "@/components/shared/PropertyCard";
import { Icon } from "@/components/ui/Icon";

export function PopularStays() {
  const popular = [...properties]
    .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
    .slice(0, 3);

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

      <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {popular.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </section>
  );
}
