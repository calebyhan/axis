# Schedule & Day Types

Axis separates the repeating weekly plan, date-specific overrides, and historical adherence snapshots.

---

## Built-In Day Types

**Strength:** Push, Pull, Legs, Upper, Full Body

**Run/cardio:** Easy, Long, Intervals, Rest

`day_types.category` is either `strength` or `run`. Strength day types can define `muscle_focus`; run day types generally leave it null.

---

## Weekly Schedule

`weekly_schedule` stores one repeating row per user/day:

```text
day_of_week: 0 = Monday ... 6 = Sunday
day_type_id: optional workout slot
cardio_day_type_id: optional cardio slot
active: true/false
```

Settings displays the schedule Sunday-first, but the stored value remains ISO weekday order. Convert JavaScript dates with:

```javascript
const isoDay = (date.getDay() + 6) % 7
```

Date ranges for dashboard/adherence are Sunday-Saturday. `dateForISOWeekday()` maps ISO day values onto that displayed week.

---

## Overrides

`schedule_overrides` stores one-off changes for a specific `date` and `slot`.

```text
slot = 'workout' | 'cardio'
day_type_id = replacement day type
day_type_id = null means skip that slot
```

Dashboard checklist pills open the override modal. Selecting the planned type resets an existing override; selecting Skip stores a null override.

Changing the repeating schedule deletes current and future `planned_slots` snapshots so they can be regenerated from the new plan.

---

## Planned Slot Snapshots

`planned_slots` stores historical plan snapshots for adherence reporting.

Snapshots capture:

- `planned_day_type_id`: what the repeating schedule said.
- `effective_day_type_id`: what should count after overrides.
- `is_overridden`: whether a date-specific override changed the slot.
- `is_skipped`: whether the effective plan is an intentional skip.

Current and future weeks are refreshed when needed. Past weeks stay stable, so old adherence reports do not change when the user edits the current schedule.

---

## Activity Matching

`activityMatchesPlannedType()` implements the current type match:

- If an activity has `day_type_id`, it must equal the planned day type id.
- Run-category day types match `run` and `manual_run`.
- Strength day types match `workout`.
- Rest does not match activity.

The current implementation does not inspect suffer-score medians, distance thresholds, or muscle coverage thresholds for checklist completion.

---

## Checklist Matching

Dashboard checklist:

1. Build effective slots from `weekly_schedule` and current-week `schedule_overrides`.
2. Sort activities by `start_time`.
3. For each activity, find unmatched effective slots that match by type.
4. Assign the closest eligible slot by ISO day distance.
5. Group assigned slots back into day rows.

Adherence history uses similar greedy matching but compares actual activity date to slot date:

- `completed`: matched on the planned date.
- `swapped`: matched on a different date in the same week.
- `missed`: unmatched slot in the past.
- `pending`: unmatched slot today or later.
- `skipped`: intentional skip override.

---

## Calendar And Streak Rules

Calendar activity kinds:

- `workout` activity -> workout completion.
- `run`, `manual_run`, or `ride` activity -> cardio completion.
- Skip overrides count as the corresponding kind for the date.

If a plan has both workout and cardio, the day can show two completions. Rest slots can satisfy their side of the plan once the day has passed.

---

## Antagonist Pairs

Seeded movement pairs:

```sql
('horizontal_push', 'horizontal_pull')
('vertical_push', 'vertical_pull')
('quad_dominant', 'hip_hinge')
('elbow_flexion', 'elbow_extension')
```
