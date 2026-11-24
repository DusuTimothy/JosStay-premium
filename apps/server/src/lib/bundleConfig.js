import { AIRPORT_PICKUP_FEE, BUNDLE_DISCOUNT_RATE, USD_RATE } from "@josstay/shared";

export const BUNDLE_ORIGINS = [
  { id: "LOS", city: "Lagos", airport: "Murtala Muhammed (LOS)", fare: 78000 },
  { id: "ABV", city: "Abuja", airport: "Nnamdi Azikiwe (ABV)", fare: 52000 },
  { id: "KAN", city: "Kano", airport: "Mallam Aminu Kano (KAN)", fare: 60000 },
  { id: "PHC", city: "Port Harcourt", airport: "Omagwa (PHC)", fare: 95000 },
];

export const BUNDLE_CONFIG = {
  origins: BUNDLE_ORIGINS,
  discountRate: BUNDLE_DISCOUNT_RATE,
  airportPickupFee: AIRPORT_PICKUP_FEE,
  usdRate: USD_RATE,
  destination: { city: "Jos", airport: "Yakubu Gowon (JOS)" },
};
