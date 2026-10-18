import type { ClientCommand } from "@/net/protocol";
import type { CommandResult } from "@/types/commands";
import type { LevelDefinition, PlayerState, SpawnPoint } from "@/types/game";
import type { GameEvent, MatchState, PlayerId, TrapState } from "@/types/state";

/**
 * What the scene and the HUD need from a match, wherever it runs:
 *  - LocalMatch: the rules run on this device (single player);
 *  - OnlineMatch: the rules run on the server; this device sends commands and its
 *    player's position, and mirrors what the server decides.
 * Everything that draws or controls the game talks to this interface only, so the
 * same scene, controls and HUD work in both modes.
 */
export interface MatchSource {
  readonly level: LevelDefinition;
  /** The player this device controls. */
  readonly localPlayerId: PlayerId;
  /** True if the rules run on a server. */
  readonly online: boolean;
  /** Online matches can't be paused: the others keep playing. */
  readonly canPause: boolean;

  getState(): MatchState;
  /** Shaped for useSyncExternalStore. */
  subscribe(listener: () => void): () => void;
  onEvent(listener: (event: GameEvent) => void): () => void;
  /** True while game time should flow (not paused, not finished). */
  readonly isRunning: boolean;

  /** Live trap state for drawing spikes. */
  getTrap(trapId: string): TrapState | undefined;
  /** Where the local player starts. */
  spawnPoint(): SpawnPoint;
  /**
   * Called every frame with the local player's body. Returns a point to move the
   * player to (after a trap hit), or null.
   */
  frame(dt: number, body: PlayerState): SpawnPoint | null;
  /** Another player's body to draw, updated in place every frame; undefined for the local player. */
  getRemoteBody(playerId: PlayerId): PlayerState | undefined;

  /** Send a command on behalf of the local player. */
  dispatch(command: ClientCommand): Promise<CommandResult>;

  pause(): void;
  resume(): void;
}
