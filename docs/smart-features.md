# Smart Features

Axis intelligence is rule-based TypeScript and SQL. There are no LLM APIs or external AI services in the current implementation.

---

## Implemented

### Workout Context

- Today's effective workout day type is loaded from `weekly_schedule` plus `schedule_overrides`.
- Exercise search defaults to the scheduled strength day type's `muscle_focus` when available.
- Exercise search uses Fuse.js over exercise name/category after muscle filtering.

### Recent Stats Panel

When an exercise has prior logged sets, the session flow shows:

- Last session sets.
- All-time best e1RM.
- Last five session e1RM trend.
- One suggested set based on recent e1RM trend.

### Session Coverage

The live session mini heatmap counts primary-muscle sets in the current in-memory session.

### Weekly Muscle Coverage

Dashboard and Stats summarize primary-muscle coverage from saved `session_sets`.

### Plan Adherence

Adherence is computed from effective planned slots and logged activities:

- `completed`: matched on planned date.
- `swapped`: matched in the same week on a different date.
- `missed`: unmatched past slot.
- `pending`: unmatched current/future slot.
- `skipped`: intentional skip override.

### Training Load

Stats Load computes:

- Daily TL = run TL + normalized strength TL.
- ATL = 7-day exponential weighted average.
- CTL = 42-day exponential weighted average.
- TSB = CTL - ATL.
- TSB labels: Fresh, Neutral, Fatigued, Overreaching.

### Running PRs

Strava `best_efforts` with `pr_rank = 1` are surfaced in the Running stats tab and link back to the activity detail page.

### Body Weight Trend

The Body stats tab classifies weight trend with linear regression over stored kilograms:

- `> +0.2 kg/week` -> gaining.
- `< -0.2 kg/week` -> losing.
- otherwise -> maintaining.

### Strava Workout Biometrics

Unsupported Strava activity types can enrich a workout if they overlap by time. One clear candidate is auto-linked; multiple candidates create a pending link for user resolution.

---

## Planned / Not Yet Implemented

These ideas are referenced by product direction but are not current behavior:

- Push/pull imbalance warnings.
- Antagonist pairing nudges during a session.
- User-configurable volume ceilings.
- Next-exercise ranked suggestions beyond the current exercise search filtering.
- Post-session balance score.
- Progressive overload warnings outside the recent-stats panel.
- Template-based set completion rate.
- Automated weekly summary generation through `weekly_summaries`.
- Distance-threshold and suffer-score-median plan matching.
- Strength-ratio tracking thresholds.
- Deload detection.

---

## Core Formulas

### e1RM

```text
weight * (1 + reps / 30)
```

### Strength Training Load

```text
min(200, SUM(reps * weight * rpe) / 1000)
```

### ATL / CTL / TSB

```text
ATL = previousATL * (1 - 1/7)  + dailyTL * (1/7)
CTL = previousCTL * (1 - 1/42) + dailyTL * (1/42)
TSB = CTL - ATL
```

See [Database — Derived Data](database.md#derived-data) for details.
