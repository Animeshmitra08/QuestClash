/**
 * Test helper: runs the real gameplay systems frame by frame, exactly as the
 * scene does, but without rendering. Only imported by tests.
 */
import { createLevelCollision } from "@/systems/CollisionSystem";
import { getSpawnPoint } from "@/systems/gameState";
import { InteractionSystem } from "@/systems/InteractionSystem";
import { MovementController } from "@/systems/MovementController";
import { StageManager } from "@/systems/StageManager";
import { syncWorldWithState } from "@/systems/worldSync";
import type { JoystickVector, LevelDefinition, Vec2 } from "@/types/game";
import type { GameEvent, InteractionResult } from "@/types/state";

export const FRAME = 1 / 60;
/** The game's fixed camera looks toward -z, so pushing the stick up walks toward -z. */
const CAMERA_FORWARD: Vec2 = { x: 0, z: -1 };
const STILL: JoystickVector = { x: 0, y: 0 };

export function createSimulation(level: LevelDefinition) {
  const collision = createLevelCollision(level);
  const interaction = new InteractionSystem(level.interactables);
  const start = getSpawnPoint(level, level.playerSpawnId);
  const movement = new MovementController(start.position, start.facing, collision);
  const stage = new StageManager(level);
  const events: GameEvent[] = [];

  stage.onEvent((event) => events.push(event));
  stage.subscribe(() => syncWorldWithState(level, stage.getState(), collision, interaction));
  syncWorldWithState(level, stage.getState(), collision, interaction);

  const position = movement.state.position;

  /** One frame of the game loop: PlayerController, then StageController. */
  function frame(stick: JoystickVector = STILL) {
    const dt = stage.isRunning ? FRAME : 0; // what GameClock does
    movement.update(stick, CAMERA_FORWARD, dt);
    interaction.update(position);
    const { respawnAt } = stage.update(dt, position);
    if (respawnAt) movement.reset(respawnAt.position, respawnAt.facing);
  }

  function wait(seconds: number) {
    for (let i = 0; i < Math.round(seconds / FRAME); i++) frame();
  }

  /** Steer toward a point like a player would. Returns true once within reach of it. */
  function walkTo(x: number, z: number, maxSeconds = 10): boolean {
    for (let i = 0; i < maxSeconds / FRAME; i++) {
      const dx = x - position.x;
      const dz = z - position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.12) {
        wait(0.3); // come to a stop
        return true;
      }
      const strength = Math.min(distance / 0.6, 1);
      frame({ x: (dx / distance) * strength, y: (-dz / distance) * strength });
    }
    return false;
  }

  /** Press USE. Returns what was in reach and what happened, or null if nothing was. */
  function use(): { targetId: string; result: InteractionResult } | null {
    const target = interaction.focused;
    return target ? { targetId: target.id, result: stage.interact(target) } : null;
  }

  return { stage, movement, interaction, collision, events, position, frame, wait, walkTo, use };
}
