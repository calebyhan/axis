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

Axis computes balance from set counts, exercise `movement_pattern`, primary muscles, and secondary muscles. Movement patterns are used first; relevant isolation exercises with `movement_pattern = 'other'` can still count through their muscle assignments, so work like leg curls, lateral raises, and rear-delt fly is not invisible to balance guidance.

Live session guidance combines saved current-week work with the active unsaved session, then checks remaining planned strength sessions before showing compact nudges. Future plans are projected from `day_types.muscle_focus`, so a planned Pull or Legs day can suppress a current gap warning even before those sets are logged.

Balance uses target ranges rather than assuming every pair should be 50/50:

- Push/pull allows pull volume to run slightly ahead of push volume.
- Horizontal push/pull allows equal or pull-biased work.
- Quads/posterior chain counts hip hinges plus direct hamstring, glute, and lower-back isolation.
- Vertical push/pull uses a broader target range than horizontal work.
- Elbow flexion/extension uses a broad direct-arm range and is weighted below compound movement axes.
- Upper/lower is a coverage nudge, not part of the headline score.
- Front/rear delt emphasis allows rear-delt work to run ahead more than front-delt work.

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
- Run TL is duration-based and uses the user's active heart-rate zones when average heart rate is available, or manual perceived effort for manual runs. Strava subscriber-only `suffer_score` does not drive Strava run load.
- ATL = 7-day exponential weighted average.
- CTL = 42-day exponential weighted average.
- TSB = CTL - ATL.
- TSB labels: Fresh, Neutral, Fatigued, Overreaching.

### Running Zones

Heart-rate zones are method-based:

- `custom`: user-edited zone dividers.
- `strava`: live or cached Strava athlete zones, falling back to max-HR zones when unavailable.
- `max_hr`: simple 60/70/80/90% dividers from `profiles.max_heart_rate`.

The only HR zone suggestion is a transparent max-HR update: if recent activity max HR exceeds the stored max HR by more than two bpm, Settings can suggest updating `profiles.max_heart_rate`. The suggested card shows the current dividers, suggested dividers, and each changed boundary before the user accepts it.

Pace zones are still user-controlled with optional suggestions:

- Pace suggestions use stored Strava best efforts plus a small sample of recent Strava streams when available to estimate threshold pace.
- Suggestions can be accepted into `profiles.pace_zones` or ignored until the generated suggestion hash changes.

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
- User-configurable strength-balance target ranges.
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
