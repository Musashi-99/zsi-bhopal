# AranyaValue — Master UI Design & Implementation Prompt

You are building **AranyaValue**, a forest-produce quality-to-price intelligence platform. The existing **Dashboard** and **Login** pages are already implemented. Treat the supplied AranyaValue dashboard screenshot as the primary visual reference and preserve its visual language across all new pages.

## Goal
Build the remaining application pages as a coherent, production-quality web app—not isolated mockups. Every page must feel like it belongs to the existing AranyaValue product.

## Visual direction
- Nature-inspired, professional, trustworthy, clean and easy to use.
- Use the existing dashboard’s forest-green palette, pale green surfaces, warm off-white backgrounds, restrained amber accents, rounded cards, subtle borders/shadows and clear typography.
- Reuse the existing logo, top header, left sidebar, icons, spacing, button styles, status chips and card patterns wherever possible.
- Avoid excessive gradients, glassmorphism, neon colors, oversized headings, decorative clutter or a generic SaaS template look.
- The app should feel designed for forest-produce collectors, producer groups, buyers and quality assessors. Prioritize legibility and straightforward workflows.

## Existing shell
Keep the existing app shell consistent:
- Top bar with AranyaValue branding and signed-in user controls.
- Left navigation with the current product sections.
- Main content area with page title, short explanatory subtitle and primary action.
- Use the same active-navigation treatment as the existing dashboard.
- On smaller screens, collapse the sidebar into a usable mobile navigation; do not simply shrink the desktop layout.

## Design system
Before implementing pages, inspect the existing code and reuse its framework, routing, component library, styles, assets and conventions. Do not introduce a second UI framework or replace working components.

Create or reuse shared components where appropriate:
- `AppShell`, `Sidebar`, `TopBar`, `PageHeader`
- `PrimaryButton`, `SecondaryButton`, `IconButton`
- `Card`, `StatusBadge`, `SearchInput`, `FilterBar`
- `DataTable`, `EmptyState`, `LoadingState`, `ErrorState`
- `ConfirmDialog`, `Toast`, `FormField`, `Stepper`
- `Breadcrumbs`, `Pagination`

Use consistent design tokens for color, spacing, radius, shadows, typography and focus states. Keep the existing dashboard visually intact.

## Interaction and implementation requirements
- Build real page layouts and working navigation, not just static screenshots.
- Use the project’s existing routes and routing library. If a route is missing, add it using the existing convention.
- Every visible button, tab, filter, menu, row action and form control must have a sensible behavior. Do not create decorative controls that appear interactive but do nothing.
- Use realistic demo data only where needed, and clearly label it as sample/demo data. Do not imply sample prices, buyers, government schemes, verification or quality results are real.
- Use consistent batch IDs and statuses across pages when displaying the same sample batch.
- Include loading, empty, validation, success and error states where relevant.
- Use accessible labels, keyboard navigation, visible focus, adequate contrast and responsive layouts.
- Do not hardcode secrets or expose private user information.
- Do not claim that a local hash chain is a public blockchain. If showing audit history, describe it accurately as tamper-evident or hash-linked only if that mechanism is actually implemented.
- Do not invent official scheme details. Any scheme content must come from verified official sources and display its source and last-checked date. If no verified data is available, show a clearly labeled placeholder state.

## Product principles
AranyaValue is not just a marketplace. Its central value is helping a collector understand:
1. What quality information is recorded for a produce batch.
2. How that information compares with buyer requirements.
3. Why a buyer’s price or eligibility differs.
4. What practical action may improve quality or value.

Make the quality-to-price explanation visible and understandable. Avoid implying guaranteed prices or guaranteed eligibility.

## Delivery
Implement one page at a time. First inspect the existing codebase and identify the current app shell, routes, styles and reusable components. Then build the requested page using those existing foundations. Do not rewrite unrelated pages. After each page, verify its route, responsive behavior, navigation and key interactions, and report the files changed and any assumptions.