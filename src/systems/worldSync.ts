import type { LevelDefinition } from "@/types/game";
import type { GameState } from "@/types/state";

import type { CollisionSystem } from "./CollisionSystem";
import { isDoorOpen, isPickupCollected } from "./gameState";
import type { InteractionSystem } from "./InteractionSystem";

/**
 * Make collision and interaction match progress: collected pickups can no longer
 * be used, and opened doors stop blocking the way.
 *
 * It recomputes everything from the state instead of reacting to individual
 * events, so it is safe to call any number of times.
 */
export function syncWorldWithState(
  level: LevelDefinition,
  state: GameState,
  collision: CollisionSystem,
  interaction: InteractionSystem,
) {
  for (const item of level.interactables) {
    switch (item.kind) {
      case "pickup":
        interaction.setEnabled(item.id, !isPickupCollected(state, item.id));
        break;
      case "door": {
        const open = isDoorOpen(state, item.id);
        collision.setEnabled(item.id, !open);
        interaction.setEnabled(item.id, !open);
        break;
      }
    }
  }
}
