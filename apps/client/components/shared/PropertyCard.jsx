"use client";

import Link from "next/link";
import { useState } from "react";
import { amenityLabel, formatNaira, formatUsd, typeLabel } from "@josstay/shared";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { RatingStars } from "@/components/ui/RatingStars";
import { Icon } from "@/components/ui/Icon";
import { useCurrency, useToast } from "@/components/providers";

const typeEyebrow = {
  hotel: "Boutique hotel",
  apartment: "Serviced apartment",
  airbnb: "Entire home",
  shortlet: "Shortlet",
  guesthouse: "Guest house",
};

export function PropertyCard({ property, quote, layout = "grid", className = "" }) {
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();
  const { currency, format } = useCurrency();

  const toggleSaved = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSaved((s) => !s);
    toast(
      saved ? "Removed from your saved stays" : "Saved for later",
      saved ? "default" : "success"
    );
  };

  const eyebrow = `${typeEyebrow[property.type] || typeLabel(property.type)} · ${property.area}, Jos`;
  const priceLabel = currency === "USD" ? formatUsd(property.price) : formatNaira(property.price);
  const secondary =
    currency === "USD" ? `≈ ${formatNaira(property.price)}` : `≈ ${formatUsd(property.price)} USD`;

  const media = (
    <div
      className={`relative shrink-0 overflow-hidden rounded-lg bg-gray-100 ${
        layout === "row" ? "aspect-[16/10] w-full sm:h-[196px] sm:w-[292px]" : "aspect-[16/10] w-full"
      }`}
    >
      <img
        src={property.images[0]}
        alt={property.name}
        loading="lazy"
        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
      />
      <div className="absolute left-3 top-3">
        {property.verified ? (
          <VerifiedBadge className="bg-cream/95 shadow-sm" />
        ) : (
          <Badge tone="white">Unverified</Badge>
        )}
      </div>
      <button
        type="button"
        onClick={toggleSaved}
        aria-label={saved ? "Remove from saved" : "Save this stay"}
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-ink shadow-sm transition hover:bg-white"
      >
        <Icon
          name="heart"
          className={`h-[18px] w-[18px] ${saved ? "fill-plum-700 text-plum-700" : ""}`}
        />
      </button>
    </div>
  );

  const details = (
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-plum-600">
          {eyebrow}
        </p>
        <RatingStars
          rating={property.rating}
          count={property.reviewCount}
          className="shrink-0"
        />
      </div>

      <h3
        className={`mt-1.5 font-display font-bold tracking-tight text-ink ${
          layout === "row" ? "text-[21px] leading-tight" : "text-[19px] leading-snug"
        }`}
      >
        {property.name}
      </h3>

      <p className="mt-1 truncate text-[13px] text-muted">
        {property.amenities.slice(0, 3).map((id) => amenityLabel(id)).join(" · ")}
      </p>

      <div className={layout === "row" ? "mt-4" : "mt-3"}>
        <p className="text-[17px] font-bold text-ink">
          {priceLabel}
          <span className="ml-1.5 text-[13px] font-normal text-muted">/ night</span>
        </p>
        <p className="mt-0.5 text-[11.5px] text-muted">{secondary}</p>
        {quote && (
          <p className="mt-1 text-[11.5px] font-medium text-plum-700">
            {format(quote.total)} total · {quote.nights} night
            {quote.nights === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </div>
  );

  if (layout === "row") {
    return (
      <Link
        href={`/property/${property.slug}`}
        className={`group flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:gap-7 ${className}`}
      >
        {media}
        {details}
      </Link>
    );
  }

  return (
    <Link href={`/property/${property.slug}`} className={`group block ${className}`}>
      {media}
      <div className="mt-4">{details}</div>
    </Link>
  );
}
