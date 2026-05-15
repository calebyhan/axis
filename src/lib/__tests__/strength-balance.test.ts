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
        equipment: "machine",
        is_custom: false,
      },
    ];

    expect(rankExercisesForBalance(exercises, summary.nudges)[0]).toBe("row");
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
});
