# JosStay Premium — Build Plan

**Project:** JosStay Premium — a mobile-first accommodation booking platform for Jos, Plateau State.
**Build window:** 18 November 2026 → 21 November 2026 (4 build days).
**Stack:** HTML, Tailwind CSS, JavaScript, React, Next.js, Node.js, Express, PostgreSQL, Aiven (Postgres + Redis), pg, redis, SQL migrations, RLS, Zod, Multer, Helmet, CORS, bcrypt, JWT, dotenv, Render, Vercel, Brevo, Paystack, data analysis, AI/LLM integration, WhatsApp integration, Google sign-up, RBAC.

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
- [x] Build Search results: property cards, sort, filters (price, type, rating, amenities, airport distance, free cancellation), map toggle, filter chips.
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
> 🗺️ Toggle between list and map
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
> #JosStay #BuildInPublic #Jos #NigeriaStartups #ProductDesign #WebApp #NodeJS #TravelTech

**Suggested visual:** Collage of Bundle, My bookings, Host dashboard and Help centre.

---

## Day 4 — Saturday, 21 November 2026
### Polish, persistence & deploy

**Goal:** A polished, documented demo ready to share and ready for real integrations.

**Tasks**
- [ ] Wire the client to the live API where useful and harden form validation.
- [ ] Apply PostgreSQL migrations, run seed/verify scripts, and configure Aiven PostgreSQL/Redis with TLS CA certificates.
- [ ] Add route-level loading states, error boundaries, and 404 handling.
- [ ] Run a full mobile + desktop QA pass on the booking and host flows.
- [ ] Optimise images, metadata, Open Graph tags and Core Web Vitals basics.
- [ ] Deploy client to Vercel and server to Render with environment variables and CA cert paths configured.
- [ ] Finalise README, architecture notes and API docs.

**Deliverable:** A deployed, shareable JosStay Premium prototype backed by PostgreSQL.

**Post of the day (X / LinkedIn / Instagram)**

> Day 4 — we shipped **JosStay** 🚀
>
> A mobile-first way to book hotels, apartments, shortlets and guest houses in Jos, Plateau State.
>
> ✅ 10+ clickable screens
> ✅ Live search, filters and booking flow
> ✅ Flight + stay bundle
> ✅ Host dashboard and help centre
> ✅ NGN pricing, no hidden fees
>
> Built with Next.js, Tailwind CSS, Express and a full-stack monorepo — in 4 days.
>
> Live demo: <add link>
> Repo: <add link>
>
> #JosStay #BuildInPublic #Jos #PlateauState #NextJS #TailwindCSS #ReactJS #NodeJS #TechInNigeria #Startup

**Suggested visual:** 30–45 second walkthrough of the full product, ending on the confirmation screen.

---

## Optional follow-ups (post–Day 4)

- Replace in-memory bookings with a production PostgreSQL data path end-to-end from the client.
- Integrate real Paystack payments and Brevo transactional email.
- Add Google sign-in and full RBAC middleware.
- Connect Redis-backed caching and WhatsApp concierge notifications.
- Run a data analysis pass on search, conversion and host performance.