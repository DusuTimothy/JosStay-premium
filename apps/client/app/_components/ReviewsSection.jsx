import { HOME_REVIEWS } from "@josstay/shared";
import { ReviewCard } from "@/components/shared/ReviewCard";

export function ReviewsSection() {
  return (
    <section className="mt-16 bg-[#F3F3F2] py-14 sm:mt-24 sm:py-20">
      <div className="container-page">
        <span className="eyebrow">Travel with confidence</span>
        <h2 className="mt-4 font-display text-[32px] font-bold leading-none tracking-tightest text-ink sm:text-[40px]">
          What guests are saying
        </h2>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HOME_REVIEWS.map((review) => (
            <ReviewCard key={review.name} review={review} />
          ))}
        </div>
      </div>
    </section>
  );
}
