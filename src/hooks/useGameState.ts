import { useSyncExternalStore } from "react";

import type { StageManager } from "@/systems/StageManager";
import type { GameState } from "@/types/state";

/** Re-renders the component whenever game progress changes (not every frame). */
export function useGameState(stage: StageManager): GameState {
  return useSyncExternalStore(stage.subscribe, stage.getState);
}
