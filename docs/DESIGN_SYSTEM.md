# Design System — JosStay Premium

## Brand direction

Quiet, premium and trustworthy. The interface is built on a warm off-white canvas,
deep plum structure and a single gold accent, with generous white space and
editorial display type. It follows the supplied Figma reference while keeping the
JosStay name, logo and travel context.

Reference traits implemented:

- 88px white header with a gold bed-icon disc, plum wordmark and "By JosStay Premium".
- Full-bleed hero photograph under a plum gradient with a gold-line eyebrow.
- Six-part horizontal search bar on a single white card.
- Hairline dividers instead of heavy cards on long pages.
- Outlined secondary buttons and a solid gold primary action.
- Small 6px badge corners and 8px button corners (not fully rounded pills).

## Colour tokens

All tokens live in `apps/client/tailwind.config.js`.

| Token | Hex | Usage |
|-------|-----|-------|
| `plum.900` | `#2F1843` | Hero base, darkest overlay |
| `plum.800` | `#3F2159` | Footer, dark panels |
| `plum.700` | `#4E2971` | Primary brand, links, active chips, logo text |
| `plum.600` | `#5A3189` | Hover and small accents |
| `plum.500` | `#6B3FA0` | Focus borders |
| `plum.300` | `#C3A9DA` | Eyebrow underline, decorative numbering |
| `plum.100` | `#F0E9F6` | Soft tinted surfaces |
| `plum.50` | `#F7F3FA` | Section tint, avatar bubbles |
| `gold.500` | `#E1B752` | Primary CTA, hero accent line, ratings |
| `gold.400` | `#E5C05C` | CTA hover |
| `gold.700` | `#A17E2E` | Gold text on light |
| `gold.100` | `#FAF0CE` | Gold tint surfaces |
| `cream` | `#FCF7E6` | Verified badges, info strips |
| `ink` | `#26242E` | Primary text |
| `muted` | `#6E6A76` | Secondary text |
| `line` | `#E7E4E0` | Borders and dividers |
| `canvas` | `#F7F6F3` | Page background |
| `white` | `#FFFFFF` | Cards, header, search bar |

Semantic colours stay Tailwind defaults: `emerald-*` for success/verified and
`red-*` for errors and destructive actions.

### Gradients

- Hero overlay: `.hero-fade` — plum `rgba(47,24,67,.94)` on the left, fading to
  `rgba(58,34,82,.35)` on the right so the photograph stays visible.
- Area tiles: bottom-up `plum-900` gradient at 90% opacity for legible white text.

## Typography

Loaded from Google Fonts in `apps/client/app/layout.js`.

- **Display / headings:** `Inter Tight`, weight 600–800, tracking `-0.045em`
  (`tracking-tightest`).
- **Body / UI:** `Inter`, weights 400–700.
- **Hero:** `clamp(3rem, 8.2vw, 6.4rem)`, leading `0.94`.
- **Section headings:** 32–40px on desktop, 32px mobile; page titles 34–46px.
- **Eyebrows:** 10–11px, bold, uppercase, `0.18em` tracking, plum, 1px underline.
- **Body copy:** 13–15px, `1.6`–`1.7` line height, `muted`.
- **Price:** 17–24px bold; supporting "/ night" in 11–13px muted.

## Spacing & layout

- 4px base scale.
- Container: max width **1240px**, gutters 20px mobile / 28px tablet / 32px desktop
  (`.container-page`).
- Section rhythm: 56–64px mobile, 80–96px desktop.
- Header height: 72px mobile, 88px desktop; sticky with a white background and a
  single hairline bottom border.
- Property and checkout pages use a two-column grid: content + 360–380px sticky
  sidebar, collapsing to one column below `lg`.

## Shape & elevation

- Buttons: **8px** radius (`rounded-lg`); heights 36 / 44 / 52px.
- Cards and panels: **12px** radius with a 1px `line` border; the reference uses
  light borders rather than heavy shadows.
- Badges: **6px** radius (`rounded-md`), 10–11px semibold text.
- Chips: fully rounded (`rounded-full`) for filters only.
- Images: 8–12px radius; gallery uses a 1.15fr + 2×2 grid with a `+N photos` chip.
- Shadows: `card` (1px lift) for cards, `bar` for the hero search bar, `float` for
  modal sheets and toast surfaces.
- Overlays: `bg-ink/45` with a 200ms fade; sheets slide up 16px.

## Components

Components are organized for independent colocation and reuse:

- `apps/client/components/ui/` — primitives: `Icon`, `Button`, `Badge`/`VerifiedBadge`, `RatingStars`.
- `apps/client/components/layout/` — app shell: `Logo`, `Header`, `MobileTabBar`, `Footer`.
- `apps/client/components/shared/` — reusable domain components: `SearchBar`, `PropertyCard`, `CalendarPicker`, `FilterPanel` (with `DEFAULT_FILTERS`), `PriceSummary`, `ReviewCard`.
- `apps/client/components/shared/states/` — result states: `LoadingResults`/`SkeletonCard`, `EmptyState`, `ErrorState`.
- `apps/client/components/providers/` — split client providers and hooks: `CurrencyProvider`/`useCurrency`, `ToastProvider`/`useToast`, `BookingProvider`/`useBooking`, composed by `Providers` and exported via `@/components/providers`.
- `apps/client/app/<route>/_components/` — route-local, colocated views and sections (e.g. home sections in `app/_components`, `SearchView`, property detail subcomponents, `CheckoutView`, `DashboardView`, etc.). Route `page.js` files compose these modules.

1. **Button** (`ui/Button`) — `primary`/`gold` (gold + ink), `plum`, `secondary` (white + border),
   `ghost`, `danger`, `subtle`, `dark`; sizes sm/md/lg; loading spinner; optional
   leading/trailing icon; renders a link when `href` is supplied.
2. **SearchBar** (`shared/SearchBar`) — six-part single-card layout: destination, check-in, check-out,
   guests, stay type, gold submit. Date modal uses the shared calendar. Mobile
   collapses to one column with hairline separators.
3. **PropertyCard** (`shared/PropertyCard`) — `layout="grid"` for Home and `layout="row"` for results;
   image, verified/guest-favourite badges, save heart, type + area eyebrow, rating,
   amenity preview, naira price with USD equivalent, optional live total.
4. **FilterPanel** (`shared/FilterPanel`) — one horizontal bordered card (price slider, minimum rating,
   distance from airport, free cancellation) plus amenity chips and "Clear all".
5. **RatingStars** (`ui/RatingStars`) — compact star + value + review count, or `mode="stars"` for
   standalone stars.
6. **Badges** (`ui/Badge`) — `Badge` and `VerifiedBadge` (cream + gold), guest favourite, status, sample
   data, paid, etc. 6px corners.
7. **CalendarPicker** (`shared/CalendarPicker`) — Monday-first single-month availability at property level,
   two-month range in the search sheet; past dates disabled, range highlight,
   nights summary.
8. **PriceSummary** (`shared/PriceSummary`) — nightly × nights, cleaning, service, pickup, bundle discount
   and total in the active currency, with a "no hidden fees" marker.
9. **ReviewCard** (`shared/ReviewCard`) — five stars, quote, initials avatar, verified-stay label.
10. **States** (`shared/states`) — skeleton/loading results, empty state with recovery action, error
    state with retry.
11. **Header / Footer** (`layout/Header`, `layout/Footer`, `layout/Logo`) — gold bed-logo disc, plum wordmark + "By JosStay Premium",
    outlined "My account" pill, currency toggle, mobile sheet menu, purple footer
    with trust marks.
12. **MobileTabBar** (`layout/MobileTabBar`) — Home / Search / Trips / Help on small screens; hidden on
    property, checkout, confirmation and host routes where a sticky action bar
    takes over.

## Currency

- Base currency: NGN (₦), formatted with `en-NG` grouping.
- USD equivalent at an indicative **₦1,550 = $1**.
- Header toggle persists to `localStorage` (`josstay-currency`).
- Cards show the active currency first and the other as a secondary line.

## Interaction rules

- All primary tap targets ≥ 44px on mobile.
- Focus-visible ring: 2px `plum-500` with a 2px offset.
- Loading uses skeletons; errors explain what happened and offer "Try again".
- Filters and date changes re-render results with a short, visible loading state.
- Booking CTAs are sticky on mobile property detail and checkout.
- Every header, footer, card, chip and CTA links to a real screen — no dead ends.
- `prefers-reduced-motion` is respected by keeping animations short and optional.

## Accessibility

- Semantic landmarks: `header`, `nav`, `main`, `footer`.
- Every icon-only control has an `aria-label`; toggles expose `aria-pressed`.
- Form fields use `<label>` wrappers and inline error text.
- Contrast targets: `ink` on white ≈ 13:1, white on `plum-700` ≈ 8.6:1,
  `ink` on `gold-500` ≈ 7.4:1.
- Images carry descriptive alt text; decorative thumbnails use empty alt.

## Sample content policy

All mock properties, reviews, host names, references, payouts and fares are marked
as sample data in code and in the UI, and live in `packages/shared/data.js` for
easy replacement. Photos use deterministic `picsum.photos` seeds.
