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

### Smart Strength Guidance

Axis computes balance from set counts, exercise `movement_pattern`, primary muscles, and secondary muscles.

Live session guidance combines saved current-week work with the active unsaved session, then checks remaining planned strength sessions before showing compact nudges. Future plans are projected from `day_types.muscle_focus`, so a planned Pull or Legs day can suppress a current gap warning even before those sets are logged.

- Push/pull.
- Horizontal push/pull.
- Quad/hinge.
- Vertical push/pull.
- Elbow flexion/extension.
- Upper/lower.
- Front/rear delt emphasis.

The same scoring engine powers post-session summaries, weekly dashboard context, and workout stats. Exercise search can prioritize movements or muscles that match the current low side when the rest of the plan does not already cover it.

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
- Run TL is duration-based and uses average heart rate when available, or manual perceived effort for manual runs. Strava subscriber-only `suffer_score` does not drive training load.
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

### Push Notifications

Opt-in Web Push notifications cover:

- Today's remaining planned workout/cardio slots.
- Pending Strava workout-link resolution after webhook processing.
- Same-day planned slots still pending at the user's configured nudge time.
- Weekly review of the previous seven days.

---

## Planned / Not Yet Implemented

These ideas are referenced by product direction but are not current behavior:

- User-configurable volume ceilings.
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

### Run Training Load

```text
min(200, duration_minutes * intensity_multiplier)
```

### ATL / CTL / TSB

```text
ATL = previousATL * (1 - 1/7)  + dailyTL * (1/7)
CTL = previousCTL * (1 - 1/42) + dailyTL * (1/42)
TSB = CTL - ATL
```

See [Database — Derived Data](database.md#derived-data) for details.
