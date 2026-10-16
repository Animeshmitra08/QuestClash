import type { StageManager } from "@/systems/StageManager";
import type { TrapSystem } from "@/systems/TrapSystem";
import type { LevelDefinition } from "@/types/game";

import { circleOverlapsRect } from "./CollisionSystem";
import type { MovementController } from "./MovementController";

/**
 * How much of the player's body must touch a trigger. Smaller than the collision
 * radius so a toe brushing the spike strip doesn't count; that feels fairer.
 */
const TRIGGER_RADIUS = 0.25;

/**
 * One frame of stage timing and trigger checks, run after the player has moved:
 * advances the trap and notice timers, then reports trap and exit zones the
 * player is standing in. A trap hit sends the player back to the checkpoint.
 */
export function updateStageFrame(
  level: LevelDefinition,
  stage: StageManager,
  trap: TrapSystem,
  movement: MovementController,
  dt: number,
) {
  trap.update(dt);
  stage.tick(dt);

  if (stage.getSnapshot().status !== "playing") return;

  const position = movement.state.position;
  for (const trigger of level.triggers) {
    if (!circleOverlapsRect(position, TRIGGER_RADIUS, trigger)) continue;

    if (trigger.kind === "trap" && trap.lethal) {
      stage.hitTrap();
      movement.reset(level.checkpoint.position, level.checkpoint.facing);
      return;
    }
    if (trigger.kind === "exit") {
      stage.reachExit();
      return;
    }
  }
}
