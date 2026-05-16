# Session Flow

Workout sessions are client-side until the user taps **End**. Drafts are persisted locally so a closed tab or accidental navigation does not lose logged sets.

---

## Lifecycle

```text
Open Log -> Start Workout Session
        ↓
Session starts with today's effective workout day type, if one exists
        ↓
Choose exercise
  -> Search/filter with Fuse.js and scheduled muscle chips
  -> Recent Stats bottom sheet opens when history exists
        ↓
Log sets
  -> reps + weight + RPE
  -> set edits/deletes update in-memory state
  -> mini heatmap updates from primary muscles
  -> balance nudges compare live sets with current-week movement, muscle coverage, and remaining planned strength sessions
        ↓
Add more exercises or return to existing logged exercises
        ↓
Tap End
  -> infer best strength day type from worked muscles
  -> call `save_workout_session` RPC
  -> clear matching IndexedDB draft
  -> show session summary
```

Closing a session with logged sets prompts the user to keep the draft, discard, or return to the workout.

---

## Active Session State

Current shared type:

```typescript
type SessionState = {
  startTime: Date
  timerStartedAt: Date | null
  elapsedSeconds: number
  dayType: DayType | null
  exercises: Array<{
    exerciseId: string
    name: string
    sets: Array<{ reps: number; weight: number; rpe: number }>
    movementPattern: MovementPattern
    primaryMuscles: MuscleGroup[]
    secondaryMuscles: MuscleGroup[]
  }>
}
```

`timerStartedAt` is the running timer anchor. `elapsedSeconds` is accumulated duration before the current running anchor. Closing with **Keep draft** freezes the timer by folding the current wall-clock delta into `elapsedSeconds` and setting `timerStartedAt` to `null`; resuming starts a new anchor. If the app closes unexpectedly, a draft with a non-null anchor can reconstruct elapsed time from wall clock on reopen.

`e1rm`, `muscleGroupCoverage`, and balance scores are derived at render/query time, not stored in session state.

---

## Draft Persistence

Drafts live in IndexedDB:

```text
database: axis
object store: session_drafts
key: session.startTime.toISOString()
```

Autosave runs shortly after edits, every 30 seconds while a session is open, and when the page is hidden. The timer fields are serialized into the same IndexedDB record as the sets, so each draft write updates the session atomically from the app's perspective. On app load, `SessionProvider` checks IndexedDB and surfaces a resume/discard prompt. A successful save clears only the draft matching that session start time.

If autosave fails twice, the UI shows an autosave warning. If final save fails, the captured session is written back to IndexedDB and the user can retry.

---

## Save Path

The Log server action validates input before calling:

```sql
public.save_workout_session(
  p_start_time TIMESTAMPTZ,
  p_duration INT,
  p_day_type_id UUID,
  p_sets JSONB
)
```

The RPC repeats critical validation and inserts the `activities` row plus all `session_sets` in one database function call.

Day type inference uses worked primary muscles:

- Compare worked muscles with strength day-type `muscle_focus`.
- Pick the best overlap.
- Use the inferred day type when overlap is at least 30%; otherwise keep the scheduled day type.

---

## Recent Stats Panel

Opened when an exercise is selected and the user has prior sets for that exercise. If no history exists, it dismisses itself.

### Query Shape

```sql
SELECT
  set_number,
  reps,
  weight,
  rpe,
  created_at,
  activities.start_time
FROM session_sets
JOIN activities ON activities.id = session_sets.activity_id
WHERE exercise_id = $exercise_id
ORDER BY created_at DESC
LIMIT 50
```

The panel computes:

- Last session sets.
- All-time best e1RM.
- Last five session e1RM trend.
- One suggested set.

### Suggestion Logic

```javascript
const recentE1RMs = sessions.slice(0, 5).map(maxSessionE1RM)
const trend = e1RMFromMostRecentSession - e1RMFromThirdMostRecentSession

if (sessions.length < 3) {
  suggestion = bestSetFromMostRecentSession
} else if (trend > 2.5) {
  suggestion = { weight: lastWeight + increment, reps: lastReps, rpe: lastRpe }
} else if (trend >= 0) {
  suggestion = { weight: lastWeight, reps: lastReps + 1, rpe: lastRpe }
} else {
  suggestion = { weight: Math.max(0, lastWeight - increment), reps: lastReps, rpe: lastRpe }
}
```

The current session flow passes a 2.5-unit display increment.
