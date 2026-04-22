import { createClient } from "@supabase/supabase-js";

// Wger muscle ID → Axis muscle group name
const WGER_MUSCLE_MAP: Record<number, string> = {
  1: "biceps",
  2: "front_delt",
  3: "chest",
  4: "triceps",
  5: "abs",
  6: "quads",
  7: "calves",
  8: "glutes",
  9: "lats",
  10: "hamstrings",
  11: "upper_back",
  12: "forearm",
  13: "traps",
  14: "lower_back",
  15: "adductors",
};

// Wger category ID → Axis category + movement_pattern
const WGER_CATEGORY_MAP: Record<number, { category: string; movement_pattern: string }> = {
  8: { category: "core", movement_pattern: "core" },
  9: { category: "other", movement_pattern: "other" },
  10: { category: "legs", movement_pattern: "quad_dominant" },
  11: { category: "legs", movement_pattern: "hip_hinge" },
  12: { category: "other", movement_pattern: "carry" },
  13: { category: "push", movement_pattern: "horizontal_push" },
  14: { category: "pull", movement_pattern: "horizontal_pull" },
  15: { category: "push", movement_pattern: "vertical_push" },
};

interface WgerMuscle { id: number }
interface WgerTranslation { name: string; language: number }
interface WgerExercise {
  id: number;
  category: { id: number };
  muscles: WgerMuscle[];
  muscles_secondary: WgerMuscle[];
  equipment: { id: number }[];
  translations: WgerTranslation[];
}

const WGER_EQUIPMENT_MAP: Record<number, string> = {
  1: "barbell",
  2: "machine",
  3: "dumbbell",
  4: "gym_mat",
  5: "kettlebell",
  6: "dumbbell",
  7: "bodyweight",
  8: "cables",
  9: "resistance_band",
  10: "ez_bar",
};

async function fetchAllExercises(): Promise<WgerExercise[]> {
  const results: WgerExercise[] = [];
  let url: string | null = "https://wger.de/api/v2/exercise/?format=json&language=2&limit=100";

  while (url) {
    const res: Response = await fetch(url);
    if (!res.ok) break;
    const data: { results: WgerExercise[]; next: string | null } = await res.json();
    results.push(...data.results);
    url = data.next;
    await new Promise((r) => setTimeout(r, 200));
  }

  return results;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  console.log("Fetching exercises from Wger…");
  const exercises = await fetchAllExercises();
  console.log(`Fetched ${exercises.length} exercises`);

  const toInsert = exercises
    .filter((ex) => {
      const translations = ex.translations ?? [];
      return translations.some((t: WgerTranslation) => t.language === 2 && t.name?.trim());
    })
    .map((ex) => {
      const englishName = ex.translations.find(
        (t: WgerTranslation) => t.language === 2
      )?.name ?? "Unknown";

      const catInfo = WGER_CATEGORY_MAP[ex.category?.id] ?? {
        category: "other",
        movement_pattern: "other",
      };

      const primaryMuscles = (ex.muscles ?? [])
        .map((m: WgerMuscle) => WGER_MUSCLE_MAP[m.id])
        .filter(Boolean);

      const secondaryMuscles = (ex.muscles_secondary ?? [])
        .map((m: WgerMuscle) => WGER_MUSCLE_MAP[m.id])
        .filter(Boolean);

      const equipment =
        WGER_EQUIPMENT_MAP[(ex.equipment?.[0]?.id)] ?? "bodyweight";

      return {
        name: englishName.trim(),
        category: catInfo.category,
        primary_muscles: primaryMuscles,
        secondary_muscles: secondaryMuscles,
        movement_pattern: catInfo.movement_pattern,
        equipment,
        is_custom: false,
      };
    });

  // Deduplicate by name
  const seen = new Set<string>();
  const unique = toInsert.filter((e) => {
    if (seen.has(e.name.toLowerCase())) return false;
    seen.add(e.name.toLowerCase());
    return true;
  });

  console.log(`Upserting ${unique.length} exercises…`);

  // Batch upsert
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const { error } = await supabase
      .from("exercises")
      .upsert(batch, { onConflict: "name", ignoreDuplicates: true });
    if (error) console.error("Upsert error:", error.message);
    else console.log(`  Batch ${i / 50 + 1}: ${batch.length} exercises`);
  }

  console.log("Done!");
}

main().catch(console.error);
