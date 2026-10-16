import { useSyncExternalStore } from "react";

import type { StageManager, StageSnapshot } from "@/systems/StageManager";

/** Re-renders the component whenever stage progress changes (not every frame). */
export function useStageSnapshot(stage: StageManager): StageSnapshot {
  return useSyncExternalStore(stage.subscribe, stage.getSnapshot);
}
