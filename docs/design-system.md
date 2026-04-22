# Design System

---

## Visual Tokens

| Property | Value |
|---|---|
| Background | `#0A0A0A` |
| Card surface | `#141414` |
| Border | `1px solid #1F1F1F` |
| Primary text | `#FFFFFF` |
| Muted text | `#666666` |
| Accent | `#3B82F6` (electric blue, user-selectable from 4 options) |
| Chart axes | `#2A2A2A` |
| Typography | Inter or Geist |

**Principles:** Matte black, minimalist, generous negative space. No gradients, no glassmorphism, no drop shadows. Accent used sparingly — CTAs and active states only.

---

## Muscle Heatmap

Front/back body SVG with named paths per muscle group. Used on:
- Workout cards in the Activity feed (thumbnail)
- Mid-session live coverage tracker
- Pre-session muscle recency map

**Shading:** Each muscle path is shaded from `#1F1F1F` (untrained / zero sets) to the accent color (high volume). Intensity is driven by set count relative to the session or period total.

**Implementation:** Pure SVG — each muscle group is a `<path id="chest">`, `<path id="hamstrings">`, etc. Color is applied via CSS or inline style. No image assets, works fully offline.

**Muscle group IDs used across the system:**

```
chest, front_delt, rear_delt, triceps, biceps, forearm
upper_back, lats, traps, lower_back
glutes, quads, hamstrings, calves, hip_flexors, adductors
abs, obliques
```

These IDs must match `exercises.primary_muscles` and `exercises.secondary_muscles` values exactly for coverage calculation to work correctly.

---

## Mobile Layout

- Bottom tab bar with icons — Dashboard, Activity, Log, Stats, Settings
- Thumb-optimized tap targets (minimum 44 × 44 px)
- Full-width CTAs (Start Session, End Session)
- Bottom sheets for panels (Recent Stats, session summary)

## Desktop Layout

- 240 px left sidebar with same navigation items vertically
- Main content area takes remaining width
