# Screen Specifications

Five tabs. Each has a single clear responsibility.

---

## Dashboard

At-a-glance view of the current week.

**Calendar with streak** — monthly mini-calendar, days with logged activity filled. Streak counter for consecutive active days. Tapping a day navigates to that day's activities.

**Weekly stats summary** — compact row: total distance, sessions completed, total volume lifted, body weight delta vs. last week.

**Week checklist** — driven by `weekly_schedule`. Each planned day type shown for the current week. Auto-checked when a matching session is logged (see [Schedule & Day Types](schedule.md) for matching algorithm). Flexible — swapping days around is handled by the greedy matching algorithm.

**Body weight sparkline** — last 30 days, 7-day rolling average overlaid.

**"Start Session" CTA** — primary accent color, full width on mobile. Same entry point as the Log tab.

---

## Activity

Chronological feed of all activities — runs and workouts interleaved.

**Filter chips:** All / Runs / Workouts

### Run cards
- Map thumbnail (GPS polyline from Strava)
- Distance, moving time, avg pace, avg HR, suffer score
- Tap → full view: full-size map, splits table, HR chart, HR zone breakdown, elevation profile

### Workout cards
- Muscle heatmap thumbnail — front/back body silhouette, worked muscles highlighted by volume intensity (see [Design System](design-system.md))
- Session duration, total volume, number of exercises
- Tap → full view: exercise-by-exercise breakdown with sets/reps/weight/RPE, e1RM achieved, linked Strava HR data if available

### Manual run cards
- Same as run cards without map thumbnail

---

## Log

Three entry points:

**Start Workout Session** — primary CTA, initiates full session flow (see [Session Flow](session-flow.md)).

**Log Run** — manual fallback form: distance, duration, perceived effort (1–5), notes. Stored as `source: 'manual'`.

**Log Body Weight** — single number field, timestamp auto-set to now. Upserts on `(user_id, date)` — re-entry replaces same-day value.

---

## Stats

Time filter: **Weekly** (default) / Monthly / Yearly / All Time

### Workout tab
- Volume over time
- e1RM per lift (movement dropdown selector)
- Muscle group frequency heatmap
- Push/pull/legs balance (stacked bar)
- PB timeline
- Session length trends
- Strength ratio tracking (OHP vs bench, deadlift vs squat — thresholds configurable in Settings)

### Running tab
- Weekly distance
- Pace trends
- Suffer score history
- HR zone breakdown
- Long run progression

### Body tab
- Weight line chart with 7-day rolling average
- Trend classification (gaining / maintaining / losing) via linear regression
- Recent weigh-in log

---

## Settings

- **Strava** — connect / disconnect, sync status, last synced timestamp
- **Units** — metric / imperial
- **Weight increments** — upper body (default 2.5 kg), lower body (default 5 kg)
- **Weekly schedule** — 7-day grid, assign day types, toggle days on/off
- **Day types** — view/edit Push/Pull/Legs/Easy/Long/Intervals library, add custom types
- **Volume landmarks** — min/max sets per muscle group per week (configurable)
- **Strength ratios** — OHP/bench and deadlift/squat target percentages (defaults: 65%, 120%)
- **Accent color** — 4 options
- **Data export** — download all activities, sessions, and body weight as JSON
