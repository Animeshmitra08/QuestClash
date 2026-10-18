/**
 * Test harness: runs a match frame by frame with any number of players, using the
 * real gameplay systems and no rendering. Only imported by tests.
 *
 * Each simulated player is a separate entity, as a separate device would be: their
 * own body (MovementController), their own view of what's in reach
 * (InteractionSystem), and they act only by sending commands to the one shared
 * match (StageManager), which decides what happens.
 */
import { createLevelCollision } from "@/systems/CollisionSystem";
import { InteractionSystem } from "@/systems/InteractionSystem";
import { MovementController } from "@/systems/MovementController";
import type { PlayerProfile } from "@/systems/PlayerRegistry";
import { type MatchRules, StageManager } from "@/systems/StageManager";
import { syncWorldWithState } from "@/systems/worldSync";
import type { CommandResult, GameCommand } from "@/types/commands";
import type { JoystickVector, LevelDefinition, Vec2 } from "@/types/game";
import type { GameEvent, PlayerId } from "@/types/state";

export const FRAME = 1 / 60;
export const SOLO: PlayerProfile = { id: "solo", name: "Solo" };
/** The game's fixed camera looks toward -z, so pushing the stick up walks toward -z. */
const CAMERA_FORWARD: Vec2 = { x: 0, z: -1 };
const STILL: JoystickVector = { x: 0, y: 0 };

interface SimPlayer {
  movement: MovementController;
  interaction: InteractionSystem;
}

export function createMatchSimulation(
  level: LevelDefinition,
  profiles: readonly PlayerProfile[] = [SOLO],
  rules: Partial<MatchRules> = {},
) {
  const stage = new StageManager(level, rules);
  // Every device keeps its own copy of collision in step with the shared world.
  const collision = createLevelCollision(level);
  const players = new Map<PlayerId, SimPlayer>();
  const events: GameEvent[] = [];
  stage.onEvent((event) => events.push(event));

  for (const profile of profiles) {
    const joined = stage.addPlayer(profile);
    if (!joined.ok) throw new Error(`Couldn't add ${profile.id}: ${joined.reason}`);
    const spawn = stage.spawnPointFor(profile.id);
    players.set(profile.id, {
      movement: new MovementController(spawn.position, spawn.facing, collision),
      interaction: new InteractionSystem(level.interactables),
    });
  }

  const interactions = () => [...players.values()].map((p) => p.interaction);
  const sync = () => interactions().forEach((interaction) => syncWorldWithState(level, stage.getState(), collision, interaction));
  stage.subscribe(sync);
  sync();

  const body = (id: PlayerId) => {
    const player = players.get(id);
    if (!player) throw new Error(`No simulated player "${id}"`);
    return player;
  };
  const isActive = (id: PlayerId) => stage.getState().players[id]?.status === "active";

  /** One frame: every active player moves (with their own stick), then the match runs. */
  function frame(sticks: Readonly<Record<PlayerId, JoystickVector>> = {}) {
    const dt = stage.isRunning ? FRAME : 0; // what GameClock does
    const positions: Record<PlayerId, Vec2> = {};
    for (const [id, player] of players) {
      if (!isActive(id)) continue;
      player.movement.update(sticks[id] ?? STILL, CAMERA_FORWARD, dt);
      player.interaction.update(player.movement.state.position);
      positions[id] = player.movement.state.position;
    }
    const { respawns } = stage.update(dt, positions);
    for (const [id, respawn] of Object.entries(respawns)) body(id).movement.reset(respawn.position, respawn.facing);
  }

  function wait(seconds: number) {
    for (let i = 0; i < Math.round(seconds / FRAME); i++) frame();
  }

  /** Steer one player toward a point like a person would. Returns true once there. */
  function walkTo(id: PlayerId, x: number, z: number, maxSeconds = 10): boolean {
    const { position } = body(id).movement.state;
    for (let i = 0; i < maxSeconds / FRAME; i++) {
      if (!isActive(id)) return false;
      const dx = x - position.x;
      const dz = z - position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.12) {
        wait(0.3); // come to a stop
        return true;
      }
      const strength = Math.min(distance / 0.6, 1);
      frame({ [id]: { x: (dx / distance) * strength, y: (-dz / distance) * strength } });
    }
    return false;
  }

  /** Put a player somewhere directly (test setup), and let the match see it. */
  function place(id: PlayerId, x: number, z: number) {
    body(id).movement.reset({ x, z }, Math.PI);
    frame();
  }

  /** Press USE: an interact command for whatever this player's own view says is in reach. */
  function use(id: PlayerId): CommandResult | null {
    const target = body(id).interaction.focused;
    return target ? stage.dispatch({ type: "interact", playerId: id, targetId: target.id }) : null;
  }

  return {
    stage,
    events,
    frame,
    wait,
    walkTo,
    place,
    use,
    dispatch: (command: GameCommand) => stage.dispatch(command),
    resolve: (commands: GameCommand[]) => stage.resolve(commands),
    position: (id: PlayerId) => body(id).movement.state.position,
    focused: (id: PlayerId) => body(id).interaction.focused,
    player: (id: PlayerId) => stage.getState().players[id],
    state: () => stage.getState(),
  };
}

export type MatchSimulation = ReturnType<typeof createMatchSimulation>;
