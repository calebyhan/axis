import { describe, expect, it } from "vitest";

import {
  computeStrengthBalance,
  projectDayTypeToStrengthInputs,
  rankExercisesForBalance,
  strengthInputsCoverNudge,
  strengthInputsFromExerciseSets,
  type StrengthBalanceInput,
} from "../strength-balance";
import type { DayType, Exercise } from "../../types";

function input(partial: Partial<StrengthBalanceInput> & Pick<StrengthBalanceInput, "movementPattern" | "sets">): StrengthBalanceInput {
  return {
    primaryMuscles: [],
    secondaryMuscles: [],
    muscleTags: [],
    ...partial,
  };
}

describe("computeStrengthBalance", () => {
  it("scores antagonist movement patterns from set counts", () => {
    const summary = computeStrengthBalance([
      input({
        movementPattern: "horizontal_push",
        primaryMuscles: ["chest", "front_delt", "triceps"],
        sets: 6,
      }),
      input({
        movementPattern: "horizontal_pull",
        primaryMuscles: ["upper_back", "lats", "rear_delt"],
        sets: 2,
      }),
    ], { scopeLabel: "today", nudgeLimit: 10 });

    expect(summary.axes.find((axis) => axis.id === "horizontal_push_pull")).toMatchObject({
      left: 6,
      right: 2,
      score: 33,
      status: "gap",
    });
    expect(summary.nudges.some((nudge) => nudge.message === "Heavy horizontal push today. Add a horizontal pull?")).toBe(true);
  });

  it("uses muscle emphasis for front and rear delt balance", () => {
    const summary = computeStrengthBalance([
      input({
        movementPattern: "horizontal_push",
        primaryMuscles: ["chest", "front_delt"],
        sets: 4,
      }),
      input({
        movementPattern: "horizontal_pull",
        secondaryMuscles: ["rear_delt"],
        sets: 2,
      }),
    ], { scopeLabel: "this week", nudgeLimit: 10 });

    expect(summary.axes.find((axis) => axis.id === "front_rear_shoulder")).toMatchObject({
      left: 4,
      right: 1,
      score: 25,
      status: "gap",
    });
    expect(summary.nudges.some((nudge) => nudge.message.includes("front-delt work"))).toBe(true);
  });

  it("groups saved set descriptors by exercise before scoring", () => {
    const inputs = strengthInputsFromExerciseSets([
      {
        exerciseId: "squat",
        name: "Back Squat",
        movementPattern: "quad_dominant",
        primaryMuscles: ["quads"],
        secondaryMuscles: ["glutes"],
      },
      {
        exerciseId: "squat",
        name: "Back Squat",
        movementPattern: "quad_dominant",
        primaryMuscles: ["quads"],
        secondaryMuscles: ["glutes"],
      },
      {
        exerciseId: "rdl",
        name: "Romanian Deadlift",
        movementPattern: "hip_hinge",
        primaryMuscles: ["hamstrings", "glutes"],
      },
    ]);

    expect(inputs).toEqual([
      expect.objectContaining({ exerciseId: "squat", sets: 2 }),
      expect.objectContaining({ exerciseId: "rdl", sets: 1 }),
    ]);
    expect(computeStrengthBalance(inputs).axes.find((axis) => axis.id === "quad_hinge")).toMatchObject({
      left: 2,
      right: 1,
      score: 50,
    });
  });

  it("nudges toward the low biceps head bias", () => {
    const summary = computeStrengthBalance([
      input({
        movementPattern: "elbow_flexion",
        primaryMuscles: ["biceps"],
        muscleTags: ["biceps_short_head"],
        sets: 5,
      }),
    ], { scopeLabel: "this week", nudgeLimit: 10 });

    const nudge = summary.nudges.find((candidate) => candidate.id === "biceps-head-bias:biceps_long_head");
    expect(summary.nudges[0]?.id).toBe("biceps-head-bias:biceps_long_head");
    expect(nudge).toMatchObject({
      suggestedTags: ["biceps_long_head"],
      score: 0,
    });
    expect(nudge?.message).toContain("short-head biased");
  });

  it("nudges toward hammer curls when supinated curl work is ahead", () => {
    const summary = computeStrengthBalance([
      input({
        movementPattern: "elbow_flexion",
        primaryMuscles: ["biceps"],
        muscleTags: ["biceps_long_head", "biceps_short_head"],
        sets: 5,
      }),
    ], { scopeLabel: "this week", nudgeLimit: 10 });

    expect(summary.nudges.find((candidate) => candidate.id === "biceps-brachialis-low")).toMatchObject({
      suggestedTags: ["brachialis", "brachioradialis"],
      score: 0,
    });
  });
});

describe("rankExercisesForBalance", () => {
  it("prioritizes exercises that match the current low side", () => {
    const summary = computeStrengthBalance([
      input({
        movementPattern: "horizontal_push",
        primaryMuscles: ["chest", "front_delt", "triceps"],
        sets: 5,
      }),
    ], { scopeLabel: "today", nudgeLimit: 10 });

    const exercises: Exercise[] = [
      {
        id: "bench",
        name: "Bench Press",
        category: "push",
        movement_pattern: "horizontal_push",
        primary_muscles: ["chest", "front_delt", "triceps"],
        secondary_muscles: [],
        muscle_tags: [],
        equipment: "barbell",
        is_custom: false,
      },
      {
        id: "row",
        name: "Chest Supported Row",
        category: "pull",
        movement_pattern: "horizontal_pull",
        primary_muscles: ["upper_back", "lats", "rear_delt"],
        secondary_muscles: ["biceps"],
        muscle_tags: [],
        equipment: "machine",
        is_custom: false,
      },
    ];

    expect(rankExercisesForBalance(exercises, summary.nudges)[0]).toBe("row");
  });

  it("prioritizes tag-specific curl variations for biceps-bias nudges", () => {
    const summary = computeStrengthBalance([
      input({
        movementPattern: "elbow_flexion",
        primaryMuscles: ["biceps"],
        muscleTags: ["biceps_long_head"],
        sets: 5,
      }),
    ], { scopeLabel: "today", nudgeLimit: 10 });

    const exercises: Exercise[] = [
      {
        id: "incline",
        name: "Incline Dumbbell Curl",
        category: "pull",
        movement_pattern: "elbow_flexion",
        primary_muscles: ["biceps"],
        secondary_muscles: ["forearm"],
        muscle_tags: ["biceps_long_head"],
        equipment: "dumbbell",
        is_custom: false,
      },
      {
        id: "preacher",
        name: "Preacher Curl",
        category: "pull",
        movement_pattern: "elbow_flexion",
        primary_muscles: ["biceps"],
        secondary_muscles: ["forearm"],
        muscle_tags: ["biceps_short_head"],
        equipment: "barbell",
        is_custom: false,
      },
      {
        id: "hammer",
        name: "Hammer Curl",
        category: "pull",
        movement_pattern: "elbow_flexion",
        primary_muscles: ["biceps"],
        secondary_muscles: ["forearm"],
        muscle_tags: ["brachialis", "brachioradialis"],
        equipment: "dumbbell",
        is_custom: false,
      },
    ];

    expect(rankExercisesForBalance(exercises, summary.nudges)[0]).toBe("preacher");
  });
});

describe("projectDayTypeToStrengthInputs", () => {
  it("projects future pull days into pull movement and muscle coverage", () => {
    const pullDay: DayType = {
      id: "pull",
      name: "Pull",
      category: "strength",
      muscle_focus: ["upper_back", "lats", "biceps", "rear_delt"],
    };

    expect(projectDayTypeToStrengthInputs(pullDay).map((input) => input.movementPattern)).toEqual([
      "horizontal_pull",
      "vertical_pull",
      "elbow_flexion",
    ]);
  });

  it("can tell when a future planned day covers a current nudge", () => {
    const current = computeStrengthBalance([
      input({
        movementPattern: "horizontal_push",
        primaryMuscles: ["chest", "front_delt", "triceps"],
        sets: 6,
      }),
    ], { scopeLabel: "this week", nudgeLimit: 10 });
    const horizontalPullNudge = current.nudges.find((nudge) => nudge.axisId === "horizontal_push_pull");
    const pullProjection = projectDayTypeToStrengthInputs({
      id: "pull",
      name: "Pull",
      category: "strength",
      muscle_focus: ["upper_back", "lats", "biceps", "rear_delt"],
    });

    expect(horizontalPullNudge).toBeTruthy();
    expect(strengthInputsCoverNudge(pullProjection, horizontalPullNudge!)).toBe(true);
  });

  it("does not let generic pull projections cover tag-specific biceps nudges", () => {
    const current = computeStrengthBalance([
      input({
        movementPattern: "elbow_flexion",
        primaryMuscles: ["biceps"],
        muscleTags: ["biceps_short_head"],
        sets: 5,
      }),
    ], { scopeLabel: "this week", nudgeLimit: 10 });
    const tagNudge = current.nudges.find((nudge) => nudge.id === "biceps-head-bias:biceps_long_head");
    const pullProjection = projectDayTypeToStrengthInputs({
      id: "pull",
      name: "Pull",
      category: "strength",
      muscle_focus: ["upper_back", "lats", "biceps", "rear_delt"],
    });

    expect(tagNudge).toBeTruthy();
    expect(strengthInputsCoverNudge(pullProjection, tagNudge!)).toBe(false);
  });
});
