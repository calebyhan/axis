import type { ActivitySplits, Split, Units } from "@/types";

const METERS_PER_KILOMETER = 1000;
const METERS_PER_MILE = 1609.344;
const EPSILON = 0.001;

type SplitGroups = {
  metric: Split[];
  standard: Split[];
};

type SplitAccumulator = {
  split: number;
  distance: number;
  elapsedTime: number;
  movingTime: number;
  elevationDifference: number;
  heartrateWeight: number;
  heartrateTotal: number;
  gradeAdjustedTime: number;
  hasGradeAdjustedSpeed: boolean;
};

function finite(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function splitArray(value: Split[] | null | undefined): Split[] {
  return Array.isArray(value) ? value : [];
}

function splitGroups(splits: ActivitySplits | null | undefined): SplitGroups {
  if (!splits) return { metric: [], standard: [] };
  if (Array.isArray(splits)) return { metric: splits, standard: [] };

  return {
    metric: splitArray(splits.metric),
    standard: splitArray(splits.standard),
  };
}

function createAccumulator(split: number): SplitAccumulator {
  return {
    split,
    distance: 0,
    elapsedTime: 0,
    movingTime: 0,
    elevationDifference: 0,
    heartrateWeight: 0,
    heartrateTotal: 0,
    gradeAdjustedTime: 0,
    hasGradeAdjustedSpeed: false,
  };
}

function addPortion(accumulator: SplitAccumulator, source: Split, portionDistance: number) {
  const sourceDistance = finite(source.distance);
  if (sourceDistance <= 0 || portionDistance <= 0) return;

  const ratio = portionDistance / sourceDistance;
  const movingTime = finite(source.moving_time) * ratio;
  const averageHeartrate = finite(source.average_heartrate);
  const gradeAdjustedSpeed = finite(source.average_grade_adjusted_speed);

  accumulator.distance += portionDistance;
  accumulator.elapsedTime += finite(source.elapsed_time) * ratio;
  accumulator.movingTime += movingTime;
  accumulator.elevationDifference += finite(source.elevation_difference) * ratio;

  if (averageHeartrate > 0 && movingTime > 0) {
    accumulator.heartrateTotal += averageHeartrate * movingTime;
    accumulator.heartrateWeight += movingTime;
  }

  if (gradeAdjustedSpeed > 0) {
    accumulator.gradeAdjustedTime += portionDistance / gradeAdjustedSpeed;
    accumulator.hasGradeAdjustedSpeed = true;
  }
}

function finishAccumulator(accumulator: SplitAccumulator): Split {
  return {
    split: accumulator.split,
    distance: Math.round(accumulator.distance),
    elapsed_time: Math.round(accumulator.elapsedTime),
    moving_time: Math.round(accumulator.movingTime),
    elevation_difference: accumulator.elevationDifference,
    average_speed: accumulator.movingTime > 0 ? accumulator.distance / accumulator.movingTime : 0,
    average_grade_adjusted_speed:
      accumulator.hasGradeAdjustedSpeed && accumulator.gradeAdjustedTime > 0
        ? accumulator.distance / accumulator.gradeAdjustedTime
        : null,
    average_heartrate:
      accumulator.heartrateWeight > 0
        ? accumulator.heartrateTotal / accumulator.heartrateWeight
        : null,
    pace_zone: null,
  };
}

export function resizeSplits(splits: Split[], targetDistanceMeters: number): Split[] {
  if (!splits.length || targetDistanceMeters <= 0) return [];

  const resized: Split[] = [];
  let accumulator = createAccumulator(1);
  let remainingInTargetSplit = targetDistanceMeters;

  for (const split of splits) {
    let remainingSourceDistance = finite(split.distance);
    if (remainingSourceDistance <= 0) continue;

    while (remainingSourceDistance > EPSILON) {
      const portionDistance = Math.min(remainingSourceDistance, remainingInTargetSplit);
      addPortion(accumulator, split, portionDistance);

      remainingSourceDistance -= portionDistance;
      remainingInTargetSplit -= portionDistance;

      if (remainingInTargetSplit <= EPSILON) {
        resized.push(finishAccumulator(accumulator));
        accumulator = createAccumulator(resized.length + 1);
        remainingInTargetSplit = targetDistanceMeters;
      }
    }
  }

  if (accumulator.distance > EPSILON) {
    resized.push(finishAccumulator(accumulator));
  }

  return resized;
}

export function resolveSplitsForUnits(
  splits: ActivitySplits | null | undefined,
  units: Units
): Split[] {
  const groups = splitGroups(splits);

  if (units === "imperial") {
    return groups.standard.length
      ? groups.standard
      : resizeSplits(groups.metric, METERS_PER_MILE);
  }

  return groups.metric.length
    ? groups.metric
    : resizeSplits(groups.standard, METERS_PER_KILOMETER);
}

export function hasSplits(splits: ActivitySplits | null | undefined): splits is ActivitySplits {
  const groups = splitGroups(splits);
  return groups.metric.length > 0 || groups.standard.length > 0;
}
