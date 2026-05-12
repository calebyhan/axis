# Design System

Axis is dark-only with a restrained, data-focused interface.

---

## Tokens

Defined primarily in `src/app/globals.css` and `tailwind.config.ts`.

| Token | Value |
|---|---|
| `--background` | `#050505` |
| `--surface` | `rgba(18, 18, 18, 0.72)` |
| `--surface-strong` | `rgba(20, 20, 20, 0.9)` |
| `--surface-soft` | `rgba(255, 255, 255, 0.03)` |
| `--border` | `rgba(255, 255, 255, 0.1)` |
| `--border-strong` | `rgba(255, 255, 255, 0.16)` |
| `--muted` | `#9A9A9A` |
| Primary text | `#FFFFFF` |
| Default accent | `#3B82F6` |

Accent variants:

```text
blue   #3B82F6
green  #22C55E
orange #F97316
purple #A855F7
```

`data-accent` on the document drives `--accent` and `--accent-rgb`.

---

## Typography

Font stack:

```css
"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont,
var(--font-geist-sans, Inter, system-ui, sans-serif)
```

Tailwind also defines Geist/Inter-based `sans` and Geist Mono `mono` families.

---

## Layout

- `.page-shell`: max width `72rem`, centered, safe-area top padding, bottom-nav padding.
- Mobile reserves `--nav-h` for the bottom tab bar and `--top-h` for iOS status-bar space.
- Desktop uses a sidebar; mobile uses a bottom tab bar.
- Common cards use `.card`: `--surface-strong`, `1px solid --border`, `0.75rem` radius.
- `.card-soft` is used for lighter framed surfaces.

---

## PWA Safe Areas

Global helpers:

- `.pb-nav` prevents bottom sheets and scroll containers from sitting behind the bottom nav.
- `.pt-top` offsets content from mobile safe-area top.
- `.mobile-top-fade` keeps scrolled content readable beneath the iOS status area.

---

## Muscle Heatmap

Implemented in `src/components/heatmap/MuscleHeatmap.tsx` as inline SVG. It renders front and back body views from path data; no image assets are required.

Each muscle group renders as:

```html
<g id="{prefix}-{muscle}" data-muscle="{muscle}">
```

Color interpolates from empty `#1f1f1f` to the current accent based on set count relative to the max count in the displayed period.

Interactive heatmaps can show tooltip detail buckets built from recent workout data.

### Muscle IDs

```text
chest, front_delt, rear_delt, triceps, biceps, forearm,
upper_back, lats, traps, lower_back,
glutes, quads, hamstrings, calves, hip_flexors, adductors,
abs, obliques
```

These IDs must match `exercises.primary_muscles` and `exercises.secondary_muscles`.

---

## Components And Patterns

- Segmented buttons are used for units, time ranges, and active tabs.
- Accent color swatches are circular buttons.
- Settings schedule rows use select menus for workout and cardio slots.
- Modal/bottom-sheet shells use fixed full-screen overlays on mobile and constrained centered panels on desktop.
- Activity and dashboard visualizations use Recharts with shared tooltip props from `src/components/stats/chartTheme.ts`.
