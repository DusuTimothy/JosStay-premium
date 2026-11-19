import { Icon } from "@/components/ui/Icon";

export function RatingStars({
  rating = 0,
  count,
  size = "sm",
  showValue = true,
  mode = "compact",
  className = "",
}) {
  const rounded = Math.round(rating);

  if (mode === "stars") {
    const starSize =
      size === "lg" ? "h-4 w-4" : size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";
    return (
      <span className={`inline-flex items-center gap-0.5 text-gold-500 ${className}`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Icon
            key={n}
            name="star"
            className={`${starSize} ${n <= rounded ? "" : "text-gray-200"}`}
          />
        ))}
      </span>
    );
  }

  const iconSize = size === "lg" ? "h-4 w-4" : size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";

  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`}>
      <Icon name="star" className={`${iconSize} translate-y-[1px] text-gold-500`} />
      {showValue && (
        <span className="text-[13px] font-semibold leading-none text-ink">
          {Number(rating).toFixed(1)}
        </span>
      )}
      {typeof count === "number" && (
        <span className="text-[12px] leading-none text-muted">({count})</span>
      )}
    </span>
  );
}
