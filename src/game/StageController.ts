import type { MatchSource } from "@/session/MatchSource";
import type { MovementController } from "@/systems/MovementController";

import { useGameFrame } from "./gameClock";

interface StageControllerProps {
  source: MatchSource;
  movement: MovementController;
}

/**
 * Hands the local player's body to the match once per frame and applies the one
 * result the scene must handle: respawning. In single player the match runs its
 * rules right here; online, the position goes to the server, which decides.
 * Mount it after PlayerController so it sees where the player moved this frame.
 * Renders nothing. Game time stops while paused (see gameClock).
 */
export function StageController({ source, movement }: StageControllerProps) {
  useGameFrame((_, dt) => {
    const respawn = source.frame(dt, movement.state);
    if (respawn) movement.reset(respawn.position, respawn.facing);
  });

  return null;
}
