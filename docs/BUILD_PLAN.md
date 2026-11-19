# JosStay Premium — Build Plan

**Project:** JosStay Premium — a mobile-first accommodation booking platform for Jos, Plateau State.
**Build window:** 18 November 2026 → 21 November 2026 (4 build days).
**Stack:** HTML, Tailwind CSS, JavaScript, React, Next.js, Node.js, Express, PostgreSQL, Redis, Zod, Multer, Helmet, Sequelize, CORS, bcrypt, dotenv, Supabase, Render, Vercel, Brevo, Paystack, data analysis, AI/LLM integration, WhatsApp integration, Google sign-up, RBAC.

---

## Guiding principles

1. **Mobile-first.** Every screen is designed at 375px first, then expanded to tablet and desktop.
2. **Clickable, not static.** Every main button and link navigates to a real screen.
3. **Show the states.** Search and checkout include loading, empty, success, and error states.
4. **Document as we build.** Each day has a checklist and a ready-to-post social update.
5. **Sample data is labelled.** All mock content lives in `packages/shared` and is marked `SAMPLE DATA`.
6. **No hidden fees.** The price breakdown is always visible before payment.

---

## Day 1 — Wednesday, 18 November 2026
### Foundation, design system & Home

**Goal:** A working monorepo and the Home screen, with the design system in place.

**Tasks**
- [x] Write project brief, build plan, and social content calendar.
- [x] Match the Figma reference: plum `#4E2971`, gold `#E1B752`, warm canvas `#F7F6F3`, Inter Tight display / Inter body, 8px buttons, 6px badges.
- [x] Scaffold the npm-workspace monorepo: `apps/client` (Next.js), `apps/server` (Express), `packages/shared` (data + helpers).
- [x] Create 10 realistic Jos sample properties (₦10,000–₦150,000) with amenities, ratings, reviews, and placeholder photos.
- [x] Build reusable primitives: Button, Badge, RatingStars, PropertyCard, SearchBar, CalendarPicker, PriceSummary.
- [x] Build the Home screen: 88px branded header, full-bleed "Stay well. Travel better." hero with six-part search bar, "Stay your way" categories, popular stays, popular areas, the JosStay promise, guest reviews, flight banner and host CTA.
- [x] Add the NGN ⇄ USD currency toggle.
- [x] Verify the Home screen at 375px and at desktop width.

**Deliverable:** A clickable Home screen that searches into the results screen.

**Post of the day (X / LinkedIn / Instagram)**

> Day 1 of building **JosStay** 🏡✨
>
> We're creating a better way to find and book stays in Jos — hotels, apartments, shortlets, guest houses and Airbnb-style homes, all in one place.
>
> Today we:
> 🎨 Locked the design system to match our Figma reference (plum + gold, mobile-first)
> 🧱 Set up a full-stack monorepo (Next.js + Express)
> 🏘️ Added 10 realistic Jos listings from ₦10k to ₦150k
> 🖼️ Built a 1 + 4 editorial photo gallery and sticky reserve card
> 🔎 Built the Home screen and search entry point
>
> Build days: 18 → 21 Nov. Follow along as we ship. 🚀
>
> #JosStay #BuildInPublic #Jos #PlateauState #NextJS #TailwindCSS #WebDevelopment #NigeriaTech

**Suggested visual:** Home screen hero at mobile width, plum canvas and gold CTA visible.

---

## Day 2 — Thursday, 19 November 2026
### Search results, property detail & checkout

**Goal:** The complete booking path from search to payment.

**Tasks**
- [x] Build Search results: property cards, sort, filters (price, type, rating, amenities, airport distance, free cancellation), filter chips.
- [x] Add visible loading skeletons, empty-state recovery, and error-state retry.
- [x] Build Property detail: editorial 1 + 4 gallery with `+N photos`, verified badge, Share/Save, host row, trust rows, amenities, room selector, single-month availability calendar, reviews, sticky gold "Reserve your stay" card.
- [x] Make calendar and guest-stepper changes update nights and total price live.
- [x] Build Checkout: guest details, special requests, airport pickup add-on, payment method selector (Card / Bank transfer / USSD), mock payment with loading → success/error.
- [x] Persist the booking draft and created bookings locally.
- [x] Build Booking confirmation with reference, stay summary, "Add flight", "View booking" and "Share".

**Deliverable:** A traveller can search → view a property → pick dates → pay (mock) → get a reference.

**Post of the day (X / LinkedIn / Instagram)**

> Day 2: the full booking flow is live 🛫🏨
>
> From search to confirmation in one connected journey:
> 🔎 Filter by price, type, rating, amenities and distance from the airport
> 📅 Pick dates and watch the total update instantly
> 💳 Choose Card, Bank transfer or USSD at checkout
> ✅ Get a booking reference with no hidden fees
>
> Still shipping. 2 days to launch. ⏳
>
> #JosStay #BuildInPublic #Jos #HospitalityTech #ReactJS #ExpressJS #Paystack #TechInNigeria

**Suggested visual:** 15-second screen recording of search → property → checkout → confirmation.

---

## Day 3 — Friday, 20 November 2026
### Remaining screens & host experience

**Goal:** Every screen in the flow is clickable, including the host side.

**Tasks**
- [x] Build Flight + stay bundle form with discounted bundle summary.
- [x] Build My bookings: upcoming/past tabs, cancel with confirmation, rebook.
- [x] Build Host sign-up and Host dashboard: add listing with photos + verification documents, manage calendar and prices, view bookings and payouts.
- [x] Build Help centre: FAQ accordion, cancellation policy, WhatsApp contact button.
- [x] Connect all navigation: header, footer, mobile menu, cards, CTAs, back links.
- [x] Add toast feedback for share, copy, cancel, and mock payouts.
- [x] Review responsive behaviour on every screen.

**Deliverable:** A nine-screen clickable prototype with no dead-end buttons.

**Post of the day (X / LinkedIn / Instagram)**

> Day 3: JosStay is now a complete, clickable product 🎉
>
> New today:
> ✈️ Flight + stay bundle with a discounted summary
> 📖 My bookings — cancel and rebook in a tap
> 🏠 Host dashboard — listings, photos, documents, calendar, prices, bookings, payouts
> 💬 Help centre with FAQs and WhatsApp support
>
> Every button now goes somewhere. Tomorrow: polish, test, deploy. 🚀
>
> #JosStay #BuildInPublic #Jos #PlateauState #Hosting #TravelTech #ProductDesign #Nigeria

**Suggested visual:** Carousel of My bookings, Host dashboard, and Help centre screens.

---

## Day 4 — Saturday, 21 November 2026
### QA, documentation & launch

**Goal:** Ship a clean build and publish the project story.

**Tasks**
- [x] Full click-through QA on mobile (375px) and desktop (1440px).
- [x] Test search filters, date pricing, cancel/rebook, payment error/retry, and empty states.
- [x] Accessibility pass: labels, focus states, contrast, tap targets (min 44px).
- [x] Performance pass: image sizing, font loading, route prefetching.
- [x] Finalise README, setup instructions, environment variables, and API documentation.
- [ ] Deploy client to Vercel and server to Render (or run locally for the demo).
- [ ] Publish launch post and a 60-second demo video.
- [ ] Collect feedback and log the next iteration (real Paystack, Supabase auth, Redis caching, AI concierge).

**Deliverable:** Public demo link + launch announcement.

**Launch post (X / LinkedIn / Instagram)**

> 🚀 **JosStay is live.**
>
> Finding a trusted place to stay in Jos just got easier. Hotels, apartments, shortlets, guest houses and Airbnb-style homes — verified, transparently priced, and bookable on your phone.
>
> ✅ 10 sample stays across every budget
> ✅ Naira prices with a dollar view
> ✅ Card, bank transfer and USSD at checkout
> ✅ Flight + stay bundles
> ✅ A dashboard for hosts
> ✅ WhatsApp support
>
> Built in 4 days with Next.js, Tailwind, Express and a lot of ☕.
>
> Try the demo and tell us what to build next. 👇
>
> #JosStay #LaunchDay #Jos #PlateauState #NigeriaTech #TravelTech #BuildInPublic #NextJS

**Suggested visual:** 60-second demo video + launch carousel (Home, Search, Detail, Checkout, Host).

---

## Content cadence summary

| Day | Date | Theme | Primary screen |
|-----|------------|----------------------|----------------------|
| 1 | 18 Nov 2026 | Foundation & Home | Home |
| 2 | 19 Nov 2026 | Booking flow | Search → Detail → Checkout → Confirmation |
| 3 | 20 Nov 2026 | Complete product | Bundle, Bookings, Host, Help |
| 4 | 21 Nov 2026 | QA & launch | Everything |

**Posting tips**
- Post between 8–10am or 6–8pm WAT for best reach.
- Lead with the customer benefit, not the code.
- Always attach a screen recording or screenshot; mobile frames perform best.
- Keep the same hashtag set for the week so the series is easy to follow.
- Reply to comments with the demo link once it is live on Day 4.
