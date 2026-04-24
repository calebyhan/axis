import type { MuscleGroup } from "@/types";
import { MuscleHeatmap } from "./MuscleHeatmap";

interface Props {
  coverage: Partial<Record<MuscleGroup, number>>;
  accent?: string;
}

export function MiniHeatmap({ coverage, accent }: Props) {
  return (
    <div className="flex gap-2">
      <MuscleHeatmap coverage={coverage} accent={accent} size="thumbnail" />
      <MuscleHeatmap coverage={coverage} accent={accent} size="thumbnail" showBack />
    </div>
  );
}
