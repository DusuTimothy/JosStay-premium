import { getProperty, properties } from "@josstay/shared";

export const listProperties = (req, res) => {
  const {
    destination = "",
    type = "",
    minPrice = "0",
    maxPrice = "999999",
    rating = "0",
    amenities = "",
    freeCancellation = "false",
    maxDistance = "0",
    sort = "recommended",
  } = req.query;

  const term = String(destination).trim().toLowerCase();
  const amenityList = String(amenities)
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  let results = properties.filter((property) => {
    const matchesDestination =
      !term ||
      property.area.toLowerCase().includes(term) ||
      property.name.toLowerCase().includes(term) ||
      property.address.toLowerCase().includes(term);
    const matchesType = !type || property.type === type;
    const matchesPrice =
      property.price >= Number(minPrice) && property.price <= Number(maxPrice);
    const matchesRating = property.rating >= Number(rating);
    const matchesAmenities = amenityList.every((a) =>
      property.amenities.includes(a)
    );
    const matchesCancellation =
      String(freeCancellation) !== "true" || property.freeCancellation;
    const matchesDistance =
      Number(maxDistance) === 0 || property.distanceKm <= Number(maxDistance);

    return (
      matchesDestination &&
      matchesType &&
      matchesPrice &&
      matchesRating &&
      matchesAmenities &&
      matchesCancellation &&
      matchesDistance
    );
  });

  const sorters = {
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    rating: (a, b) => b.rating - a.rating,
    distance: (a, b) => a.distanceKm - b.distanceKm,
  };
  results = [...results];
  if (sorters[sort]) results.sort(sorters[sort]);
  else
    results.sort(
      (a, b) =>
        Number(b.verified) - Number(a.verified) ||
        b.rating - a.rating ||
        b.reviewCount - a.reviewCount
    );

  res.json({
    count: results.length,
    currency: "NGN",
    sampleData: true,
    data: results,
  });
};

export const getPropertyBySlug = (req, res) => {
  const property = getProperty(req.params.slug);
  if (!property) {
    return res
      .status(404)
      .json({ error: "Property not found", sampleData: true });
  }
  res.json({ data: property, sampleData: true });
};

export const getPropertyAvailability = (req, res) => {
  const property = getProperty(req.params.slug);
  if (!property) {
    return res.status(404).json({ error: "Property not found" });
  }

  const days = [];
  const start = new Date();
  for (let i = 0; i < 60; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const iso = date.toISOString().slice(0, 10);
    days.push({
      date: iso,
      available: ![3, 9, 17, 26].includes(i),
      nightly: property.rooms[0].price,
    });
  }

  res.json({ property: property.slug, days, sampleData: true });
};
