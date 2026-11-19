import { HomeHero } from "./_components/HomeHero";
import { StayCategories } from "./_components/StayCategories";
import { PopularStays } from "./_components/PopularStays";
import { PopularAreas } from "./_components/PopularAreas";
import { PromiseSection } from "./_components/PromiseSection";
import { ReviewsSection } from "./_components/ReviewsSection";
import { FlightCta } from "./_components/FlightCta";
import { HostCta } from "./_components/HostCta";

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <StayCategories />
      <PopularStays />
      <PopularAreas />
      <PromiseSection />
      <ReviewsSection />
      <FlightCta />
      <HostCta />
    </>
  );
}
