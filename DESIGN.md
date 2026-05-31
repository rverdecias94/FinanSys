---
name: Emerald Ledger
colors:
  surface: "#f8f9fb"
  surface-dim: "#d8dadc"
  surface-bright: "#f8f9fb"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f2f4f6"
  surface-container: "#eceef0"
  surface-container-high: "#e6e8ea"
  surface-container-highest: "#e0e3e5"
  on-surface: "#191c1e"
  on-surface-variant: "#3e4943"
  inverse-surface: "#2d3133"
  inverse-on-surface: "#eff1f3"
  outline: "#6e7a73"
  outline-variant: "#bdc9c1"
  surface-tint: "#006c4e"
  primary: "#00694c"
  on-primary: "#ffffff"
  primary-container: "#118461"
  on-primary-container: "#f5fff7"
  inverse-primary: "#76d9b0"
  secondary: "#536068"
  on-secondary: "#ffffff"
  secondary-container: "#d4e2eb"
  on-secondary-container: "#57656c"
  tertiary: "#565d61"
  on-tertiary: "#ffffff"
  tertiary-container: "#6e7679"
  on-tertiary-container: "#fafdff"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  primary-fixed: "#93f6cb"
  primary-fixed-dim: "#76d9b0"
  on-primary-fixed: "#002115"
  on-primary-fixed-variant: "#00513a"
  secondary-fixed: "#d7e5ee"
  secondary-fixed-dim: "#bbc9d1"
  on-secondary-fixed: "#101d24"
  on-secondary-fixed-variant: "#3c4950"
  tertiary-fixed: "#dce4e7"
  tertiary-fixed-dim: "#c0c8cb"
  on-tertiary-fixed: "#161d20"
  on-tertiary-fixed-variant: "#41484b"
  background: "#f8f9fb"
  on-background: "#191c1e"
  surface-variant: "#e0e3e5"
  background-dark: "#151f28"
  foreground-dark: "#fdfdfd"
  destructive: "#bf2626"
  success: "#16a34a"
  warning: "#ca8a04"
  chart-1: "#248f6b"
  chart-2: "#1e3a8a"
  chart-3: "#9333ea"
  chart-4: "#f59e0b"
  chart-5: "#ef4444"
typography:
  h1:
    fontFamily: Barlow
    fontSize: 30px
    fontWeight: "700"
    lineHeight: 36px
    letterSpacing: -0.02em
  h1-mobile:
    fontFamily: Barlow
    fontSize: 24px
    fontWeight: "700"
    lineHeight: 32px
  h2:
    fontFamily: Barlow
    fontSize: 20px
    fontWeight: "600"
    lineHeight: 28px
  body-base:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: "400"
    lineHeight: 24px
  body-base-tablet:
    fontFamily: Inter
    fontSize: 15.5px
    fontWeight: "400"
    lineHeight: 24px
  body-base-mobile:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "500"
    lineHeight: 20px
  label-xs:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: "600"
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-margin: 24px
  gutter: 16px
  sidebar-width: 240px
  header-height-mobile: 56px
---

## Brand & Style
The brand personality is **authoritative, precise, and sophisticated**. It targets finance professionals and business owners who require a tool that balances deep technical capability with a modern, high-velocity user interface.

The design follows a **Corporate / Modern** style with subtle **Minimalist** influences. It prioritizes data density and legibility without feeling cluttered. The interface relies on a structured grid, high-quality typography, and a "Emerald/Teal" primary accent to evoke a sense of growth, stability, and fiscal health. Visual hierarchy is established through meticulous spacing and tonal layering rather than aggressive decorative elements.

## Colors
The palette is centered around an **Emerald Teal** primary color, optimized for professional accounting contexts.

- **Primary:** Used for the main brand presence, active states in the sidebar, and primary call-to-action buttons.
- **Secondary & Muted:** These low-saturation blues (`#d6e4ed`) are used for surface backgrounds, input fields, and subtle borders to reduce eye strain during long sessions.
- **Neutral:** The background uses a cool, off-white gray to provide a clean canvas for data-heavy tables.
- **Semantic Colors:** Destructive red is reserved for alerts and deletions, while success green and warning amber are used strictly for financial status indicators (e.g., positive vs. negative cash flow).
- **Data Visualization:** A dedicated 5-color palette is provided for charts to ensure categorical distinction in reports.

## Typography
The system uses a dual-font strategy: **Barlow** for headlines to provide a confident, slightly condensed geometric feel, and **Inter** for all body text and UI labels to ensure maximum legibility at small sizes.

- **Headlines:** Use tight letter-spacing (`tracking-tight`) to maintain a professional, news-like density.
- **Body Text:** Sizes are dynamically adjusted across breakpoints, increasing slightly on mobile to improve touch-target context and readability.
- **Numbers:** In data tables and KPI cards, use tabular figures (if supported by the font) to ensure decimal points and digits align vertically.

## Layout & Spacing
The layout follows a **Hybrid Grid** model. Desktop views utilize a fixed-width sidebar (240px) with a fluid content area.

- **Grid:** Use a 12-column system for dashboard layouts. On Desktop, KPI cards span 2 or 5 columns, while charts utilize a 4:3 ratio (7 columns for primary data, 5 for secondary).
- **Rhythm:** All spacing is based on a **4px base unit**. Standard padding for cards and containers is `p-4` (16px) or `p-8` (32px) for high-impact screens like Authentication.
- **Responsivity:** On mobile (<768px), grids collapse to 1 or 2 columns. Tables must implement a native horizontal scroll (`overflow-x-auto`) to preserve data integrity.

## Elevation & Depth
The design system uses **Tonal Layers** combined with **Ambient Shadows** to create a sense of organized hierarchy.

- **Base Level:** The background is the lowest tier (`hsl(210 20% 97%)`).
- **Surface Level:** Cards and the Sidebar sit on the surface with a white or high-contrast background and a very soft, diffused shadow (`0_8px_30px_rgb(0,0,0,0.04)`).
- **Overlay Level:** Modals, Select Menus, and Tooltips use a more pronounced shadow and a 1px border (`border-border`) to separate them from the content beneath.
- **Interactions:** Use a 1px focus ring (`ring-primary`) to highlight active input states and keyboard navigation.

## Shapes
The shape language is consistently **Rounded**, using an **8px (0.5rem)** base radius for most components.

- **Components:** Buttons, Input fields, and Cards all use the `rounded-lg` (8px) standard.
- **Special Cases:** Small UI elements like Chips or checkboxes may use `rounded-md` (6px) to maintain visual balance at smaller scales.
- **Avatars/Logos:** For specific brand elements like the login logo, use fully rounded (circular) containers to create a distinct focal point.

## Components
- **Buttons:** Primary buttons use the Emerald Teal background with white text. Ghost variants are used for secondary actions like "Edit" or "Delete" within table rows to reduce visual noise.
- **Tables:** Headers must be semi-bold and muted. Rows should feature a subtle hover state (`bg-muted/50`) to help users track data horizontally.
- **Inputs:** Maintain a height of **44px (h-11)** for better touch accessibility. Use a light gray background that transitions to white on focus.
- **KPI Cards:** Display large, bolded numerical values. Incorporate 16px icons in the top right corner to categorize the metric (e.g., Wallet for balance).
- **Sidebar:** Navigation links should have a clear active state using the Primary Emerald color. Include a footer section for user profile management and plan status.
- **Tabs:** Use a "pill-in-container" style where the active tab has a white background and a subtle shadow, sitting inside a muted gray track.
