import { useSyncExternalStore } from "react";

import type { StageManager } from "@/systems/StageManager";
import type { MatchState } from "@/types/state";

/** Re-renders the component whenever match progress changes (not every frame). */
export function useMatchState(stage: StageManager): MatchState {
  return useSyncExternalStore(stage.subscribe, stage.getState);
}
