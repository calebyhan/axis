# Session Flow

Covers the full workout session lifecycle and the Recent Stats panel surfaced during exercise selection.

---

## Session Lifecycle

```
Tap "Start Session"
        ↓
Session record created (start_time stored)
Today's planned day type surfaced as context
        ↓
Add Exercise
  → Fuzzy search (fuse.js) or browse list
  → Recent Stats panel slides up
  → User reviews, dismisses panel
        ↓
Log Sets
  → Reps + Weight + RPE per set
  → Running e1RM shown after each set
  → "Add Set" for subsequent sets
        ↓
Finish Exercise
  → Muscle coverage updated in session state
  → Next exercise suggestions surfaced (3–4 chips)
  → User accepts or adds different exercise
        ↓
Repeat
        ↓
Tap "End Session"
  → Session summary shown
  → Prompted to link Strava activity (optional)
  → HR data merged if linked
  → Full session written to Supabase in single transaction
  → IndexedDB draft cleared
```

---

## Active Session State (In-Memory React State)

```typescript
type SessionState = {
  startTime: Date
  dayType: DayType
  exercises: Array<{
    exerciseId: string
    name: string
    sets: Array<{ reps: number; weight: number; rpe: number; e1rm: number }>
    primaryMuscles: string[]
    secondaryMuscles: string[]
  }>
  muscleGroupCoverage: Record<string, number>  // muscle → total sets worked
}
```

**Draft autosave:** state is written to IndexedDB every 60 seconds, keyed by `startTime`. On app open, if a draft exists, the user is prompted to resume or discard. On "End Session," the draft is cleared and the full session is written to Supabase in a single transaction (preventing partial session records).

---

## Recent Stats Panel

Bottom sheet surfaced when an exercise is selected. Glanceable and dismissible — reference material, not a gate.

### Query

```sql
SELECT
  s.created_at AS session_date,
  ss.set_number,
  ss.reps,
  ss.weight,
  ss.rpe,
  ss.weight * (1 + ss.reps / 30.0) AS e1rm
FROM session_sets ss
JOIN activities s ON ss.activity_id = s.id
WHERE ss.exercise_id = $exercise_id
  AND s.user_id = $user_id
ORDER BY s.created_at DESC
LIMIT 50
```

Everything else is computed client-side from this single result set.

### Panel Contents

- **Last session** — exact sets, reps, weight, RPE
- **All-time best** — highest e1RM and date achieved
- **5-session trend** — sparkline of e1RM over last 5 sessions
- **Average RPE at current weight** — fatigue calibration
- **Suggested target** — one tappable chip (pre-fills first set if accepted)

### Suggestion Logic

```javascript
const recentE1RMs = last3Sessions.map(s => maxE1RM(s.sets))
const trend = recentE1RMs[0] - recentE1RMs[2]

if (trend > 2.5) {
  // Progressing — small weight increase
  suggestion = { weight: lastWeight + increment, reps: lastReps }
} else if (trend >= 0) {
  // Flat — same weight, more reps
  suggestion = { weight: lastWeight, reps: lastReps + 1 }
} else {
  // Regressing — back off slightly
  suggestion = { weight: lastWeight - increment, reps: lastReps }
}
// increment: 2.5 kg upper body, 5 kg lower body (user-configurable in Settings)
```
