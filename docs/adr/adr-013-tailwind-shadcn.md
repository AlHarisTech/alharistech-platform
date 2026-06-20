# ADR-013: TailwindCSS + shadcn/ui for Frontend

## Status
Accepted

## Date
2026-06-20

## Context
The AlharisTech frontend (Next.js per ADR-001) serves a primarily Arabic-speaking user base. This imposes hard requirements: full right-to-left (RTL) layout support, Arabic typography with appropriate font stacks, and bidirectional text handling in mixed-content interfaces (e.g., product codes in Latin script embedded in Arabic descriptions). The platform spans multiple frontend surfaces — public marketing site, e-commerce storefront, admin dashboard, and desktop application — all of which must share a consistent visual language and design system.

The team values developer experience: components should be composable, themeable, and not locked into a vendor's opinionated design language. The component library must support accessibility out of the box (WCAG 2.1 AA minimum) since the platform serves government and enterprise clients in the MENA region where accessibility compliance is increasingly mandated.

## Decision Drivers
1. First-class RTL support — not an afterthought or plugin, but native layout flipping
2. Consistent design system across 4+ frontend surfaces (marketing, store, admin, desktop)
3. Accessible components by default — semantic HTML, ARIA attributes, keyboard navigation, screen-reader support
4. Developer control: ability to customize every component without fighting a library's opinionated styles
5. Minimal CSS bundle size at runtime — only the utility classes and component styles actually used
6. Compatibility with Next.js (ADR-001), TypeScript (ADR-005), and the Turborepo monorepo (ADR-012)

## Options Considered

### Option A: TailwindCSS + shadcn/ui
- **Description:** TailwindCSS 4 provides the utility-first CSS framework with built-in RTL support via logical properties and the `rtl:` variant. shadcn/ui provides accessible, unstyled React components built on Radix UI primitives. Components are not installed as a node package — they are copied as source code into the project, giving the team full ownership and customization capability.
- **Pros:**
  - TailwindCSS RTL support is native: `rtl:mr-4` flips to `rtl:ml-4`, logical properties handle direction-agnostic layouts
  - shadcn/ui components are Radix primitives — battle-tested accessibility (keyboard, screen reader, focus management)
  - Components are source code in our repo — fully customizable, no `!important` overrides, no wrapping hacks
  - Tailwind's JIT (Just-in-Time) engine generates only the used utility classes — CSS bundle stays under 10KB gzipped
  - TailwindCSS 4's CSS-first configuration eliminates `tailwind.config.js` — simpler, faster, and closer to web standards
  - No vendor lock-in for components — if a shadcn/ui component doesn't fit, replace its internals while keeping the Radix accessibility layer
  - Excellent Next.js compatibility — Tailwind is the recommended CSS solution in Next.js documentation
  - shadcn/ui's `cn()` utility merges Tailwind classes with `clsx` + `tailwind-merge`, resolving conflicting classes predictably
- **Cons:**
  - shadcn/ui is not a traditional npm package — components are copied and owned; manual updates require re-copying from upstream
  - Tailwind's utility classes produce verbose JSX — long className strings can reduce readability
  - Radix primitives occasionally expose internal DOM structure that complicates custom styling
  - No built-in data grid or rich text editor — these must be sourced from other libraries and styled with Tailwind
  - shadcn/ui's versioning is tied to a CLI tool; there is no semver for the component source code you own after copying

### Option B: Material UI (MUI)
- **Description:** Use MUI (formerly Material-UI), the most popular React component library implementing Google's Material Design 3. Includes a full set of pre-built, styled components with theming support.
- **Pros:**
  - Comprehensive component set — data grids, date pickers, charts, everything included
  - Mature ecosystem: large community, extensive documentation, stable API
  - Theming system with design tokens for consistent branding
  - RTL support available through theme configuration (`direction: 'rtl'`)
- **Cons:**
  - Material Design aesthetics are strongly opinionated — the platform looks like "a Google product," not an AlharisTech product
  - Customizing deep component internals often requires `sx` prop overrides or `ThemeProvider` deep merges — fragile and hard to maintain
  - Bundle size is large: MUI core + icons + lab components add significant weight to the JavaScript bundle
  - RTL support is a configuration toggle, not a first-class design consideration — complex layouts often break in RTL
  - Upgrading between major versions (v4 → v5 → v6) is notoriously painful due to breaking API changes
  - Tight coupling to Emotion (CSS-in-JS) runtime — adds runtime CSS generation overhead

### Option C: Ant Design
- **Description:** Use Ant Design, a comprehensive React UI library with a design system heavily influenced by enterprise application patterns. Popular in the MENA and APAC regions.
- **Pros:**
  - Massive component library — tables, forms, modals, notifications, all production-hardened
  - Strong RTL support (developed by a Chinese company with internationalization focus)
  - Enterprise-oriented components (ProTable, ProForm) that handle common admin patterns out of the box
  - Design language is distinct from Material — avoids the "Google look" problem
  - Less-UI (a CSS-in-JS alternative) allows some runtime customization
- **Cons:**
  - Very opinionated design language — components look distinctly "Ant Design" and resist deep customization
  - Extremely large bundle size — the full library with icons and pro components can exceed 500KB gzipped
  - CSS-in-JS runtime overhead adds to JavaScript parse and execution time
  - Tight coupling to their form and data-fetching patterns — conflicts with our own API layer conventions
  - Version upgrades frequently involve breaking changes to component APIs and theming
  - Overkill for the public marketing site and store — Ant Design is optimized for dense admin interfaces, not consumer-facing marketing pages

### Option D: Custom CSS (CSS Modules / Sass)
- **Description:** Write all styles from scratch using CSS Modules (scoped styles) or Sass (with mixins for design tokens). Build every component without external UI libraries.
- **Pros:**
  - Complete control — every pixel, every animation, every interaction is custom
  - Zero external UI dependencies — no version upgrades, no breaking changes, no opinionated patterns
  - Smallest possible CSS bundle — only the styles we write
  - Deep learning opportunity for the team
- **Cons:**
  - Accessibility is entirely our responsibility — ARIA attributes, keyboard navigation, focus management, screen-reader announcements must all be implemented manually
  - Enormous time investment — building a production-grade component library from scratch is months of work
  - RTL support must be manually implemented for every component — doubling the style surface area
  - Without a design system, visual consistency across 4+ frontend surfaces is nearly impossible to maintain
  - No community support for bug fixes, edge cases, or browser compatibility quirks
  - The team would spend more time building UI primitives than delivering business value

## Decision
We chose **Option A: TailwindCSS 4 + shadcn/ui**. TailwindCSS provides the utility-first styling foundation with native RTL support. shadcn/ui provides a curated set of accessible React components built on Radix UI primitives, copied as source code into the project for full ownership and customization.

Rationale:
1. **RTL is first-class, not an afterthought:** Tailwind's `rtl:` variant and CSS logical properties (`me-*` instead of `mr-*/ml-*`) mean RTL layouts require the same effort as LTR — direction-aware utilities handle the rest. Radix primitives respect the `dir` attribute natively.
2. **Accessibility is built in, not bolted on:** Radix UI primitives implement WAI-ARIA authoring practices. shadcn/ui components inherit keyboard navigation, focus trapping, screen-reader labels, and reduced-motion support. We meet WCAG 2.1 AA without building a11y from scratch.
3. **Full control through source ownership:** shadcn/ui copies component source into our repo (`packages/ui/src/components/`). Customization is editing our own code, not overriding library internals with CSS specificity hacks. This aligns with the monorepo philosophy (ADR-012) of shared, owned packages.
4. **Minimal CSS footprint:** Tailwind's JIT engine generates only the utility classes used in our codebase. Production CSS bundles stay under 10KB gzipped — critical for the public marketing site and store where Core Web Vitals matter for SEO (ADR-001).
5. **Design system consistency:** A shared `packages/ui` package in the monorepo (ADR-012) exports all shadcn/ui components with our theme tokens. Every frontend surface (marketing, store, admin, desktop) imports from the same component package — visual consistency is enforced by dependency, not convention.
6. **TailwindCSS 4 is CSS-first:** The configuration moves from JavaScript to CSS (`@theme` directive), reducing build tool complexity and aligning with web standards.

## Consequences

### Positive
- RTL support is native and consistent — every Tailwind utility and shadcn/ui component flips correctly when `dir="rtl"` is set on `<html>`. No per-component RTL workarounds.
- shadcn/ui source ownership means components evolve with our needs — add props, change internals, replace Radix primitives if needed — without waiting for an upstream release
- Radix primitives handle accessibility edge cases (focus guards in modals, arrow key navigation in menus, `aria-expanded` on toggles) that would take months to implement correctly from scratch
- Tailwind's utility classes reduce context-switching: styles live in JSX, not in separate `.css` files — faster iteration and easier refactoring
- The shared `packages/ui` package in the monorepo enforces design consistency — every surface uses the same Button, Dialog, Table, and theme tokens
- TailwindCSS 4's `@theme` directive and `@layer` system provide design tokens (colors, spacing, fonts, border radii) that shadcn/ui components consume — changing a brand color propagates everywhere
- CSS bundle is proportional to usage — unused Tailwind utilities and unused shadcn/ui components produce zero CSS

### Negative
- shadcn/ui component updates require manual action: run `npx shadcn-ui@latest add <component>` and resolve conflicts if we customized the source. There is no `npm update` equivalent.
- Tailwind's utility-class approach leads to long `className` strings — some developers find this reduces JSX readability compared to semantic class names
- Radix primitives sometimes render wrapper DOM elements that interfere with CSS grid/flex layouts — requires inspecting the rendered DOM and styling inner elements
- Components not in shadcn/ui's catalog (data grid, rich text editor, charts, drag-and-drop) require evaluating and integrating third-party libraries — each must be styled with Tailwind and verified for RTL compatibility
- TailwindCSS 4 is relatively new (2024) — some community plugins, extensions, and tutorials still reference v3 configuration patterns

### Risks
- **Risk 1: shadcn/ui upstream breaking changes when re-copying updated components** — Mitigation: Treat shadcn/ui source as a starting point, not a dependency. Customize components immediately after copying and maintain our own changelog. Only re-copy when a critical accessibility or security fix is published. Integrate visual regression tests (Storybook + Chromatic or Percy) to catch unintended visual changes.
- **Risk 2: Tailwind utility class explosion in complex components** — Mitigation: Extract repeated utility patterns into component variants using `cva` (class-variance-authority) or Tailwind's `@apply` directive in component CSS layers. Establish a team convention: if a className exceeds 10 utilities, extract a named variant.
- **Risk 3: Radix primitives changing their DOM structure or API in minor releases** — Mitigation: Pin Radix UI package versions exactly (no `^` ranges in `package.json`). Test Radix upgrades in isolation with visual regression tests before merging. shadcn/ui maintains compatibility with Radix versions — track their release notes.
- **Risk 4: TailwindCSS 4 ecosystem immaturity (plugins, tooling, community resources)** — Mitigation: Stick to core Tailwind features and well-maintained plugins (Tailwind CSS Forms, Typography). Avoid niche plugins with single maintainers. If a v3 plugin is essential but not yet ported to v4, evaluate whether the functionality can be replicated with `@theme` and `@utility` in our own CSS.
- **Risk 5: RTL edge cases in complex interactive components (date pickers, data tables, charts)** — Mitigation: Every component added to `packages/ui` must pass an RTL visual review in the PR checklist. Maintain an RTL-specific Storybook view. Third-party components that don't support RTL natively (charts from Recharts, data grids from TanStack Table) must be verified with wrapper components that handle direction flipping.

## Compliance
- All components in `packages/ui` must be sourced from shadcn/ui or explicitly approved for custom implementation
- Every UI component must render correctly in RTL — enforced by Storybook stories with `dir="rtl"` and a mandatory RTL preview in PR reviews
- Accessibility: all interactive components must pass `axe-core` automated audits in CI; manual keyboard navigation testing required for complex components (modals, menus, data tables)
- Tailwind class order must follow the `prettier-plugin-tailwindcss` auto-sorting convention — enforced by Prettier in the monorepo root config
- Third-party component additions must be evaluated against the criteria that drove this ADR: RTL support, accessibility, bundle size, and customization surface
- CSS bundle size must not exceed 50KB gzipped (total, all surfaces) — monitored via bundle analysis in CI

## Related Decisions
- [ADR-001: Next.js Frontend](./adr-001-nextjs-frontend.md) — TailwindCSS is the recommended CSS solution for Next.js; shadcn/ui is the recommended component library
- [ADR-005: TypeScript Across the Stack](./adr-005-typescript.md) — All shadcn/ui components are TypeScript; TailwindCSS 4 configuration uses TypeScript-safe CSS
- [ADR-012: Monorepo with Turborepo](./adr-012-monorepo-turborepo.md) — shadcn/ui components live in the shared `packages/ui` package; all frontend apps depend on it

## References
- [TailwindCSS 4 Documentation](https://tailwindcss.com/docs/v4-beta)
- [TailwindCSS RTL Support](https://tailwindcss.com/docs/hover-focus-and-other-states#rtl-support)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Radix UI Primitives](https://www.radix-ui.com/primitives)
- [Class Variance Authority (CVA)](https://cva.style/docs)
