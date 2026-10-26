# HomeMeal UI refresh — 26/10/2026

## Reference and scope

Reviewed publicly served HTML, inline CSS and a JavaScript bundle from [Cocoon](https://cocoonvietnam.com/), the [travel-kit category](https://cocoonvietnam.com/danh-muc/travel-kit), and the [product detail page](https://cocoonvietnam.com/san-pham/gel-bi-dao-rua-mat-500ml). Inspected the rendered product page and footer. This is public browser output, not access to Cocoon's private source repository or backend.

The useful patterns are warm neutral surfaces, serif display headings paired with readable sans-serif body text, generous image/text columns, fine dividers and restrained interactions. HomeMeal uses its own logo, burgundy/mint identity, content and existing illustrative food imagery. No Cocoon code, product imagery, video, tracking scripts or commerce logic was imported.

## Implementation

- `src/index.css` owns the palette and shared interaction styles. Existing literal brand colors in customer, cook and admin components now reference semantic Tailwind tokens. Error/success/status colors remain distinct.
- Lora 400 normal/italic is used only for display headings; Plus Jakarta Sans remains the font for forms, tables and body copy. Four local Latin/Vietnamese WOFF2 files total 54,732 bytes and use `font-display: swap`. License: `src/assets/fonts/Lora-OFL.txt`. Source: Google Fonts Lora v37, downloaded 26/10/2026. Browsers do not call Google Fonts.
- Home: split hero with illustrative photo, shorter introduction, existing quick planner, all suggested menus, featured cooks, five trust principles, service process and final CTA. The detailed hero workflow remains available in a native disclosure; the full process section remains visible further down the page.
- Menu/cooks: larger page titles and spacing; dish photos use a consistent 4:3 ratio and lazy loading. Filters, ingredients, selection and all existing actions remain available.
- Planner: clearer title and progress indicator, screen-reader progress values, budget controls stack on narrow screens. The seven steps and pricing/validation handlers are unchanged.
- Account: introductory panel plus form; all login, registration, recovery, verification and profile-save handlers remain unchanged. Profile details wrap long values.
- Navigation: all destinations retained; duplicate account shortcut consolidated into the account disclosure. Desktop navigation appears from 1280px. Role dashboards remain available from the account menu. Mobile navigation scrolls within the available viewport; Escape closes disclosures and restores focus.
- Keyboard skip link, visible focus, field labels and reduced-motion styles support keyboard/mobile use.

## Flow correction found during UI review

The previous `pathname.startsWith('/cook')` guard also matched the public `/cooks` catalogue and `/cooks/:id` profile pages, redirecting visitors to login. The guard now matches `/cook` and `/cook/…` only; `/admin` uses the same segment boundary. Server authorization is unchanged.

## Verification

- `npm run lint`, `npm run build` and the existing 15 tests pass.
- Headless Edge review: 9 public routes at 320, 390, 1024, 1280, 1440 and 1536px (54 viewport/route combinations). Checked title presence, correct route and no horizontal overflow. Full-page screenshots captured at 390 and 1440px.
- Anonymous visits to `/cook/dashboard`, `/admin` and `/orders` still redirect to login. Public cook list and detail pages stay accessible.
- Quick planner → menu category filter → add a dish → all seven planner steps: guest count and budget preserved. Steps 1–6 also checked at 320px; no order submitted.
- Mobile account/navigation disclosures open and close using Escape.
- Profile edit/save verified against a mocked API response, with the existing request payload. No real customer account or database record created.
- No unhandled JavaScript errors during this UI review. UI API calls used fixtures because a working local PostgreSQL/API service was unavailable.

## Remaining work outside this visual change

Production authentication still requires its database/schema issue to be resolved and a real registration/login/profile-save test. This UI review does not establish database readiness. The main JavaScript chunk warning was resolved by route-level splitting in `db8c55e`. Replace remaining stock dish/cook imagery with verified HomeMeal photography when available.

## Food imagery follow-up — 26/10/2026

Revisited Cocoon's publicly served homepage HTML and inline CSS. Its large image-led content blocks, generous spacing and restrained fade/slide and hover transitions informed this pass. These are layout references only; HomeMeal retains its own colors, content and component code. No Cocoon source, assets or animations were copied.

Five original AI-generated food photographs were created for HomeMeal: a family meal hero and four suggested menu spreads (family, weekend, party and banquet). The prompts specified the corresponding Vietnamese dishes, natural daylight, handmade ceramics, warm neutral surfaces and no text or logos. The built-in image generation tool produced PNG originals; the selected images were converted to 1200px WebP under `src/assets/food/` (about 1 MB total). Each image is labeled as illustrative in the UI. The Home hero, suggested menu cards, Menu introduction and party booking header use these local assets. Existing order, filter, pricing and submission behavior is unchanged.
