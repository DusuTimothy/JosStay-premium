import { RatingStars } from "@/components/ui/RatingStars";

const avatarTones = [
  "bg-plum-100 text-plum-700",
  "bg-gold-100 text-gold-700",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
];

export function ReviewCard({ review, className = "" }) {
  const initials = review.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
  const tone = avatarTones[review.name.charCodeAt(0) % avatarTones.length];

  return (
    <article className={`rounded-xl border border-line bg-white p-6 ${className}`}>
      <RatingStars rating={review.rating || 5} mode="stars" size="md" />
      <p className="mt-4 text-[15px] leading-relaxed text-ink/85">
        “{review.quote}”
      </p>
      <div className="mt-6 flex items-center gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${tone}`}
        >
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold text-ink">{review.name}</p>
          <p className="text-[11px] text-muted">
            {review.location ? `${review.location} · ` : ""}Verified stay
          </p>
        </div>
      </div>
    </article>
  );
}
