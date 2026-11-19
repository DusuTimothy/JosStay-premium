/**
 * JosStay Premium — SAMPLE DATA
 * All properties, hosts, reviews and prices below are fictional demo content.
 * Replace this file with API/database data before going live.
 */

export const USD_RATE = 1550; // indicative: ₦1,550 = $1
export const SERVICE_FEE_RATE = 0.07;
export const AIRPORT_PICKUP_FEE = 12000;
export const BUNDLE_DISCOUNT_RATE = 0.1;

export const AREAS = ["Jos North", "Jos South", "Rayfield", "Bukuru"];

export const PROPERTY_TYPES = [
  { id: "hotel", label: "Hotel" },
  { id: "apartment", label: "Apartment" },
  { id: "airbnb", label: "Airbnb-style" },
  { id: "shortlet", label: "Shortlet" },
  { id: "guesthouse", label: "Guest house" },
];

export const AMENITIES = [
  { id: "backupPower", label: "Backup power" },
  { id: "wifi", label: "Wi-Fi" },
  { id: "ac", label: "Air conditioning" },
  { id: "parking", label: "Parking" },
  { id: "breakfast", label: "Breakfast" },
  { id: "security", label: "24/7 security" },
  { id: "water", label: "Water supply" },
];

export const amenityLabel = (id) =>
  AMENITIES.find((a) => a.id === id)?.label ?? id;

export const typeLabel = (id) =>
  PROPERTY_TYPES.find((t) => t.id === id)?.label ?? id;

const DEMO_IMAGES = [
  "https://images.pexels.com/photos/6077368/pexels-photo-6077368.jpeg?auto=compress&cs=tinysrgb&w=1600",
  "https://images.pexels.com/photos/8135496/pexels-photo-8135496.jpeg?auto=compress&cs=tinysrgb&w=1600",
  "https://images.pexels.com/photos/20604659/pexels-photo-20604659.jpeg?auto=compress&cs=tinysrgb&w=1600",
  "https://images.pexels.com/photos/6585598/pexels-photo-6585598.jpeg?auto=compress&cs=tinysrgb&w=1600",
  "https://images.pexels.com/photos/7587828/pexels-photo-7587828.jpeg?auto=compress&cs=tinysrgb&w=1600",
  "https://images.pexels.com/photos/39344515/pexels-photo-39344515.jpeg?auto=compress&cs=tinysrgb&w=1600",
  "https://images.pexels.com/photos/7511695/pexels-photo-7511695.jpeg?auto=compress&cs=tinysrgb&w=1600",
  "https://images.pexels.com/photos/30386991/pexels-photo-30386991.jpeg?auto=compress&cs=tinysrgb&w=1600",
];

const hashSeed = (value = "") => {
  let hash = 0;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
};

// Modern apartment, hotel, and room imagery for demo use (Pexels).
const img = (slug, n = 1) => DEMO_IMAGES[hashSeed(`${slug}-${n}`) % DEMO_IMAGES.length];

const rules = (overrides = []) => [
  "Check-in from 2:00 PM",
  "Check-out by 11:00 AM",
  "Valid ID required at check-in",
  "No smoking indoors",
  "No parties or events",
  ...overrides,
];

export const properties = [
  {
    id: 1,
    slug: "crestview-boutique-hotel",
    name: "Crestview Boutique Hotel",
    type: "hotel",
    area: "Jos North",
    address: "18 Rwang Pam Street, Jos North",
    price: 85000,
    cleaningFee: 6000,
    rating: 4.8,
    reviewCount: 184,
    verified: true,
    freeCancellation: true,
    distanceKm: 12.4,
    badge: "Guest favourite",
    maxGuests: 4,
    summary:
      "A calm boutique hotel minutes from the city centre, with hill views and a celebrated breakfast.",
    description:
      "Crestview blends warm Plateau hospitality with the polish of a city boutique. Rooms open onto a quiet courtyard, the restaurant serves a proper Nigerian breakfast, and backup power keeps everything running. It is a short drive from the Jos Museum and the main business district.",
    amenities: ["backupPower", "wifi", "ac", "parking", "breakfast", "security", "water"],
    images: [img("crestview", 1), img("crestview", 2), img("crestview", 3), img("crestview", 4)],
    host: { name: "Grace Pam", joined: "2023", superhost: true },
    rooms: [
      { id: "deluxe", name: "Deluxe Room", price: 85000, capacity: 2, beds: "1 king bed", size: "28 m²", refundable: true },
      { id: "executive", name: "Executive Suite", price: 120000, capacity: 3, beds: "1 king + sofa bed", size: "42 m²", refundable: true },
      { id: "crestview", name: "Crestview Suite", price: 150000, capacity: 4, beds: "2 queen beds", size: "56 m²", refundable: true },
    ],
    houseRules: rules(["No pets"]),
    reviews: [
      { name: "Adaeze O.", date: "Oct 2026", rating: 5, quote: "Spotless room, genuinely warm staff, and the breakfast was excellent. The hill view at sunrise is worth the stay." },
      { name: "Tunde A.", date: "Sep 2026", rating: 5, quote: "Power never flickered. I worked remotely for three days without a single interruption." },
      { name: "Fatima B.", date: "Aug 2026", rating: 4, quote: "Lovely stay. Parking was tight on Saturday night but the team sorted it quickly." },
    ],
  },
  {
    id: 2,
    slug: "rayfield-palm-residence",
    name: "Rayfield Palm Residence",
    type: "apartment",
    area: "Rayfield",
    address: "7 Palm Close, Rayfield, Jos",
    price: 120000,
    cleaningFee: 8000,
    rating: 4.9,
    reviewCount: 132,
    verified: true,
    freeCancellation: true,
    distanceKm: 18.2,
    badge: "Top rated",
    maxGuests: 5,
    summary:
      "A light-filled two-bedroom apartment in leafy Rayfield with a private balcony and full kitchen.",
    description:
      "Designed for longer stays, Palm Residence has a full kitchen, fast fibre Wi-Fi, and a balcony framed by palms. The neighbourhood is quiet and walkable, with cafes and a supermarket nearby. Housekeeping is available on request.",
    amenities: ["backupPower", "wifi", "ac", "parking", "breakfast", "security", "water"],
    images: [img("rayfield", 1), img("rayfield", 2), img("rayfield", 3), img("rayfield", 4)],
    host: { name: "Michael Dashe", joined: "2022", superhost: true },
    rooms: [
      { id: "garden", name: "Garden Apartment", price: 120000, capacity: 4, beds: "2 queen beds", size: "96 m²", refundable: true },
      { id: "penthouse", name: "Palm Penthouse", price: 185000, capacity: 5, beds: "2 king beds + sofa", size: "130 m²", refundable: true },
    ],
    houseRules: rules(["Quiet hours after 10:00 PM"]),
    reviews: [
      { name: "Ngozi E.", date: "Oct 2026", rating: 5, quote: "Felt like a home, not a rental. The kitchen is properly equipped and the Wi-Fi is fast." },
      { name: "David M.", date: "Sep 2026", rating: 5, quote: "Beautiful, secure and exactly as pictured. Michael responded within minutes." },
      { name: "Halima S.", date: "Jul 2026", rating: 5, quote: "The balcony is the star. We had breakfast outside every morning." },
    ],
  },
  {
    id: 3,
    slug: "hilltop-guest-house",
    name: "Hilltop Guest House",
    type: "guesthouse",
    area: "Jos South",
    address: "24 Bukuru Expressway, Jos South",
    price: 32000,
    cleaningFee: 3000,
    rating: 4.5,
    reviewCount: 96,
    verified: true,
    freeCancellation: false,
    distanceKm: 22.6,
    badge: null,
    maxGuests: 3,
    summary:
      "Friendly, uncomplicated rooms on the quiet edge of Jos South, with breakfast included.",
    description:
      "Hilltop is the kind of guest house you return to: simple rooms, reliable water, and a garden where breakfast is served when the weather allows. It suits travellers passing through Plateau who want a comfortable base without city-centre noise.",
    amenities: ["backupPower", "wifi", "parking", "breakfast", "security", "water"],
    images: [img("hilltop", 1), img("hilltop", 2), img("hilltop", 3), img("hilltop", 4)],
    host: { name: "Naomi Bature", joined: "2024", superhost: false },
    rooms: [
      { id: "standard", name: "Standard Room", price: 32000, capacity: 2, beds: "1 double bed", size: "22 m²", refundable: false },
      { id: "family", name: "Family Room", price: 48000, capacity: 3, beds: "1 double + 1 single", size: "34 m²", refundable: false },
    ],
    houseRules: rules(["Breakfast served 7:00–9:30 AM", "No pets"]),
    reviews: [
      { name: "Peter G.", date: "Oct 2026", rating: 4, quote: "Great value and very kind hosts. Breakfast was simple but fresh." },
      { name: "Blessing U.", date: "Aug 2026", rating: 5, quote: "Quiet, clean and safe. Exactly what I needed for a work trip." },
    ],
  },
  {
    id: 4,
    slug: "bukuru-garden-shortlet",
    name: "Bukuru Garden Shortlet",
    type: "shortlet",
    area: "Bukuru",
    address: "11 Garden Avenue, Bukuru",
    price: 28000,
    cleaningFee: 2500,
    rating: 4.6,
    reviewCount: 74,
    verified: true,
    freeCancellation: true,
    distanceKm: 25.1,
    badge: "Great value",
    maxGuests: 2,
    summary:
      "A compact garden studio with a private entrance, ideal for solo travellers and short work trips.",
    description:
      "Tucked behind a family home in Bukuru, this studio has its own entrance, a small kitchenette, and a shaded outdoor seating area. It is basic but thoughtfully finished, with reliable power and water.",
    amenities: ["backupPower", "wifi", "ac", "parking", "security", "water"],
    images: [img("bukuru", 1), img("bukuru", 2), img("bukuru", 3), img("bukuru", 4)],
    host: { name: "Daniel Gyang", joined: "2024", superhost: true },
    rooms: [
      { id: "studio", name: "Garden Studio", price: 28000, capacity: 2, beds: "1 queen bed", size: "26 m²", refundable: true },
      { id: "loft", name: "Garden Loft", price: 38000, capacity: 3, beds: "1 queen + sofa bed", size: "38 m²", refundable: true },
    ],
    houseRules: rules(["No unregistered guests", "Quiet hours after 9:00 PM"]),
    reviews: [
      { name: "Josephine N.", date: "Sep 2026", rating: 5, quote: "A little gem. Private, clean, and the garden is lovely in the evening." },
      { name: "Ahmed Y.", date: "Aug 2026", rating: 4, quote: "Good value for a short stay. Wi-Fi was solid for calls." },
      { name: "Ruth D.", date: "Jun 2026", rating: 5, quote: "Daniel is a thoughtful host. Would stay again." },
    ],
  },
  {
    id: 5,
    slug: "plateau-rock-suites",
    name: "Plateau Rock Suites",
    type: "hotel",
    area: "Jos North",
    address: "3 Rock Haven Road, Jos North",
    price: 65000,
    cleaningFee: 5000,
    rating: 4.7,
    reviewCount: 211,
    verified: true,
    freeCancellation: true,
    distanceKm: 13.8,
    badge: null,
    maxGuests: 3,
    summary:
      "Modern suites with rocky outcrop views, a rooftop terrace and dependable business facilities.",
    description:
      "Plateau Rock pairs clean, contemporary rooms with a rooftop that looks out over Jos. There is a small gym, a conference room, and a restaurant that stays open late. Staff are used to business travellers and can arrange airport transfers.",
    amenities: ["backupPower", "wifi", "ac", "parking", "breakfast", "security", "water"],
    images: [img("plateau", 1), img("plateau", 2), img("plateau", 3), img("plateau", 4)],
    host: { name: "Comfort James", joined: "2023", superhost: false },
    rooms: [
      { id: "deluxe", name: "Rock Deluxe", price: 65000, capacity: 2, beds: "1 queen bed", size: "30 m²", refundable: true },
      { id: "suite", name: "Plateau Suite", price: 98000, capacity: 3, beds: "1 king + sofa bed", size: "48 m²", refundable: true },
    ],
    houseRules: rules(["No smoking on the rooftop", "No pets"]),
    reviews: [
      { name: "Emeka I.", date: "Oct 2026", rating: 5, quote: "The rooftop at sunset is superb. Room was quiet and the bed was excellent." },
      { name: "Zainab K.", date: "Sep 2026", rating: 4, quote: "Good business hotel. Check-in was a little slow but the staff made up for it." },
      { name: "Paul T.", date: "Jul 2026", rating: 5, quote: "Reliable power, strong Wi-Fi, and a proper desk. I got a lot done." },
    ],
  },
  {
    id: 6,
    slug: "zaria-road-executive-apartment",
    name: "Zaria Road Executive Apartment",
    type: "apartment",
    area: "Jos North",
    address: "42 Zaria Road, Jos North",
    price: 55000,
    cleaningFee: 4000,
    rating: 4.4,
    reviewCount: 58,
    verified: false,
    freeCancellation: true,
    distanceKm: 15.3,
    badge: null,
    maxGuests: 4,
    summary:
      "A practical one-bedroom apartment on Zaria Road with fast Wi-Fi and secure parking.",
    description:
      "This is a straightforward, well-kept apartment for travellers who want a central base. It has a separate living area, a kitchenette, and a dedicated workspace. The building has a gate, a guard, and parking behind the fence.",
    amenities: ["backupPower", "wifi", "ac", "parking", "security", "water"],
    images: [img("zaria", 1), img("zaria", 2), img("zaria", 3), img("zaria", 4)],
    host: { name: "Ibrahim Sani", joined: "2025", superhost: false },
    rooms: [
      { id: "onebed", name: "One-bedroom Apartment", price: 55000, capacity: 3, beds: "1 queen + sofa bed", size: "54 m²", refundable: true },
      { id: "twobed", name: "Two-bedroom Apartment", price: 78000, capacity: 4, beds: "2 queen beds", size: "78 m²", refundable: true },
    ],
    houseRules: rules(["No parties", "Visitors must be signed in"]),
    reviews: [
      { name: "Musa A.", date: "Sep 2026", rating: 4, quote: "Central, secure and fairly priced. The apartment is exactly as described." },
      { name: "Chioma O.", date: "Aug 2026", rating: 4, quote: "Clean and comfortable. The kitchen is small but enough for breakfast." },
    ],
  },
  {
    id: 7,
    slug: "shere-hills-lodge",
    name: "Shere Hills Lodge",
    type: "airbnb",
    area: "Jos South",
    address: "Shere Hills Road, Jos South",
    price: 150000,
    cleaningFee: 12000,
    rating: 4.9,
    reviewCount: 67,
    verified: true,
    freeCancellation: true,
    distanceKm: 30.4,
    badge: "Luxury escape",
    maxGuests: 8,
    summary:
      "A private hillside villa with a firepit, wraparound deck and uninterrupted Plateau views.",
    description:
      "Shere Hills Lodge is a whole-home escape for families and small groups. The main villa sleeps six, with a separate guest cottage for two more. There is a firepit, an outdoor dining deck, and a kitchen built for long dinners. A caretaker lives on site.",
    amenities: ["backupPower", "wifi", "ac", "parking", "breakfast", "security", "water"],
    images: [img("shere", 1), img("shere", 2), img("shere", 3), img("shere", 4)],
    host: { name: "Elizabeth Rwang", joined: "2021", superhost: true },
    rooms: [
      { id: "villa", name: "Whole Villa", price: 150000, capacity: 6, beds: "3 king beds", size: "220 m²", refundable: true },
      { id: "villa-cottage", name: "Villa + Guest Cottage", price: 210000, capacity: 8, beds: "3 king + 1 queen", size: "280 m²", refundable: true },
    ],
    houseRules: rules(["No loud music after 10:00 PM", "Firepit must be attended", "No pets"]),
    reviews: [
      { name: "Ifeanyi C.", date: "Oct 2026", rating: 5, quote: "The view alone is worth it. We watched the sun set from the deck with a fire going." },
      { name: "Sarah W.", date: "Aug 2026", rating: 5, quote: "Perfect for our family reunion. Plenty of space and a very helpful caretaker." },
      { name: "Bala M.", date: "Jun 2026", rating: 5, quote: "Peaceful, private and beautifully kept. We will be back." },
    ],
  },
  {
    id: 8,
    slug: "naraguta-cozy-studio",
    name: "Naraguta Cozy Studio",
    type: "airbnb",
    area: "Jos North",
    address: "6 Naraguta Avenue, Jos North",
    price: 18000,
    cleaningFee: 2000,
    rating: 4.3,
    reviewCount: 112,
    verified: true,
    freeCancellation: false,
    distanceKm: 11.2,
    badge: "Budget pick",
    maxGuests: 2,
    summary:
      "A warm little studio near Naraguta with everything a solo traveller needs for a short stay.",
    description:
      "Compact, clean and close to the university and city centre. The studio has a double bed, a desk, a mini fridge, and a small bathroom. It is not fancy, but it is safe, calm, and honestly priced.",
    amenities: ["backupPower", "wifi", "security", "water"],
    images: [img("naraguta", 1), img("naraguta", 2), img("naraguta", 3), img("naraguta", 4)],
    host: { name: "Peace Adamu", joined: "2024", superhost: false },
    rooms: [
      { id: "studio", name: "Cozy Studio", price: 18000, capacity: 2, beds: "1 double bed", size: "18 m²", refundable: false },
    ],
    houseRules: rules(["No cooking of strong-smelling food", "No visitors after 9:00 PM"]),
    reviews: [
      { name: "Daniel A.", date: "Oct 2026", rating: 4, quote: "Small but well organised. Great location for the university." },
      { name: "Mary J.", date: "Sep 2026", rating: 4, quote: "Warm host and a clean room. Fine for one or two nights." },
      { name: "Kelechi U.", date: "Jul 2026", rating: 5, quote: "Exactly what I paid for. Quiet and safe." },
    ],
  },
  {
    id: 9,
    slug: "liberty-boulevard-guest-house",
    name: "Liberty Boulevard Guest House",
    type: "guesthouse",
    area: "Jos South",
    address: "9 Liberty Boulevard, Jos South",
    price: 10000,
    cleaningFee: 1500,
    rating: 4.1,
    reviewCount: 43,
    verified: false,
    freeCancellation: true,
    distanceKm: 24.7,
    badge: "Budget pick",
    maxGuests: 2,
    summary:
      "Clean, no-frills rooms for travellers watching their budget, with secure parking on site.",
    description:
      "Liberty Boulevard is a simple guest house with a friendly resident manager. Rooms have a bed, a fan or AC depending on the category, and a private bathroom. The compound is gated and there is space to park.",
    amenities: ["wifi", "parking", "security", "water"],
    images: [img("liberty", 1), img("liberty", 2), img("liberty", 3), img("liberty", 4)],
    host: { name: "Samuel Choji", joined: "2025", superhost: false },
    rooms: [
      { id: "standard", name: "Standard Room", price: 10000, capacity: 2, beds: "1 double bed", size: "16 m²", refundable: true },
      { id: "ensuite", name: "Ensuite Room", price: 15000, capacity: 2, beds: "1 double bed", size: "20 m²", refundable: true },
    ],
    houseRules: rules(["No cooking in rooms", "Gate closes at 11:00 PM"]),
    reviews: [
      { name: "John B.", date: "Aug 2026", rating: 4, quote: "Very cheap and surprisingly clean. Good for a quick stopover." },
      { name: "Lydia P.", date: "Jun 2026", rating: 4, quote: "The manager was polite and the compound felt safe." },
    ],
  },
  {
    id: 10,
    slug: "goldcrest-apartments",
    name: "Goldcrest Apartments",
    type: "apartment",
    area: "Rayfield",
    address: "15 Goldcrest Close, Rayfield",
    price: 95000,
    cleaningFee: 7000,
    rating: 4.7,
    reviewCount: 89,
    verified: true,
    freeCancellation: true,
    distanceKm: 17.5,
    badge: "Guest favourite",
    maxGuests: 4,
    summary:
      "A polished two-bedroom apartment with a generator, borehole water and a quiet Rayfield address.",
    description:
      "Goldcrest is a dependable choice for families and small teams. The apartment is serviced daily, the kitchen is fully equipped, and the building has a generator and borehole. Restaurants and a pharmacy are within walking distance.",
    amenities: ["backupPower", "wifi", "ac", "parking", "security", "water"],
    images: [img("goldcrest", 1), img("goldcrest", 2), img("goldcrest", 3), img("goldcrest", 4)],
    host: { name: "Rebecca Pam", joined: "2022", superhost: true },
    rooms: [
      { id: "twobed", name: "Two-bedroom Apartment", price: 95000, capacity: 4, beds: "2 queen beds", size: "88 m²", refundable: true },
      { id: "threebed", name: "Three-bedroom Apartment", price: 135000, capacity: 5, beds: "2 queen + 1 single", size: "115 m²", refundable: true },
    ],
    houseRules: rules(["Daily housekeeping included", "No pets"]),
    reviews: [
      { name: "Chinwe N.", date: "Oct 2026", rating: 5, quote: "Clean, quiet and very well run. The daily cleaning was a nice touch." },
      { name: "Yusuf H.", date: "Sep 2026", rating: 4, quote: "Comfortable for our family of four. Water and power were steady." },
      { name: "Grace A.", date: "Jul 2026", rating: 5, quote: "One of the best shortlets I have used in Jos." },
    ],
  },
];

export const getProperty = (slug) =>
  properties.find((p) => p.slug === slug) || null;

export const getPropertyById = (id) =>
  properties.find((p) => p.id === Number(id)) || null;

export const nightsBetween = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  const nights = Math.round((end - start) / 86400000);
  return nights > 0 ? nights : 0;
};

export const quoteStay = (property, checkIn, checkOut, options = {}) => {
  const nights = Math.max(nightsBetween(checkIn, checkOut), 1);
  const room =
    property.rooms.find((r) => r.id === options.roomId) || property.rooms[0];
  const nightly = room.price;
  const subtotal = nightly * nights;
  const cleaning = property.cleaningFee ?? 5000;
  const service = Math.round(subtotal * SERVICE_FEE_RATE);
  const pickup = options.airportPickup ? AIRPORT_PICKUP_FEE : 0;
  const discount = options.bundleDiscount
    ? Math.round((subtotal + cleaning + service) * BUNDLE_DISCOUNT_RATE)
    : 0;
  const total = subtotal + cleaning + service + pickup - discount;

  return {
    room,
    nights,
    nightly,
    subtotal,
    cleaning,
    service,
    pickup,
    discount,
    total,
  };
};

export const formatNaira = (amount) =>
  `₦${Number(amount || 0).toLocaleString("en-NG")}`;

export const formatUsd = (amount) =>
  `$${Math.round(Number(amount || 0) / USD_RATE).toLocaleString("en-US")}`;

export const toIso = (date) => date.toISOString().slice(0, 10);

export const addDays = (iso, days) => {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toIso(date);
};

export const formatDate = (iso, opts = {}) => {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...opts,
  });
};

export const HOME_REVIEWS = [
  {
    name: "Adaeze Okafor",
    location: "Abuja",
    rating: 5,
    date: "Oct 2026",
    quote:
      "Booked a shortlet in Rayfield in under five minutes. The photos matched the apartment exactly and the host was waiting when we arrived.",
  },
  {
    name: "Tunde Adewale",
    location: "Lagos",
    rating: 5,
    date: "Sep 2026",
    quote:
      "I travel to Jos monthly for work. Having verified listings and one clear price breakdown makes the whole trip easier.",
  },
  {
    name: "Fatima Bello",
    location: "Kaduna",
    rating: 4,
    date: "Aug 2026",
    quote:
      "The flight and stay bundle saved us money, and support answered on WhatsApp when our arrival time changed.",
  },
];

// SAMPLE DATA — seed bookings for the "My bookings" screen.
export const SEED_BOOKINGS = [
  {
    reference: "JS-8F2K1Q",
    propertySlug: "crestview-boutique-hotel",
    roomId: "deluxe",
    checkIn: "2026-12-05",
    checkOut: "2026-12-08",
    guests: 2,
    airportPickup: true,
    status: "upcoming",
    total: 301000,
  },
  {
    reference: "JS-4M7P2D",
    propertySlug: "bukuru-garden-shortlet",
    roomId: "studio",
    checkIn: "2026-09-12",
    checkOut: "2026-09-14",
    guests: 1,
    airportPickup: false,
    status: "completed",
    total: 64000,
  },
];
