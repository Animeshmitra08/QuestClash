import type { StageManager } from "@/systems/StageManager";
import type { TrapSystem } from "@/systems/TrapSystem";
import type { LevelDefinition } from "@/types/game";

import { useGameFrame } from "./gameClock";
import type { MovementController } from "./MovementController";
import { updateStageFrame } from "./triggers";

interface StageControllerProps {
  level: LevelDefinition;
  stage: StageManager;
  /** Shared by every trap trigger, so all spikes fire in sync. */
  trap: TrapSystem;
  movement: MovementController;
}

/**
 * Runs the stage's timers and trigger zones (trap, exit) once per frame.
 * Mount it after PlayerController so it sees where the player moved this frame.
 * Renders nothing. Game time stops while paused (see gameClock).
 */
export function StageController({ level, stage, trap, movement }: StageControllerProps) {
  useGameFrame((_, dt) => {
    updateStageFrame(level, stage, trap, movement, dt);
  });

  return null;
}
