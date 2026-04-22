# Schedule & Day Types

---

## Built-in Day Types

**Strength:** Push · Pull · Legs · Upper · Full Body

**Run:** Easy / Recovery · Long · Intervals / Tempo · Rest

User can add custom types in Settings → Day types.

---

## Weekly Schedule

Stored in the `weekly_schedule` table as a repeating 7-day pattern. Each row maps a day of the week to a day type.

**`day_of_week` convention:** 0 = Monday … 6 = Sunday (ISO week order).  
This differs from `Date.getDay()` in JavaScript (0 = Sunday). Frontend must convert:

```javascript
const isoDay = (jsDay + 6) % 7
```

---

## Checklist Matching Rules

Each session type is matched against planned day types using coverage thresholds derived from `session_sets` joined to `exercises`:

| Planned day type | Match condition |
|---|---|
| Push | Workout with > 50% push muscle coverage |
| Pull | Workout with > 50% pull muscle coverage |
| Legs | Workout with > 50% lower body coverage |
| Upper | Workout with > 50% upper body coverage |
| Full Body | Workout with coverage across both upper and lower |
| Long run | Strava run above distance threshold (user-configurable) |
| Intervals | Strava run with suffer score above personal suffer score median |
| Easy run | Strava run below personal suffer score median |

---

## Checklist Matching Algorithm

Greedy assignment by temporal proximity — handles swapped days without requiring an exact day match.

1. Collect all planned day types for the week from `weekly_schedule`
2. Collect all logged sessions for the week
3. For each session (sorted ascending by `start_time`), find the closest unmatched planned day type that the session satisfies (using the rules above)
4. Assign greedily — earliest session gets first pick among eligible unmatched planned days
5. Unmatched planned days remain unchecked
6. Sessions logged beyond the planned count are ignored for checklist purposes

---

## Antagonist Pairs Seed Data

Used by the antagonist pairing flag mid-session.

```sql
INSERT INTO antagonist_pairs VALUES
  ('horizontal_push', 'horizontal_pull'),
  ('vertical_push',   'vertical_pull'),
  ('quad_dominant',   'hip_hinge'),
  ('elbow_flexion',   'elbow_extension');
```
