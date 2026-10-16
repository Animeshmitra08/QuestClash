import type { StageSnapshot } from "@/systems/StageManager";
import type { LevelDefinition } from "@/types/game";

import type { CollisionSystem } from "./CollisionSystem";
import type { InteractionSystem } from "./InteractionSystem";

/**
 * Make collision and interaction match stage progress: collected pickups can no
 * longer be used, and opened doors stop blocking the way.
 *
 * It recomputes everything from the snapshot instead of reacting to individual
 * events, so it is safe to call any number of times.
 */
export function syncWorldWithStage(
  level: LevelDefinition,
  snapshot: StageSnapshot,
  collision: CollisionSystem,
  interaction: InteractionSystem,
) {
  for (const item of level.interactables) {
    switch (item.kind) {
      case "pickup":
        interaction.setEnabled(item.id, !snapshot.collectedIds.includes(item.id));
        break;
      case "door": {
        const open = snapshot.openedDoorIds.includes(item.id);
        collision.setEnabled(item.id, !open);
        interaction.setEnabled(item.id, !open);
        break;
      }
    }
  }
}
