import { describe, expect, it } from "vitest";

import { searchExercises } from "../exercise-search";
import type { Exercise } from "../../types";

function exercise(partial: Partial<Exercise> & Pick<Exercise, "id" | "name">): Exercise {
  return {
    category: "strength",
    movement_pattern: "other",
    primary_muscles: [],
    secondary_muscles: [],
    muscle_tags: [],
    equipment: "barbell",
    is_custom: false,
    ...partial,
  };
}

const exercises: Exercise[] = [
  exercise({
    id: "bench",
    name: "Bench Press",
    movement_pattern: "horizontal_push",
    primary_muscles: ["chest", "front_delt", "triceps"],
  }),
  exercise({
    id: "squat",
    name: "Back Squat",
    movement_pattern: "quad_dominant",
    primary_muscles: ["quads", "glutes"],
    secondary_muscles: ["lower_back"],
  }),
  exercise({
    id: "rdl",
    name: "Romanian Deadlift",
    movement_pattern: "hip_hinge",
    primary_muscles: ["hamstrings", "glutes"],
    secondary_muscles: ["lower_back"],
  }),
  exercise({
    id: "pulldown",
    name: "Lat Pulldown",
    movement_pattern: "vertical_pull",
    primary_muscles: ["lats", "upper_back"],
    secondary_muscles: ["biceps"],
    equipment: "cable",
  }),
];

describe("searchExercises", () => {
  it("matches muscle group names and aliases", () => {
    expect(searchExercises(exercises, "quads").map((result) => result.id)).toContain("squat");
    expect(searchExercises(exercises, "quad").map((result) => result.id)).toContain("squat");
    expect(searchExercises(exercises, "quadriceps").map((result) => result.id)).toContain("squat");
  });

  it("keeps exact exercise names ahead of broad muscle aliases", () => {
    expect(searchExercises(exercises, "back squat")[0]?.id).toBe("squat");
  });

  it("matches equipment and movement patterns", () => {
    expect(searchExercises(exercises, "cable").map((result) => result.id)).toContain("pulldown");
    expect(searchExercises(exercises, "hinge").map((result) => result.id)).toContain("rdl");
  });
});
