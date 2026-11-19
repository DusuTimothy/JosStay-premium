import Link from "next/link";
import { AREAS, properties } from "@josstay/shared";
import { Icon } from "@/components/ui/Icon";

const areaMeta = {
  "Jos North": {
    image:
      "https://images.pexels.com/photos/39344515/pexels-photo-39344515.jpeg?auto=compress&cs=tinysrgb&w=1200",
    blurb: "City energy & landmarks",
  },
  "Jos South": {
    image:
      "https://images.pexels.com/photos/7511695/pexels-photo-7511695.jpeg?auto=compress&cs=tinysrgb&w=1200",
    blurb: "Cool hills & quiet streets",
  },
  Rayfield: {
    image:
      "https://images.pexels.com/photos/6077368/pexels-photo-6077368.jpeg?auto=compress&cs=tinysrgb&w=1200",
    blurb: "Dining & premium stays",
  },
  Bukuru: {
    image:
      "https://images.pexels.com/photos/20604659/pexels-photo-20604659.jpeg?auto=compress&cs=tinysrgb&w=1200",
    blurb: "Local charm & great value",
  },
};

export function PopularAreas() {
  return (
    <section className="container-page pt-16 sm:pt-24">
      <span className="eyebrow">Explore the city</span>
      <h2 className="mt-4 font-display text-[32px] font-bold leading-none tracking-tightest text-ink sm:text-[40px]">
        Popular areas in Jos
      </h2>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {AREAS.map((area) => {
          const count = properties.filter((p) => p.area === area).length;
          const meta = areaMeta[area];
          return (
            <Link
              key={area}
              href={`/search?destination=${encodeURIComponent(area)}`}
              className="group relative aspect-[4/3] overflow-hidden rounded-lg lg:aspect-[4/3.4]"
            >
              <img
                src={meta.image}
                alt={`${area}, Jos`}
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-plum-900/90 via-plum-900/25 to-plum-900/10" />
              <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1.5 text-[10.5px] font-semibold text-ink">
                {count} stay{count === 1 ? "" : "s"}
              </span>
              <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-2 text-white">
                <div>
                  <h3 className="font-display text-[21px] font-bold leading-none">
                    {area}
                  </h3>
                  <p className="mt-1.5 text-[11.5px] text-white/75">{meta.blurb}</p>
                </div>
                <Icon
                  name="arrowRight"
                  className="mb-0.5 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5"
                />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
