import type { MuscleGroup, MuscleTag, MuscleHeatmapDetailTag } from "@/types";

const MUSCLE_TAG_LABELS: Record<MuscleTag, string> = {
  biceps_long_head: "Long-head bias",
  biceps_short_head: "Short-head bias",
  brachialis: "Brachialis",
  brachioradialis: "Brachioradialis",
};

const MUSCLE_TAG_PARENTS: Record<MuscleTag, MuscleGroup> = {
  biceps_long_head: "biceps",
  biceps_short_head: "biceps",
  brachialis: "biceps",
  brachioradialis: "biceps",
};

export function isMuscleTag(tag: string): tag is MuscleTag {
  return tag in MUSCLE_TAG_LABELS;
}

export function muscleTagLabel(tag: MuscleTag | string): string {
  if (isMuscleTag(tag)) return MUSCLE_TAG_LABELS[tag];
  return tag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function summarizeMuscleTags(tags: readonly MuscleTag[] | null | undefined, limit = 2): string {
  if (!tags || tags.length === 0) return "";
  return tags.slice(0, limit).map(muscleTagLabel).join(", ");
}

export function addMuscleTagSets(
  buckets: Partial<Record<MuscleGroup, Map<MuscleTag, number>>>,
  tags: readonly string[] | null | undefined,
  sets = 1
) {
  for (const tag of tags ?? []) {
    if (!isMuscleTag(tag)) continue;
    const parent = MUSCLE_TAG_PARENTS[tag];
    const bucket = buckets[parent] ?? new Map<MuscleTag, number>();
    bucket.set(tag, (bucket.get(tag) ?? 0) + sets);
    buckets[parent] = bucket;
  }
}

export function muscleTagSummaries(bucket: Map<MuscleTag, number> | undefined): MuscleHeatmapDetailTag[] {
  if (!bucket) return [];
  return Array.from(bucket.entries())
    .sort((a, b) => b[1] - a[1] || MUSCLE_TAG_LABELS[a[0]].localeCompare(MUSCLE_TAG_LABELS[b[0]]))
    .map(([tag, sets]) => ({ label: MUSCLE_TAG_LABELS[tag], sets }));
}
