# Smart Features

All intelligence is rule-based — SQL queries and client-side JavaScript. No LLM APIs, no external AI services.

---

## Pre-Session

Shown on the session start screen before the first exercise is added.

| Feature | Logic |
|---|---|
| Muscle recency map | `MAX(session_date)` per muscle group — visual grid showing days since each muscle was last trained |
| Push/pull balance warning | If `push_sets > pull_sets × 1.5` over last 14 days, surface a flag |
| ATL context | If weekly load > 120% of 4-week average, surface a recovery note |
| Day type context | Today's planned day type shown; biases exercise suggestions and next-exercise chip ordering |

---

## Mid-Session

Real-time feedback as sets are logged.

| Feature | Logic |
|---|---|
| Live coverage tracker | In-memory set count per muscle group from session state; renders as mini heatmap |
| Antagonist pairing flag | If push sets logged and zero pull sets after 20 min, surface a nudge |
| Volume ceiling warning | If any muscle group exceeds 10 sets, flag it (threshold user-configurable via volume landmarks in Settings) |
| Next exercise suggestion | Score each exercise: `score = (target_sets - current_sets) × 2 + days_since_last_trained`. Rank descending. Surface top 3–4 chips. Falls back to all exercises in category if no history exists. |
| Exercise search ranking | Same scoring applied to unfiltered list before user types; fuse.js re-ranks by query match on top |

---

## Post-Session

Shown in the session summary after "End Session."

| Feature | Logic |
|---|---|
| Session balance score | "70% push, 30% pull — last 3 sessions have been push-dominant" |
| Progressive overload flag | Linear regression over last 5 e1RM values; flag if slope is flat or negative for 3+ sessions |
| RPE trend per exercise | If RPE trending up at same weight over recent sessions, flag fatigue |
| Set completion rate | If using a template: planned sets vs. logged sets; flag chronic shortfall |

---

## Weekly

Computed by a Supabase Edge Function triggered by `pg_cron` every Sunday (requires Supabase Pro plan). Results stored in `weekly_summaries` and displayed in-app on next open.

| Feature | Logic |
|---|---|
| Week in Review | Template-based string summary (see examples below) |
| Interference warning | High-suffer run within 24 hr of a leg session — threshold derived from personal suffer score median |
| Body weight trend | Linear regression over last 14 days — slope > +0.2 kg/week = gaining, < −0.2 kg/week = losing, else maintaining |
| Strength ratio tracking | OHP ≈ 65% bench, deadlift ≈ 120% squat — track actuals vs. configurable benchmarks |
| Deload detection | High volume for 3+ consecutive weeks + stalling e1RMs simultaneously → suggest deload |

### Week in Review Template Examples

```
"You've had ${n} hard weeks in a row — consider a down week next week."
"Pull volume has been low for 2 weeks — posterior chain may be underserved."
"Your running load is up ${pct}% this week — go easy on legs tomorrow."
"You set ${n} personal records this week — great week."
```

---

## Training Load Model (ATL / CTL / TSB)

Used by the ATL context warning pre-session and the interference warning weekly.

See [Database — Derived Data](database.md#atl--ctl--tsb-training-load-model) for the full formula.
