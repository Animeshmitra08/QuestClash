import type { MovementController } from "@/systems/MovementController";
import type { StageManager } from "@/systems/StageManager";

import { useGameFrame } from "./gameClock";

interface StageControllerProps {
  stage: StageManager;
  movement: MovementController;
}

/**
 * Runs one frame of stage rules (timer, traps, trigger zones) at the player's
 * position, and applies the one result the scene must handle: respawning.
 * Mount it after PlayerController so it sees where the player moved this frame.
 * Renders nothing. Game time stops while paused (see gameClock).
 */
export function StageController({ stage, movement }: StageControllerProps) {
  useGameFrame((_, dt) => {
    const { respawnAt } = stage.update(dt, movement.state.position);
    if (respawnAt) movement.reset(respawnAt.position, respawnAt.facing);
  });

  return null;
}
