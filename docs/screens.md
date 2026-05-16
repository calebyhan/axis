# Screen Specifications

Main authenticated routes are Dashboard, Activity, Log, Stats, and Settings.

---

## Dashboard

Weekly overview for the signed-in user.

- **Weekly stats summary:** run distance, workout count, lifted volume, and body-weight delta.
- **Weekly adherence:** current week plan completion from `planned_slots`/adherence logic.
- **Calendar streak:** current-month calendar with active-day intensity and streak count. Planned rest/skip days can satisfy the calendar where appropriate.
- **Planned sessions:** workout/cardio checklist from `weekly_schedule` plus `schedule_overrides`. Tapping a pill opens an override modal for that date/slot.
- **Weekly muscle coverage:** front/back heatmap for primary muscles trained this week.
- **Body weight sparkline:** last 30 days with rolling context.

---

## Activity

Chronological feed of Strava runs/rides, manual runs, and workouts.

**Filters:** All / Runs / Workouts

### Run/Ride Cards

- Route thumbnail when `summary_polyline` exists.
- Distance, duration, pace/speed context, heart rate, suffer score, elevation/cadence where available.
- Detail view includes full map, splits, best efforts, HR/stream charts, and zone overlays when available.

### Workout Cards

- Muscle heatmap thumbnail from `session_sets -> exercises.primary_muscles`.
- Duration, total volume, and exercise count.
- Detail view shows exercise-by-exercise sets/reps/weight/RPE and supports editing sets.
- Workouts can receive linked Strava biometric fields through webhook auto-linking or pending-link resolution.

### Pending Strava Links

When one Strava activity could match multiple workouts, Activity surfaces a resolution panel. The user can link it to one candidate or dismiss it.

---

## Log

Primary manual input surface.

- **Today's plan:** workout/cardio slots for the current date, after overrides.
- **Resume draft:** appears when an active or saved workout draft exists.
- **Start Workout Session:** opens the full session flow.
- **Log Run:** imports recent Strava activities or saves a manual run.
- **Log Body Weight:** upserts one body-weight value per date.
- **Strava import preview:** shows the newest unimported supported Strava activity from the last 90 days.
- **Recent context:** most recent workout, run, and weigh-in.

---

## Stats

Time filter: Week / Month / Year / All.

### Overview Tab

- Landing summary with training status, adherence, active days, range KPIs, and prior-period deltas.
- Workload section: daily table for Week, grouped training-load chart for longer ranges.
- Status section for notable plan, strength, running, balance, load, PR, and body-weight changes.
- Training-area rows for Strength, Running, Body, and Load & Plan, each with compact trend context.
- Range leaders for top exercise, strongest volume period, longest run, and latest PR.

### Workout Tab

- Session count, total sets, total volume.
- Muscle coverage heatmap for the selected range.
- Weekly volume chart.
- Top exercises by lifted volume.

### Running Tab

- Total distance, run count, best pace, average HR.
- Personal records from Strava best efforts.
- Distance, pace, suffer score, and heart-rate trend charts.

### Body Tab

- Current weight, range change, min/max.
- Body-weight chart with 7-day rolling average.
- Trend classification from linear regression.
- Recent weigh-in list.

### Load Tab

- CTL, ATL, and TSB cards.
- Fitness/fatigue chart, form chart, and daily training-load bar chart.
- TSB labels: Fresh, Neutral, Fatigued, Overreaching.

### Plan Tab

- Adherence, completed, missed, and skipped totals.
- Historical calendar for the All range.
- Weekly plan follow-through chart.
- Current-week slot table with completed/swapped/missed/pending/skipped states.

---

## Settings

- **Weekly schedule:** Sunday-first display with separate Workout and Cardio selectors. Stored with ISO `day_of_week` values.
- **Schedule summary:** strength days, cardio days, active days, full rest days, and weekly muscle-focus heatmap.
- **Profile:** display name override.
- **Preferences:** units and accent color.
- **Notifications:** opt-in push subscription, today plan reminder, pending Strava links, plan nudge, and weekly review timing.
- **Strava:** connect/disconnect state.
- **Data & Storage:** JSON export and offline-cache clearing.
- **Account:** sign out.
