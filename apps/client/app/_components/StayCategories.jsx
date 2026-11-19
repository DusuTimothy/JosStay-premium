import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

const categories = [
  {
    id: "hotel",
    label: "Hotels",
    subtitle: "Full-service comfort",
    image:
      "https://images.pexels.com/photos/8135496/pexels-photo-8135496.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
  {
    id: "airbnb",
    label: "Airbnb stays",
    subtitle: "Unique local homes",
    image:
      "https://images.pexels.com/photos/6585598/pexels-photo-6585598.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
  {
    id: "shortlet",
    label: "Shortlets",
    subtitle: "Flexible local stays",
    image:
      "https://images.pexels.com/photos/7587828/pexels-photo-7587828.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
  {
    id: "guesthouse",
    label: "Guest houses",
    subtitle: "Warm & welcoming",
    image:
      "https://images.pexels.com/photos/30386991/pexels-photo-30386991.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
];

export function StayCategories() {
  return (
    <section className="container-page pt-14 sm:pt-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Find your fit</span>
          <h2 className="mt-4 font-display text-[32px] font-bold leading-none tracking-tightest text-ink sm:text-[40px]">
            Stay your way
          </h2>
        </div>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 text-[14px] font-semibold text-plum-700 transition hover:text-plum-900"
        >
          See all <Icon name="arrowRight" className="h-4 w-4" />
        </Link>
      </div>

      <div className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/search?type=${cat.id}`}
            className="group w-[78vw] shrink-0 snap-start overflow-hidden rounded-xl border border-line bg-white transition hover:border-plum-300 sm:w-auto"
          >
            <div className="aspect-[16/9] overflow-hidden">
              <img
                src={cat.image}
                alt={cat.label}
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-4">
              <div>
                <h3 className="font-display text-[19px] font-bold leading-none text-ink">
                  {cat.label}
                </h3>
                <p className="mt-1.5 text-[12px] text-muted">{cat.subtitle}</p>
              </div>
              <Icon
                name="arrowRight"
                className="h-4 w-4 shrink-0 text-plum-700 transition group-hover:translate-x-0.5"
              />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
